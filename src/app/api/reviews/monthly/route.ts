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
    const source = url.searchParams.get("source") as "NAVER" | "GOOGLE" | null
    const year = url.searchParams.get("year")

    if (!clinicId) {
      return NextResponse.json({ error: "Missing clinicId" }, { status: 400 })
    }

    // ── 연도 무관 누적 계산 ──────────────────────────────
    // 누적 총계(totalReviews)는 저장값을 쓰지 않고 항상 "월별 신규(newReviews)의 누적합"으로 계산.
    // 시작 이전 기존 리뷰(베이스라인)는 month=0 행의 newReviews 로 넣으면 자동 포함됨. (없으면 0부터)
    const targetYear = year ? parseInt(year) : new Date().getFullYear()

    // 요청 연도 이하 전체를 시간순으로 가져와 누적 계산
    const all = await prisma.reviewSummary.findMany({
      where: { clinicId, ...(source && { source }), year: { lte: targetYear } },
      select: {
        id: true, year: true, month: true,
        totalReviews: true, newReviews: true,
        targetReviews: true, achievementRate: true, updatedAt: true,
      },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    })

    // 각 (연,월)까지의 누적 총계 계산 (month=0 베이스라인 포함)
    let running = 0
    const cumulative = new Map<string, number>()
    for (const r of all) {
      running += r.newReviews || 0
      cumulative.set(`${r.year}-${r.month}`, running)
    }

    const shape = (r: typeof all[number]) => ({
      id: r.id, year: r.year, month: r.month,
      newReviews: r.newReviews || 0,
      totalReviews: cumulative.get(`${r.year}-${r.month}`) ?? 0, // 항상 누적 계산값
      targetReviews: r.targetReviews,
      achievementRate: r.achievementRate,
      updatedAt: r.updatedAt,
    })

    let reviews
    if (year) {
      // 지정 연도의 실제 월(month>=1)만, 최신월 우선
      reviews = all.filter(r => r.year === targetYear && r.month >= 1)
        .map(shape)
        .sort((a, b) => b.month - a.month)
    } else {
      // 연도 미지정: 최근 12개월(month>=1)
      reviews = all.filter(r => r.month >= 1)
        .map(shape)
        .sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month))
        .slice(0, 12)
    }

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