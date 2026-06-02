import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

// 모든 활성화된 리뷰 설정에 대해 자동 동기화 실행
export async function POST(request: Request) {
  try {
    // 인증 헤더 확인 (cron job 등에서 호출할 때 사용)
    const authHeader = request.headers.get("authorization")
    const expectedAuth = process.env.CRON_SECRET

    if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 모든 활성화된 리뷰 설정 조회
    const activeConfigs = await prisma.reviewConfig.findMany({
      where: { isActive: true },
      include: { clinic: true },
    })

    const results = []

    for (const config of activeConfigs) {
      try {
        let reviewData

        if (config.source === "GOOGLE" && config.placeId) {
          reviewData = await fetchGoogleReviews(config.placeId)
        } else if (config.source === "NAVER" && config.placeUrl) {
          // 네이버 크롤링은 현재 구현하지 않음
          console.log(`Skipping Naver crawl for clinic ${config.clinicId}`)
          continue
        } else {
          console.log(`Invalid config for ${config.source} - clinic ${config.clinicId}`)
          continue
        }

        if (!reviewData?.reviews || reviewData.reviews.length === 0) {
          console.log(`No reviews found for ${config.source} - clinic ${config.clinicId}`)
          continue
        }

        // 기존 리뷰와 새 리뷰 비교
        const existingReviews = await prisma.review.findMany({
          where: { configId: config.id },
          select: { reviewId: true },
        })

        const existingIds = new Set(existingReviews.map(r => r.reviewId))
        const newReviews = []
        const now = new Date()

        for (const review of reviewData.reviews) {
          const reviewId = `${config.source}_${review.author_name}_${review.time || review.relative_time_description}`

          if (!existingIds.has(reviewId)) {
            newReviews.push({
              clinicId: config.clinicId,
              configId: config.id,
              source: config.source,
              reviewId,
              authorName: review.author_name || "익명",
              rating: review.rating || null,
              content: review.text || null,
              reviewDate: review.time ? new Date(review.time * 1000) : null,
              isPositive: review.rating ? review.rating >= 4 : null,
              createdAt: now,
              updatedAt: now,
            })
          }
        }

        // 새로운 리뷰들을 데이터베이스에 저장
        if (newReviews.length > 0) {
          await prisma.review.createMany({
            data: newReviews,
          })
        }

        // 설정의 lastSyncAt 업데이트
        await prisma.reviewConfig.update({
          where: { id: config.id },
          data: { lastSyncAt: now },
        })

        // 월별 요약 업데이트
        await updateMonthlySummary(config.clinicId, config.source, now)

        results.push({
          clinicId: config.clinicId,
          clinicName: config.clinic.name,
          source: config.source,
          newReviewsCount: newReviews.length,
          status: "success",
        })

      } catch (error) {
        console.error(`Failed to sync reviews for clinic ${config.clinicId}, source ${config.source}:`, error)
        results.push({
          clinicId: config.clinicId,
          source: config.source,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      message: "Auto sync completed",
      results,
      processedConfigs: activeConfigs.length,
      successCount: results.filter(r => r.status === "success").length,
      errorCount: results.filter(r => r.status === "error").length,
    })

  } catch (error) {
    console.error("Auto sync error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Google Places API를 사용한 리뷰 수집 (재사용)
async function fetchGoogleReviews(placeId: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    throw new Error("Google Places API key not configured")
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&key=${apiKey}`

  const response = await fetch(url)
  const data = await response.json()

  if (data.status !== "OK") {
    throw new Error(`Google Places API error: ${data.status}`)
  }

  return data.result
}

// 월별 요약 통계 업데이트 (재사용)
async function updateMonthlySummary(clinicId: string, source: "GOOGLE" | "NAVER", date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  // 해당 월의 모든 리뷰 조회
  const reviews = await prisma.review.findMany({
    where: {
      clinicId,
      source,
      reviewDate: {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      },
    },
  })

  // 이번 달 새로 작성된 리뷰 (reviewDate 기준)
  const thisMonthReviews = reviews.filter(r =>
    r.reviewDate &&
    r.reviewDate.getFullYear() === year &&
    r.reviewDate.getMonth() + 1 === month
  )

  const totalReviews = reviews.length
  const newReviews = thisMonthReviews.length
  const ratingsWithValues = reviews.filter(r => r.rating !== null)
  const avgRating = ratingsWithValues.length > 0
    ? ratingsWithValues.reduce((sum, r) => sum + (r.rating || 0), 0) / ratingsWithValues.length
    : null

  const positiveCount = reviews.filter(r => r.isPositive === true).length
  const negativeCount = reviews.filter(r => r.isPositive === false).length
  const repliedReviews = reviews.filter(r => r.reply).length
  const replyRate = totalReviews > 0 ? (repliedReviews / totalReviews) * 100 : null

  // 평점 분포 계산
  const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  ratingsWithValues.forEach(r => {
    if (r.rating && r.rating >= 1 && r.rating <= 5) {
      ratingDist[r.rating as keyof typeof ratingDist]++
    }
  })

  await prisma.reviewSummary.upsert({
    where: { clinicId_source_year_month: { clinicId, source, year, month } },
    create: {
      clinicId,
      source,
      year,
      month,
      totalReviews,
      newReviews,
      avgRating,
      positiveCount,
      negativeCount,
      replyRate,
      ratingDist,
    },
    update: {
      totalReviews,
      newReviews,
      avgRating,
      positiveCount,
      negativeCount,
      replyRate,
      ratingDist,
      updatedAt: new Date(),
    },
  })
}