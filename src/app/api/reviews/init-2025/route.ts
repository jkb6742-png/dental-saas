import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

// 2025년 데이터 초기화 (마스터만 실행 가능)
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 마스터 권한 체크
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email || "" },
      select: { role: true }
    })

    if (!user || user.role !== 'MASTER') {
      return NextResponse.json({ error: "Master access required" }, { status: 403 })
    }

    const { clinicId } = await request.json()

    if (!clinicId) {
      return NextResponse.json({ error: "Missing clinicId" }, { status: 400 })
    }

    console.log("🔄 2025년 기준 데이터 초기화 시작...")

    // 2025년 12개월 데이터를 모두 0으로 초기화
    const reviewSummaries = []

    for (let month = 1; month <= 12; month++) {
      // 네이버 데이터
      reviewSummaries.push({
        clinicId,
        source: "NAVER" as const,
        year: 2025,
        month,
        totalReviews: 0,
        newReviews: 0,
        targetReviews: null,
        achievementRate: null,
      })

      // 구글 데이터
      reviewSummaries.push({
        clinicId,
        source: "GOOGLE" as const,
        year: 2025,
        month,
        totalReviews: 0,
        newReviews: 0,
        targetReviews: null,
        achievementRate: null,
      })
    }

    // 2025년 데이터 일괄 생성 (이미 있으면 무시)
    const results = []
    for (const summary of reviewSummaries) {
      try {
        const created = await prisma.reviewSummary.upsert({
          where: {
            clinicId_source_year_month: {
              clinicId: summary.clinicId,
              source: summary.source,
              year: summary.year,
              month: summary.month
            }
          },
          create: summary,
          update: {}, // 이미 있으면 업데이트하지 않음
        })
        results.push(created)
      } catch (error) {
        console.warn(`Failed to create ${summary.source} ${summary.year}-${summary.month}:`, error)
      }
    }

    console.log(`✅ 2025년 기준 데이터 초기화 완료: ${results.length}개 레코드`)

    return NextResponse.json({
      success: true,
      message: "2025년 기준 데이터가 초기화되었습니다",
      recordsCreated: results.length,
      details: "2025년 1월~12월, 네이버/구글 각각 0개로 설정"
    })

  } catch (error: any) {
    console.error("2025 initialization error:", error)
    return NextResponse.json({
      error: "2025년 데이터 초기화 중 오류가 발생했습니다",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}