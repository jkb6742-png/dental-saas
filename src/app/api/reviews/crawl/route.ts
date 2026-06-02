import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

// Google Places API를 사용한 리뷰 수집
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

// 네이버 리뷰 크롤링 (간단한 예시 - 실제로는 더 복잡한 구현 필요)
async function fetchNaverReviews(placeUrl: string) {
  // 네이버는 공식 API가 없으므로 실제 구현시에는
  // 웹 스크래핑이나 다른 방법이 필요합니다
  // 여기서는 데모용 빈 배열을 반환합니다
  console.warn("Naver review crawling not implemented - requires web scraping")
  return { reviews: [], rating: null, user_ratings_total: 0 }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { clinicId, source } = await request.json()

    if (!clinicId || !source) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 리뷰 설정 조회
    const config = await prisma.reviewConfig.findUnique({
      where: { clinicId_source: { clinicId, source } },
    })

    if (!config || !config.isActive) {
      return NextResponse.json({ error: "Review config not found or inactive" }, { status: 404 })
    }

    let reviewData

    try {
      if (source === "GOOGLE" && config.placeId) {
        reviewData = await fetchGoogleReviews(config.placeId)
      } else if (source === "NAVER" && config.placeUrl) {
        reviewData = await fetchNaverReviews(config.placeUrl)
      } else {
        return NextResponse.json({ error: "Invalid configuration for source" }, { status: 400 })
      }
    } catch (error) {
      console.error(`Failed to fetch ${source} reviews:`, error)
      return NextResponse.json({
        error: `Failed to fetch ${source} reviews: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, { status: 500 })
    }

    if (!reviewData?.reviews) {
      return NextResponse.json({ error: "No reviews found" }, { status: 404 })
    }

    // 기존 리뷰와 새 리뷰 비교하여 중복 제거
    const existingReviews = await prisma.review.findMany({
      where: { configId: config.id },
      select: { reviewId: true },
    })

    const existingIds = new Set(existingReviews.map(r => r.reviewId))

    const newReviews = []
    const now = new Date()

    for (const review of reviewData.reviews) {
      const reviewId = `${source}_${review.author_name}_${review.time || review.relative_time_description}`

      if (!existingIds.has(reviewId)) {
        newReviews.push({
          clinicId,
          configId: config.id,
          source,
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
    await updateMonthlySummary(clinicId, source, now)

    return NextResponse.json({
      message: `Successfully crawled ${source} reviews`,
      newReviewsCount: newReviews.length,
      totalReviews: reviewData.user_ratings_total || 0,
      averageRating: reviewData.rating || null,
    })
  } catch (error) {
    console.error("Review crawl error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// 월별 요약 통계 업데이트
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