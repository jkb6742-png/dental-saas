import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    // 모든 클리닉 목록 조회
    const clinics = await prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        agencyId: true
      }
    })

    // 각 클리닉의 데이터 개수 확인
    const clinicsWithData = await Promise.all(
      clinics.map(async (clinic) => {
        const patientStatsCount = await prisma.patientStat.count({
          where: { clinicId: clinic.id }
        })
        const monthlySummaryCount = await prisma.monthlySummary.count({
          where: { clinicId: clinic.id }
        })

        return {
          ...clinic,
          patientStatsCount,
          monthlySummaryCount
        }
      })
    )

    return NextResponse.json({
      totalClinics: clinics.length,
      clinics: clinicsWithData
    })

  } catch (error) {
    console.error('[CLINICS DEBUG] 오류:', error)
    return NextResponse.json({
      error: '클리닉 조회 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}