import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { generatePatientStatsFromReception } from "@/lib/analytics/patient-stats"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    // 마스터 계정만 접근 가능
    const userRole = (session.user as any).role
    if (userRole !== "MASTER") {
      return NextResponse.json({ error: "마스터 계정만 접근할 수 있습니다" }, { status: 403 })
    }

    const { clinicId, year, month } = await req.json()

    if (!clinicId) {
      return NextResponse.json({ error: "clinicId가 필요합니다" }, { status: 400 })
    }

    console.log(`[GENERATE_API] 요청 - clinicId: ${clinicId}, year: ${year}, month: ${month}`)

    // 접수수납목록에서 환자 통계 생성
    const result = await generatePatientStatsFromReception(clinicId, year, month)

    console.log(`[GENERATE_API] 완료 - 생성: ${result.created}, 건너뜀: ${result.skipped}`)

    return NextResponse.json({
      success: true,
      message: `환자 통계가 성공적으로 생성되었습니다`,
      result: {
        created: result.created,
        skipped: result.skipped,
        errors: result.errors,
        summary: result.summary
      }
    })

  } catch (error) {
    console.error('[GENERATE_API] 오류:', error)
    return NextResponse.json({
      success: false,
      error: '환자 통계 생성 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}

// GET 요청으로 현재 상태 확인
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const clinicId = searchParams.get('clinicId')

    if (!clinicId) {
      return NextResponse.json({ error: "clinicId가 필요합니다" }, { status: 400 })
    }

    const { prisma } = await import("@/lib/db")

    // 현재 상태 확인
    const receptionCount = await prisma.receptionRecord.count({ where: { clinicId } })
    const patientStatCount = await prisma.patientStat.count({ where: { clinicId } })

    // 처리 가능한 년월 목록
    const availableMonths = await prisma.receptionRecord.findMany({
      where: { clinicId },
      select: { year: true, month: true },
      distinct: ['year', 'month'],
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    })

    return NextResponse.json({
      currentStatus: {
        receptionRecords: receptionCount,
        patientStats: patientStatCount,
        canGenerate: receptionCount > 0 && patientStatCount === 0
      },
      availableMonths,
      message: receptionCount > 0
        ? `접수수납 데이터 ${receptionCount}건에서 환자 통계 생성이 가능합니다`
        : "접수수납 데이터가 없습니다"
    })

  } catch (error) {
    console.error('[GENERATE_API GET] 오류:', error)
    return NextResponse.json({
      error: '상태 확인 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}