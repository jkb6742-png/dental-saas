import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const clinicId = url.searchParams.get('clinicId')
    const year = parseInt(url.searchParams.get('year') || '2026')
    const month = parseInt(url.searchParams.get('month') || '5')

    console.log(`[환자통계] 조회 시작 - 클리닉: ${clinicId}, ${year}년 ${month}월`)

    if (!clinicId) {
      return NextResponse.json({
        error: 'clinicId가 필요합니다.'
      }, { status: 400 })
    }

    // 당월 접수 기록 전체 조회
    const receptionRecords = await prisma.receptionRecord.findMany({
      where: {
        clinicId,
        year,
        month
      },
      select: {
        patientType: true,
        patientName: true,
        chartNumber: true,
        receptionTime: true,
        totalRevenue: true,
        waitingTime: true
      }
    })

    console.log(`[환자통계] 총 접수기록: ${receptionRecords.length}건`)

    // 신환/구환 분류 (정확한 키워드 매칭)
    const newPatients = receptionRecords.filter(record => {
      const type = String(record.patientType || '').trim().toLowerCase()
      return type.includes('신환') || type === 'new' || type === '신'
    })

    const returningPatients = receptionRecords.filter(record => {
      const type = String(record.patientType || '').trim().toLowerCase()
      return type.includes('구환') || type === 'returning' || type === '구' ||
             type.includes('재진') || type === 'return'
    })

    // 올바른 환자 분류: 환자별로 신환/구환 판단 (중복 방지)
    const patientGroups = new Map()
    receptionRecords.forEach(record => {
      const chartNumber = record.chartNumber
      if (!patientGroups.has(chartNumber)) {
        patientGroups.set(chartNumber, [])
      }
      patientGroups.get(chartNumber).push(record)
    })

    let uniqueNewPatientCount = 0
    let uniqueReturningPatientCount = 0

    // 각 환자별로 신환/구환 판단
    patientGroups.forEach((visits, chartNumber) => {
      // 이 환자의 모든 방문 중에서 신환 타입이 있는지 확인
      const hasNewPatientVisit = visits.some(visit => {
        const type = String(visit.patientType || '').trim().toLowerCase()
        return type.includes('신환') || type === 'new' || type === '신'
      })

      if (hasNewPatientVisit) {
        uniqueNewPatientCount++
      } else {
        uniqueReturningPatientCount++
      }
    })

    const allUniquePatients = Array.from(patientGroups.keys())

    // 기존 변수명 유지를 위한 더미 배열
    const uniqueNewPatients = Array.from({ length: uniqueNewPatientCount }, (_, i) => ({ chartNumber: `new_${i}` }))
    const uniqueReturningPatients = Array.from({ length: uniqueReturningPatientCount }, (_, i) => ({ chartNumber: `returning_${i}` }))

    // 디버깅 정보
    const patientTypes = [...new Set(receptionRecords.map(r => r.patientType).filter(Boolean))]
    console.log(`[환자통계] 발견된 환자 유형:`, patientTypes)
    console.log(`[환자통계] 신환 분류: ${uniqueNewPatientCount}명`)
    console.log(`[환자통계] 구환 분류: ${uniqueReturningPatientCount}명`)
    console.log(`[환자통계] 전체 고유 환자: ${allUniquePatients.length}명`)

    // 매출 정보
    const newPatientRevenue = newPatients.reduce((sum, p) => sum + (p.totalRevenue || 0), 0)
    const returningPatientRevenue = returningPatients.reduce((sum, p) => sum + (p.totalRevenue || 0), 0)
    const totalRevenue = newPatientRevenue + returningPatientRevenue

    // 요일별 대기시간 통계 (일~토 전체, 0분은 제외)
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const weekdayWaitingStats = {};

    // 일요일~토요일 (0~6) 전체 처리
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const dayRecords = receptionRecords.filter(record => {
        if (!record.receptionTime || !record.waitingTime || record.waitingTime <= 0) return false;

        const date = new Date(record.receptionTime);
        return date.getDay() === dayOfWeek;
      });

      if (dayRecords.length > 0) {
        const waitingTimes = dayRecords.map(r => r.waitingTime);
        const avgTime = waitingTimes.reduce((a, b) => a + b, 0) / waitingTimes.length;
        const maxTime = Math.max(...waitingTimes);

        weekdayWaitingStats[dayNames[dayOfWeek]] = {
          avg: Math.round(avgTime * 10) / 10, // 소수점 1자리
          max: maxTime,
          count: dayRecords.length
        };
      } else {
        weekdayWaitingStats[dayNames[dayOfWeek]] = {
          avg: 0,
          max: 0,
          count: 0
        };
      }
    }

    // 신환별 요일별 대기시간 통계
    const newPatientWaitingStats = {};
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const dayRecords = receptionRecords.filter(record => {
        if (!record.receptionTime || !record.waitingTime || record.waitingTime <= 0) return false;

        const date = new Date(record.receptionTime);
        const type = String(record.patientType || '').trim().toLowerCase();
        const isNewPatient = type.includes('신환') || type === 'new' || type === '신';

        return date.getDay() === dayOfWeek && isNewPatient;
      });

      if (dayRecords.length > 0) {
        const waitingTimes = dayRecords.map(r => r.waitingTime);
        const avgTime = waitingTimes.reduce((a, b) => a + b, 0) / waitingTimes.length;
        const maxTime = Math.max(...waitingTimes);

        newPatientWaitingStats[dayNames[dayOfWeek]] = {
          avg: Math.round(avgTime * 10) / 10,
          max: maxTime,
          count: dayRecords.length
        };
      } else {
        newPatientWaitingStats[dayNames[dayOfWeek]] = {
          avg: 0,
          max: 0,
          count: 0
        };
      }
    }

    // 구환별 요일별 대기시간 통계
    const returningPatientWaitingStats = {};
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const dayRecords = receptionRecords.filter(record => {
        if (!record.receptionTime || !record.waitingTime || record.waitingTime <= 0) return false;

        const date = new Date(record.receptionTime);
        const type = String(record.patientType || '').trim().toLowerCase();
        const isReturningPatient = type.includes('구환') || type === 'returning' || type === '구' ||
                                 type.includes('재진') || type === 'return';

        return date.getDay() === dayOfWeek && isReturningPatient;
      });

      if (dayRecords.length > 0) {
        const waitingTimes = dayRecords.map(r => r.waitingTime);
        const avgTime = waitingTimes.reduce((a, b) => a + b, 0) / waitingTimes.length;
        const maxTime = Math.max(...waitingTimes);

        returningPatientWaitingStats[dayNames[dayOfWeek]] = {
          avg: Math.round(avgTime * 10) / 10,
          max: maxTime,
          count: dayRecords.length
        };
      } else {
        returningPatientWaitingStats[dayNames[dayOfWeek]] = {
          avg: 0,
          max: 0,
          count: 0
        };
      }
    }

    // 전체 평균/최대 (참고용 - 0분 제외)
    const allValidWaitingTimes = receptionRecords.filter(r =>
      r.waitingTime &&
      typeof r.waitingTime === 'number' &&
      r.waitingTime > 0 &&
      !isNaN(r.waitingTime)
    );

    const overallAvgWaitingTime = allValidWaitingTimes.length > 0
      ? allValidWaitingTimes.reduce((sum, r) => sum + (r.waitingTime || 0), 0) / allValidWaitingTimes.length
      : 0;

    const overallMaxWaitingTime = allValidWaitingTimes.length > 0
      ? Math.max(...allValidWaitingTimes.map(r => r.waitingTime || 0))
      : 0;

    // 데이터가 없어도 항상 0으로 기본값 제공
    const result = {
      year,
      month,
      period: `${year}년 ${month}월`,
      hasData: receptionRecords.length > 0,

      // 기본 통계 (사용자 요구사항) - 데이터 없으면 0
      newPatientCount: uniqueNewPatientCount || 0,          // 당월 신환 총인원
      returningPatientCount: uniqueReturningPatientCount || 0, // 당월 구환 총인원
      totalPatientCount: allUniquePatients.length || 0,        // 신환+구환 합친 총인원

      // 추가 정보 - 데이터 없으면 0
      newPatientVisits: newPatients.length || 0,               // 신환 방문수
      returningPatientVisits: returningPatients.length || 0,  // 구환 방문수
      totalVisits: receptionRecords.length || 0,              // 총 방문수

      // 매출 정보 - 데이터 없으면 0
      newPatientRevenue: newPatientRevenue || 0,
      returningPatientRevenue: returningPatientRevenue || 0,
      totalRevenue: totalRevenue || 0,

      // 요일별 대기시간 통계 (전체)
      weekdayWaitingStats: weekdayWaitingStats,

      // 신환 요일별 대기시간 통계
      newPatientWaitingStats: newPatientWaitingStats,

      // 구환 요일별 대기시간 통계
      returningPatientWaitingStats: returningPatientWaitingStats,

      // 전체 대기시간 정보 (참고용)
      overallAvgWaitingTime: Math.round(overallAvgWaitingTime * 10) / 10 || 0,
      overallMaxWaitingTime: overallMaxWaitingTime || 0,

      // 디버깅 정보
      debug: {
        allPatientTypes: patientTypes,
        sampleNewPatient: uniqueNewPatients[0] || null,
        sampleReturningPatient: uniqueReturningPatients[0] || null,
        totalRecords: receptionRecords.length,
        message: receptionRecords.length === 0 ?
          '접수 기록이 없습니다. 엑셀 파일을 업로드해주세요.' :
          '데이터 로딩 완료'
      }
    }

    console.log(`[환자통계] 결과:`, result)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('[환자통계] 오류:', error)
    return NextResponse.json({
      error: '환자 통계 조회 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}