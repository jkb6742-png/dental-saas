import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

// 월별 리뷰 데이터 조회
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const clinicId = url.searchParams.get("clinicId")

    if (!clinicId) {
      return NextResponse.json({ error: "Missing clinicId" }, { status: 400 })
    }

    // 네이버 리뷰의 최근 12개월 데이터 조회
    const reviews = await prisma.reviewSummary.findMany({
      where: {
        clinicId,
        source: "NAVER"
      },
      select: {
        id: true,
        year: true,
        month: true,
        totalReviews: true,
        newReviews: true,
        targetReviews: true,
        achievementRate: true,
        updatedAt: true
      },
      orderBy: [
        { year: "desc" },
        { month: "desc" }
      ],
      take: 12
    })

    return NextResponse.json(reviews)

  } catch (error: any) {
    console.error("Monthly reviews fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// 월별 리뷰 데이터 저장/수정 (마스터 계정만)
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 마스터 계정 권한 체크
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email || "" },
      select: { role: true }
    })

    if (!user || user.role !== 'MASTER') {
      return NextResponse.json({ error: "Master access required" }, { status: 403 })
    }

    const {
      clinicId,
      source = "NAVER",
      year,
      month,
      totalReviews,
      newReviews,
      targetReviews,
      achievementRate
    } = await request.json()

    if (!clinicId || !year || !month) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 달성률 계산
    let calculatedAchievementRate = achievementRate
    if (targetReviews && targetReviews > 0 && newReviews !== undefined) {
      calculatedAchievementRate = (newReviews / targetReviews) * 100
    }

    // 월별 요약 데이터 저장/수정
    const reviewSummary = await prisma.reviewSummary.upsert({
      where: {
        clinicId_source_year_month: {
          clinicId,
          source: source as "NAVER" | "GOOGLE",
          year: parseInt(year.toString()),
          month: parseInt(month.toString())
        }
      },
      create: {
        clinicId,
        source: source as "NAVER" | "GOOGLE",
        year: parseInt(year.toString()),
        month: parseInt(month.toString()),
        totalReviews: totalReviews || 0,
        newReviews: newReviews || 0,
        targetReviews: targetReviews || null,
        achievementRate: calculatedAchievementRate || null,
      },
      update: {
        totalReviews: totalReviews || 0,
        newReviews: newReviews || 0,
        targetReviews: targetReviews || null,
        achievementRate: calculatedAchievementRate || null,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: `${year}년 ${month}월 리뷰 현황이 저장되었습니다`,
      data: reviewSummary
    })

  } catch (error: any) {
    console.error("Monthly review save error:", error)
    return NextResponse.json({
      error: "리뷰 현황 저장 중 오류가 발생했습니다",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}