import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const clinicId = url.searchParams.get('clinicId')
    const year = parseInt(url.searchParams.get('year') || '2026')
    const type = url.searchParams.get('type') || 'total' // new, returning, total

    console.log(`[월별차트] 조회 시작 - 클리닉: ${clinicId}, ${year}년, 타입: ${type}`)

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

    // 연간 접수 기록 전체 조회 (월별 그룹화)
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
        patientName: true
      }
    })

    console.log(`[월별차트] 총 접수기록: ${receptionRecords.length}건`)

    // 월별 데이터 집계
    const monthlyData = Array.from({length: 12}, (_, i) => {
      const month = i + 1
      const monthRecords = receptionRecords.filter(record => record.month === month)

      let patientCount = 0

      if (type === 'new') {
        // 신환만 필터링
        const newPatients = monthRecords.filter(record => {
          const patientType = String(record.patientType || '').trim().toLowerCase()
          return patientType.includes('신환') || patientType === 'new' || patientType === '신'
        })
        // 중복 제거
        const uniqueNewPatients = Array.from(
          new Map(newPatients.map(p => [p.chartNumber, p])).values()
        )
        patientCount = uniqueNewPatients.length
      } else if (type === 'returning') {
        // 구환만 필터링
        const returningPatients = monthRecords.filter(record => {
          const patientType = String(record.patientType || '').trim().toLowerCase()
          return patientType.includes('구환') || patientType === 'returning' ||
                 patientType === '구' || patientType.includes('재진') || patientType === 'return'
        })
        // 중복 제거
        const uniqueReturningPatients = Array.from(
          new Map(returningPatients.map(p => [p.chartNumber, p])).values()
        )
        patientCount = uniqueReturningPatients.length
      } else {
        // 전체 환자 (중복 제거)
        const allUniquePatients = Array.from(
          new Map(monthRecords.map(p => [p.chartNumber, p])).values()
        )
        patientCount = allUniquePatients.length
      }

      return {
        month,
        count: patientCount
      }
    })

    console.log(`[월별차트] ${type} 타입 결과:`, monthlyData.map(d => `${d.month}월: ${d.count}명`).join(', '))

    // 월별 통계 요약
    const totalPatients = monthlyData.reduce((sum, d) => sum + d.count, 0)
    const avgMonthly = totalPatients / 12

    // 데이터가 있는 월들만 필터링해서 최대/최소 계산
    const monthsWithData = monthlyData.filter(d => d.count > 0)
    const maxMonth = monthsWithData.length > 0
      ? monthsWithData.reduce((max, d) => d.count > max.count ? d : max, monthsWithData[0])
      : monthlyData[0]
    const minMonth = monthsWithData.length > 0
      ? monthsWithData.reduce((min, d) => d.count < min.count ? d : min, monthsWithData[0])
      : monthlyData[0]

    const result = {
      year,
      type,
      data: monthlyData,
      summary: {
        totalPatients,
        averageMonthly: Math.round(avgMonthly * 10) / 10,
        peakMonth: maxMonth,
        lowestMonth: minMonth,
        hasData: totalPatients > 0
      },
      debug: {
        totalRecords: receptionRecords.length,
        message: receptionRecords.length === 0 ?
          '접수 기록이 없습니다. 전체접수수납목록.xlsx 파일을 업로드해주세요.' :
          `${year}년 ${type} 환자 월별 데이터 로딩 완료`
      }
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      summary: result.summary,
      debug: result.debug
    })

  } catch (error) {
    console.error('[월별차트] 오류:', error)
    return NextResponse.json({
      error: '월별 차트 데이터 조회 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}