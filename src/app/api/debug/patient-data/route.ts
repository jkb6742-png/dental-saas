import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const clinicId = searchParams.get('clinicId')

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId가 필요합니다' }, { status: 400 })
    }

    console.log(`[DEBUG API] clinicId: ${clinicId}`)

    // 1. 기본 통계
    const patientStatsCount = await prisma.patientStat.count({ where: { clinicId } })
    const monthlySummaryCount = await prisma.monthlySummary.count({ where: { clinicId } })
    const receptionRecordsCount = await prisma.receptionRecord.count({ where: { clinicId } })

    console.log(`[DEBUG API] PatientStat: ${patientStatsCount}개`)
    console.log(`[DEBUG API] MonthlySummary: ${monthlySummaryCount}개`)
    console.log(`[DEBUG API] ReceptionRecord: ${receptionRecordsCount}개`)

    // 2. 최근 PatientStat 데이터
    const recentPatientStats = await prisma.patientStat.findMany({
      where: { clinicId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { date: 'desc' }],
      take: 5
    })

    // 3. 최근 MonthlySummary 데이터
    const recentMonthlySummary = await prisma.monthlySummary.findMany({
      where: { clinicId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 5
    })

    // 4. 사용 가능한 년월
    const availableYearMonths = await prisma.patientStat.findMany({
      where: { clinicId },
      select: { year: true, month: true },
      distinct: ['year', 'month'],
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    })

    // 5. 클리닉 정보
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true, name: true, code: true, agencyId: true }
    })

    return NextResponse.json({
      clinic,
      counts: {
        patientStats: patientStatsCount,
        monthlySummary: monthlySummaryCount,
        receptionRecords: receptionRecordsCount
      },
      recentData: {
        patientStats: recentPatientStats,
        monthlySummary: recentMonthlySummary
      },
      availableYearMonths,
      currentYear: new Date().getFullYear(),
      currentMonth: new Date().getMonth() + 1
    })

  } catch (error) {
    console.error('[DEBUG API] 오류:', error)
    return NextResponse.json({
      error: '데이터 조회 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}