import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const clinicId = url.searchParams.get("clinicId")
    const year = url.searchParams.get("year")
    const month = url.searchParams.get("month")

    if (!clinicId) {
      return NextResponse.json({ error: "Missing clinicId" }, { status: 400 })
    }

    const currentDate = new Date()
    const targetYear = year ? parseInt(year) : currentDate.getFullYear()
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1

    // ── 연도 무관 누적 계산 (2025 하드코딩/저장 totalReviews 합산 제거) ──
    // totalReviews(누적)는 저장값을 쓰지 않고 항상 newReviews 누적합으로 계산.
    const allRows = await prisma.reviewSummary.findMany({
      where: { clinicId },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    })

    const bySource = new Map<string, typeof allRows>()
    for (const r of allRows) {
      if (!bySource.has(r.source)) bySource.set(r.source, [] as any)
      ;(bySource.get(r.source) as any[]).push(r)
    }

    const summaries: any[] = []
    const allTimeSummaries: any[] = []
    for (const [source, rows] of bySource) {
      let running = 0, cumulativeAtTarget = 0
      let thisMonthNew = 0, thisMonthAvg: number | null = null
      let posSum = 0, negSum = 0, ratingSum = 0, ratingCnt = 0, replySum = 0, replyCnt = 0
      for (const r of rows) {
        running += r.newReviews || 0
        posSum += r.positiveCount || 0
        negSum += r.negativeCount || 0
        if (r.avgRating != null) { ratingSum += r.avgRating; ratingCnt++ }
        if (r.replyRate != null) { replySum += r.replyRate; replyCnt++ }
        if (r.year < targetYear || (r.year === targetYear && r.month <= targetMonth)) cumulativeAtTarget = running
        if (r.year === targetYear && r.month === targetMonth) { thisMonthNew = r.newReviews || 0; thisMonthAvg = r.avgRating ?? null }
      }
      summaries.push({
        id: `cumulative-${source}`, clinicId, source, year: targetYear, month: targetMonth,
        totalReviews: cumulativeAtTarget,      // 해당 월까지 누적 (항상 계산값)
        newReviews: thisMonthNew,              // 이번 달 신규만
        avgRating: thisMonthAvg,
        positiveCount: posSum, negativeCount: negSum,
        replyRate: replyCnt ? replySum / replyCnt : null,
        achievementRate: null, targetReviews: null, topKeywords: null, ratingDist: null,
        createdAt: new Date(), updatedAt: new Date(),
      })
      allTimeSummaries.push({
        source,
        _sum: { totalReviews: running, positiveCount: posSum, negativeCount: negSum },
        _avg: { avgRating: ratingCnt ? ratingSum / ratingCnt : null, replyRate: replyCnt ? replySum / replyCnt : null },
      })
    }

    // 최근 리뷰 (연도 하드코딩 제거)
    const recentReviews = await prisma.review.findMany({
      where: { clinicId },
      orderBy: { reviewDate: "desc" },
      take: 5,
      select: { id: true, source: true, authorName: true, rating: true, content: true, reviewDate: true, isPositive: true },
    })

    // 월별 트렌드: 전체 월(오래된→최신)
    const monthlyTrends = allRows

    return NextResponse.json({
      currentMonth: summaries,
      allTime: allTimeSummaries,
      recentReviews,
      monthlyTrends,
    })
  } catch (error) {
    console.error("Review summary error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}