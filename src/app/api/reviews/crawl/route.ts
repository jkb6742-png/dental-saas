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

// 네이버 리뷰 크롤링 (Puppeteer 사용)
async function fetchNaverReviews(placeUrl: string) {
  try {
    console.log("🕷️ 네이버 리뷰 크롤링 시작:", placeUrl)

    // 환경 체크 - 프로덕션에서는 크롤링 비활성화
    if (process.env.NODE_ENV === 'production') {
      console.warn("⚠️ 프로덕션 환경에서는 네이버 크롤링을 비활성화합니다")
      return { reviews: [], rating: null, user_ratings_total: 0 }
    }

    const puppeteer = require('puppeteer')

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    })

    const page = await browser.newPage()

    // User-Agent 설정으로 봇 탐지 우회 시도
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    // 페이지 로드
    await page.goto(placeUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    // 리뷰 탭 클릭 시도
    try {
      await page.waitForSelector('[data-tab="review"]', { timeout: 5000 })
      await page.click('[data-tab="review"]')
      await page.waitForTimeout(2000)
    } catch (e) {
      console.warn("리뷰 탭을 찾을 수 없음, 기본 페이지에서 시도")
    }

    // 리뷰 데이터 추출
    const reviews = await page.evaluate(() => {
      const reviewElements = document.querySelectorAll('.place_section_content .zPfVt') // 네이버 리뷰 셀렉터 (변경 가능)
      const reviews = []

      reviewElements.forEach((element, index) => {
        if (index >= 10) return // 최대 10개만

        try {
          const authorElement = element.querySelector('.YeINN')
          const ratingElement = element.querySelector('.PXMot em')
          const contentElement = element.querySelector('.ZZ4OK')
          const dateElement = element.querySelector('.BB2Kx')

          const author = authorElement?.textContent?.trim() || '익명'
          const ratingText = ratingElement?.textContent?.trim()
          const rating = ratingText ? parseInt(ratingText) : null
          const content = contentElement?.textContent?.trim() || ''
          const dateText = dateElement?.textContent?.trim()

          if (content) {
            reviews.push({
              author_name: author,
              rating: rating,
              text: content,
              time: dateText,
              relative_time_description: dateText
            })
          }
        } catch (err) {
          console.warn('개별 리뷰 파싱 오류:', err)
        }
      })

      return reviews
    })

    await browser.close()

    console.log(`✅ 네이버 리뷰 ${reviews.length}개 수집 완료`)

    return {
      reviews: reviews,
      rating: null, // 네이버에서 전체 평점 추출은 별도 구현 필요
      user_ratings_total: reviews.length
    }

  } catch (error) {
    console.error("❌ 네이버 리뷰 크롤링 실패:", error)

    // 크롤링 실패시 빈 결과 반환 (에러 발생시키지 않음)
    return { reviews: [], rating: null, user_ratings_total: 0 }
  }
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