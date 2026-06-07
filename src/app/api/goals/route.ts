import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

// 목표 조회
export async function GET(req: NextRequest) {
  let clinicId: string | null = null
  let year: number = new Date().getFullYear()
  let month: number | null = null

  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    clinicId = searchParams.get('clinicId')
    year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    month = searchParams.get('month') ? parseInt(searchParams.get('month')) : null

    if (!clinicId) {
      return NextResponse.json({ error: "clinicId가 필요합니다" }, { status: 400 })
    }

    // 권한 확인 (해당 치과 접근 권한)
    const userRole = (session.user as any).role
    const userAgencyId = (session.user as any).agencyId

    const clinic = await prisma.clinic.findFirst({
      where: { id: clinicId, agencyId: userAgencyId }
    })

    if (!clinic) {
      return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 })
    }

    // 목표 조회
    const goals = await prisma.revenueGoal.findMany({
      where: {
        clinicId,
        year,
        ...(month ? { month } : {})
      },
      orderBy: [
        { year: 'desc' },
        { month: 'asc' }
      ]
    })

    return NextResponse.json({ goals })

  } catch (error) {
    console.error('목표 조회 실패 상세:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      clinicId,
      year,
      month
    })
    return NextResponse.json({
      error: "목표 조회 중 오류가 발생했습니다",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// 목표 설정/수정
export async function POST(req: NextRequest) {
  let clinicId: string | undefined
  let year: number | undefined
  let month: number | null = null
  let revenueGoal: number | undefined
  let newPatientGoal: number | undefined
  let description: string | undefined

  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    // 관리자 이상 권한 필요
    const userRole = (session.user as any).role
    if (!['MASTER', 'ADMIN'].includes(userRole)) {
      return NextResponse.json({
        error: "목표 설정은 관리자 이상만 가능합니다"
      }, { status: 403 })
    }

    const requestBody = await req.json()
    clinicId = requestBody.clinicId
    year = requestBody.year
    month = requestBody.month // null이면 연간 목표
    revenueGoal = requestBody.revenueGoal
    newPatientGoal = requestBody.newPatientGoal
    description = requestBody.description

    // 필수 필드 검증
    if (!clinicId || !year) {
      return NextResponse.json({
        error: "clinicId, year는 필수입니다"
      }, { status: 400 })
    }

    // 매출 목표나 신환 목표 중 최소 하나는 있어야 함
    if (!revenueGoal && !newPatientGoal) {
      return NextResponse.json({
        error: "매출 목표 또는 신환 목표 중 최소 하나는 설정해야 합니다"
      }, { status: 400 })
    }

    // 권한 확인
    const userAgencyId = (session.user as any).agencyId
    const clinic = await prisma.clinic.findFirst({
      where: { id: clinicId, agencyId: userAgencyId }
    })

    if (!clinic) {
      return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 })
    }

    // 목표 타입 결정
    const goalType = month ? 'MONTHLY' : 'YEARLY'

    // 목표 설정/업데이트
    const goal = await prisma.revenueGoal.upsert({
      where: {
        clinicId_year_month: {
          clinicId,
          year,
          month
        }
      },
      create: {
        clinicId,
        year,
        month,
        goalType,
        revenueGoal,
        newPatientGoal,
        description,
        createdBy: (session.user as any).id
      },
      update: {
        revenueGoal,
        newPatientGoal,
        description,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: `${goalType === 'MONTHLY' ? '월별' : '연간'} 목표가 설정되었습니다`,
      goal
    })

  } catch (error) {
    console.error('목표 설정 실패 상세:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      clinicId,
      year,
      month,
      revenueGoal,
      newPatientGoal
    })
    return NextResponse.json({
      error: "목표 설정 중 오류가 발생했습니다",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// 목표 삭제
export async function DELETE(req: NextRequest) {
  let goalId: string | null = null

  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    // 관리자 이상 권한 필요
    const userRole = (session.user as any).role
    if (!['MASTER', 'ADMIN'].includes(userRole)) {
      return NextResponse.json({
        error: "목표 삭제는 관리자 이상만 가능합니다"
      }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    goalId = searchParams.get('goalId')

    if (!goalId) {
      return NextResponse.json({ error: "goalId가 필요합니다" }, { status: 400 })
    }

    // 권한 확인
    const userAgencyId = (session.user as any).agencyId
    const goal = await prisma.revenueGoal.findUnique({
      where: { id: goalId },
      include: { clinic: true }
    })

    if (!goal || goal.clinic.agencyId !== userAgencyId) {
      return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 })
    }

    // 목표 삭제
    await prisma.revenueGoal.delete({
      where: { id: goalId }
    })

    return NextResponse.json({
      success: true,
      message: "목표가 삭제되었습니다"
    })

  } catch (error) {
    console.error('목표 삭제 실패 상세:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      goalId
    })
    return NextResponse.json({
      error: "목표 삭제 중 오류가 발생했습니다",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}