import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const clinicId = url.searchParams.get('clinicId')
    const year = parseInt(url.searchParams.get('year') || '2026')
    const type = url.searchParams.get('type') || 'total' // new, returning, total

    console.log(`[월별객단가] 조회 시작 - 클리닉: ${clinicId}, ${year}년, 타입: ${type}`)

    if (!clinicId) {
      return NextResponse.json({
        error: 'clinicId가 필요합니다.'
      }, { status: 400 })
    }

    if (!['new', 'returning', 'total'].includes(type)) {
      return NextResponse.json({
        error: '올바른 차트 타입을 선택해주세요. (new, returning, total)'
      }, { status: 400 })
    }

    // 연간 접수 기록 조회 (매출 포함)
    const receptionRecords = await prisma.receptionRecord.findMany({
      where: {
        clinicId,
        year,
        month: {
          gte: 1,
          lte: 12
        }
      },
      select: {
        month: true,
        patientType: true,
        chartNumber: true,
        patientName: true,
        totalRevenue: true
      }
    })

    console.log(`[월별객단가] 총 접수기록: ${receptionRecords.length}건`)

    // 월별 1인 객단가 계산
    const monthlyData = Array.from({length: 12}, (_, i) => {
      const month = i + 1
      const monthRecords = receptionRecords.filter(record => record.month === month)

      let uniquePatients = []
      let totalRevenue = 0

      if (type === 'new') {
        // 신환만 필터링
        const newPatients = monthRecords.filter(record => {
          const patientType = String(record.patientType || '').trim().toLowerCase()
          return patientType.includes('신환') || patientType === 'new' || patientType === '신'
        })
        // 중복 제거
        uniquePatients = Array.from(
          new Map(newPatients.map(p => [p.chartNumber, p])).values()
        )
        // 신환 매출 합계
        totalRevenue = newPatients.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)
      } else if (type === 'returning') {
        // 구환만 필터링
        const returningPatients = monthRecords.filter(record => {
          const patientType = String(record.patientType || '').trim().toLowerCase()
          return patientType.includes('구환') || patientType === 'returning' ||
                 patientType === '구' || patientType.includes('재진') || patientType === 'return'
        })
        // 중복 제거
        uniquePatients = Array.from(
          new Map(returningPatients.map(p => [p.chartNumber, p])).values()
        )
        // 구환 매출 합계
        totalRevenue = returningPatients.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)
      } else {
        // 전체 환자 (중복 제거)
        uniquePatients = Array.from(
          new Map(monthRecords.map(p => [p.chartNumber, p])).values()
        )
        // 전체 매출 합계
        totalRevenue = monthRecords.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)
      }

      // 1인 객단가 계산
      const revenuePerPatient = uniquePatients.length > 0 ? Math.round(totalRevenue / uniquePatients.length) : 0

      return {
        month,
        revenuePerPatient,
        patientCount: uniquePatients.length,
        totalRevenue
      }
    })

    console.log(`[월별객단가] ${type} 타입 결과:`,
      monthlyData.map(d => `${d.month}월: ${d.revenuePerPatient.toLocaleString()}원 (${d.patientCount}명)`).join(', '))

    // 통계 요약
    const totalPatients = monthlyData.reduce((sum, d) => sum + d.patientCount, 0)
    const totalRevenue = monthlyData.reduce((sum, d) => sum + d.totalRevenue, 0)
    const overallRevenuePerPatient = totalPatients > 0 ? Math.round(totalRevenue / totalPatients) : 0

    // 월평균 객단가
    const validMonths = monthlyData.filter(d => d.patientCount > 0)
    const avgRevenuePerPatient = validMonths.length > 0
      ? Math.round(validMonths.reduce((sum, d) => sum + d.revenuePerPatient, 0) / validMonths.length)
      : 0

    // 최고/최저 월
    const maxMonth = monthlyData.reduce((max, d) =>
      (d.patientCount > 0 && d.revenuePerPatient > max.revenuePerPatient) ? d : max,
      monthlyData.find(d => d.patientCount > 0) || monthlyData[0]
    )
    const minMonth = monthlyData.reduce((min, d) =>
      (d.patientCount > 0 && d.revenuePerPatient < min.revenuePerPatient) ? d : min,
      monthlyData.find(d => d.patientCount > 0) || monthlyData[0]
    )

    const result = {
      year,
      type,
      data: monthlyData,
      summary: {
        totalPatients,
        totalRevenue,
        overallRevenuePerPatient,
        averageRevenuePerPatient: avgRevenuePerPatient,
        peakMonth: {
          month: maxMonth.month,
          revenuePerPatient: maxMonth.revenuePerPatient,
          patientCount: maxMonth.patientCount
        },
        lowestMonth: {
          month: minMonth.month,
          revenuePerPatient: minMonth.revenuePerPatient,
          patientCount: minMonth.patientCount
        },
        hasData: totalPatients > 0
      }
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      summary: result.summary
    })

  } catch (error) {
    console.error('[월별객단가] 오류:', error)
    return NextResponse.json({
      error: '월별 1인 객단가 데이터 조회 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}