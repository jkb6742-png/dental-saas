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

    // 해당 월의 리뷰 요약 조회
    const summaries = await prisma.reviewSummary.findMany({
      where: {
        clinicId,
        year: targetYear,
        month: targetMonth,
      },
      orderBy: { source: "asc" },
    })

    // 전체 리뷰 통계 (모든 월 합계)
    const allTimeSummaries = await prisma.reviewSummary.groupBy({
      by: ["source"],
      where: { clinicId },
      _sum: {
        totalReviews: true,
        positiveCount: true,
        negativeCount: true,
      },
      _avg: {
        avgRating: true,
        replyRate: true,
      },
    })

    // 최근 리뷰 조회 (최대 5개)
    const recentReviews = await prisma.review.findMany({
      where: { clinicId },
      orderBy: { reviewDate: "desc" },
      take: 5,
      select: {
        id: true,
        source: true,
        authorName: true,
        rating: true,
        content: true,
        reviewDate: true,
        isPositive: true,
      },
    })

    // 월별 트렌드 (최근 6개월)
    const sixMonthsAgo = new Date(targetYear, targetMonth - 7, 1)
    const monthlyTrends = await prisma.reviewSummary.findMany({
      where: {
        clinicId,
        OR: [
          { year: { gt: sixMonthsAgo.getFullYear() } },
          {
            year: sixMonthsAgo.getFullYear(),
            month: { gte: sixMonthsAgo.getMonth() + 1 },
          },
        ],
      },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    })

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