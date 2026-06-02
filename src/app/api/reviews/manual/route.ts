import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { clinicId, source, totalReviews, monthlyReviews, averageRating, feedbackComments } = await request.json()

    if (!clinicId || !source) {
      return NextResponse.json({ error: "clinicId와 source는 필수입니다" }, { status: 400 })
    }

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    // 월별 요약 업데이트/생성
    const reviewSummary = await prisma.reviewSummary.upsert({
      where: { clinicId_source_year_month: { clinicId, source, year, month } },
      create: {
        clinicId,
        source,
        year,
        month,
        totalReviews: totalReviews || 0,
        newReviews: monthlyReviews || 0,
        avgRating: averageRating || null,
        positiveCount: Math.round((totalReviews || 0) * 0.8), // 임시: 80% 긍정적이라 가정
        negativeCount: Math.round((totalReviews || 0) * 0.2), // 임시: 20% 부정적이라 가정
        topKeywords: feedbackComments ? { feedback: feedbackComments } : null,
      },
      update: {
        totalReviews: totalReviews || 0,
        newReviews: monthlyReviews || 0,
        avgRating: averageRating || null,
        positiveCount: Math.round((totalReviews || 0) * 0.8),
        negativeCount: Math.round((totalReviews || 0) * 0.2),
        topKeywords: feedbackComments ? { feedback: feedbackComments } : null,
        updatedAt: now,
      },
    })

    return NextResponse.json({
      success: true,
      message: `${source} 리뷰 현황이 저장되었습니다`,
      summary: reviewSummary
    })

  } catch (error: any) {
    console.error("Manual review input error:", error)
    return NextResponse.json({
      error: "리뷰 현황 저장 중 오류가 발생했습니다",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}