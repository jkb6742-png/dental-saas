import { prisma } from "@/lib/db"

/**
 * ReceptionRecord 데이터에서 PatientStat 데이터를 생성
 * 올바른 신환/구환 정의를 사용하여 정확한 통계 생성
 */
export async function generatePatientStatsFromReception(clinicId: string, year?: number, month?: number) {
  console.log(`[PATIENT_STATS_GEN] 시작 - clinicId: ${clinicId}, year: ${year}, month: ${month}`)

  try {
    // 조건 설정
    const whereCondition: any = { clinicId }
    if (year) whereCondition.year = year
    if (month) whereCondition.month = month

    // ReceptionRecord에서 데이터 가져오기 (정렬 중요)
    const receptionRecords = await prisma.receptionRecord.findMany({
      where: whereCondition,
      select: {
        receptionTime: true,
        patientName: true,
        chartNumber: true,
        patientType: true,
        year: true,
        month: true
      },
      orderBy: { receptionTime: 'asc' }
    })

    console.log(`[PATIENT_STATS_GEN] ReceptionRecord 개수: ${receptionRecords.length}`)

    if (receptionRecords.length === 0) {
      console.log(`[PATIENT_STATS_GEN] 접수 데이터가 없어서 종료`)
      return { created: 0, skipped: 0, errors: [] }
    }

    // 전체 환자의 최초 방문일 추적을 위한 맵
    const patientFirstVisit = new Map<string, Date>()

    // 모든 ReceptionRecord를 조회해서 각 환자의 최초 방문일 파악
    const allRecords = await prisma.receptionRecord.findMany({
      where: { clinicId },
      select: {
        receptionTime: true,
        patientName: true,
        chartNumber: true
      },
      orderBy: { receptionTime: 'asc' }
    })

    // 환자별 최초 방문일 계산
    allRecords.forEach(record => {
      if (!record.receptionTime) return

      const patientId = record.chartNumber || record.patientName || 'unknown'
      const visitDate = new Date(record.receptionTime)

      if (!patientFirstVisit.has(patientId) || visitDate < patientFirstVisit.get(patientId)!) {
        patientFirstVisit.set(patientId, visitDate)
      }
    })

    console.log(`[PATIENT_STATS_GEN] 총 고유 환자 수: ${patientFirstVisit.size}`)

    // 월별 신환/구환 분석
    const monthlyStats = new Map<string, {
      year: number
      month: number
      dailyStats: Map<string, {
        date: Date
        totalVisits: number
        newPatients: Set<string>
        returningPatients: Set<string>
        allPatients: Set<string>
      }>
    }>()

    // 대상 기간의 데이터 처리
    receptionRecords.forEach(record => {
      if (!record.receptionTime) return

      const visitDate = new Date(record.receptionTime)
      const patientId = record.chartNumber || record.patientName || 'unknown'
      const firstVisit = patientFirstVisit.get(patientId)

      if (!firstVisit) return

      const monthKey = `${record.year}-${record.month}`
      const dateKey = visitDate.toISOString().split('T')[0]

      // 월별 통계 초기화
      if (!monthlyStats.has(monthKey)) {
        monthlyStats.set(monthKey, {
          year: record.year!,
          month: record.month!,
          dailyStats: new Map()
        })
      }

      const monthStat = monthlyStats.get(monthKey)!

      // 일별 통계 초기화
      if (!monthStat.dailyStats.has(dateKey)) {
        monthStat.dailyStats.set(dateKey, {
          date: visitDate,
          totalVisits: 0,
          newPatients: new Set(),
          returningPatients: new Set(),
          allPatients: new Set()
        })
      }

      const dayStat = monthStat.dailyStats.get(dateKey)!
      dayStat.totalVisits++
      dayStat.allPatients.add(patientId)

      // 올바른 신환 판정: 해당 월이 환자의 최초 방문 월인 경우
      const firstVisitMonth = `${firstVisit.getFullYear()}-${firstVisit.getMonth() + 1}`
      if (firstVisitMonth === monthKey) {
        dayStat.newPatients.add(patientId)
      } else {
        dayStat.returningPatients.add(patientId)
      }
    })

    // PatientStat 레코드 생성
    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const [monthKey, monthStat] of monthlyStats) {
      const workingDays = monthStat.dailyStats.size

      for (const [dateKey, dayStat] of monthStat.dailyStats) {
        try {
          const patientStat = {
            clinicId,
            date: dayStat.date,
            month: monthStat.month,
            year: monthStat.year,
            workingDays: 1, // 해당 날짜는 1일
            newPatients: dayStat.newPatients.size,
            totalVisits: dayStat.totalVisits,
            totalAppointments: dayStat.totalVisits, // 접수수납 = 예약으로 간주
            avgDailyNewPatients: dayStat.newPatients.size,
            avgDailyAppointments: dayStat.totalVisits
          }

          // DB에 저장 (upsert로 중복 방지)
          await prisma.patientStat.upsert({
            where: {
              clinicId_date: {
                clinicId,
                date: dayStat.date
              }
            },
            create: patientStat,
            update: patientStat
          })

          created++

          console.log(`[PATIENT_STATS_GEN] 생성: ${dateKey} - 신환 ${dayStat.newPatients.size}, 구환 ${dayStat.returningPatients.size}, 총방문 ${dayStat.totalVisits}`)

        } catch (error) {
          console.error(`[PATIENT_STATS_GEN] 날짜 ${dateKey} 처리 중 오류:`, error)
          errors.push(`${dateKey}: ${error}`)
          skipped++
        }
      }

      // 월간 요약 업데이트
      await updateMonthlySummaryPatientFields(clinicId, monthStat.year, monthStat.month, monthStat.dailyStats)
    }

    console.log(`[PATIENT_STATS_GEN] 완료 - 생성: ${created}, 건너뜀: ${skipped}`)

    return {
      created,
      skipped,
      errors,
      summary: {
        totalDays: created,
        monthsProcessed: monthlyStats.size
      }
    }

  } catch (error) {
    console.error(`[PATIENT_STATS_GEN] 전체 오류:`, error)
    throw error
  }
}

/**
 * MonthlySummary의 환자 관련 필드를 올바른 로직으로 업데이트
 */
async function updateMonthlySummaryPatientFields(
  clinicId: string,
  year: number,
  month: number,
  dailyStats?: Map<string, any>
) {
  try {
    let monthlyNewPatients = 0
    let monthlyTotalPatients = 0
    let workingDays = 0

    if (dailyStats) {
      // 이미 계산된 일별 통계 사용
      const allNewPatients = new Set<string>()
      const allPatients = new Set<string>()

      dailyStats.forEach(dayStat => {
        workingDays++
        dayStat.newPatients.forEach((p: string) => allNewPatients.add(p))
        dayStat.allPatients.forEach((p: string) => allPatients.add(p))
      })

      monthlyNewPatients = allNewPatients.size
      monthlyTotalPatients = allPatients.size
    } else {
      // ReceptionRecord에서 직접 계산
      const monthlyRecords = await prisma.receptionRecord.findMany({
        where: { clinicId, year, month },
        select: {
          receptionTime: true,
          patientName: true,
          chartNumber: true
        },
        orderBy: { receptionTime: 'asc' }
      })

      // 전체 환자의 최초 방문일 조회
      const allRecords = await prisma.receptionRecord.findMany({
        where: { clinicId },
        select: {
          receptionTime: true,
          patientName: true,
          chartNumber: true
        },
        orderBy: { receptionTime: 'asc' }
      })

      const patientFirstVisit = new Map<string, Date>()
      allRecords.forEach(record => {
        if (!record.receptionTime) return
        const patientId = record.chartNumber || record.patientName || 'unknown'
        const visitDate = new Date(record.receptionTime)

        if (!patientFirstVisit.has(patientId) || visitDate < patientFirstVisit.get(patientId)!) {
          patientFirstVisit.set(patientId, visitDate)
        }
      })

      // 해당 월의 신환/총환자 계산
      const monthNewPatients = new Set<string>()
      const monthAllPatients = new Set<string>()
      const workingDaysSet = new Set<string>()

      monthlyRecords.forEach(record => {
        if (!record.receptionTime) return

        const patientId = record.chartNumber || record.patientName || 'unknown'
        const visitDate = new Date(record.receptionTime)
        const firstVisit = patientFirstVisit.get(patientId)

        monthAllPatients.add(patientId)
        workingDaysSet.add(visitDate.toISOString().split('T')[0])

        // 신환 판정: 최초 방문이 이번 달인 경우
        if (firstVisit) {
          const firstVisitMonth = firstVisit.getFullYear() === year && (firstVisit.getMonth() + 1) === month
          if (firstVisitMonth) {
            monthNewPatients.add(patientId)
          }
        }
      })

      monthlyNewPatients = monthNewPatients.size
      monthlyTotalPatients = monthAllPatients.size
      workingDays = workingDaysSet.size
    }

    const returningPatients = Math.max(0, monthlyTotalPatients - monthlyNewPatients)
    const revisitRate = monthlyTotalPatients > 0 ? (returningPatients / monthlyTotalPatients) * 100 : 0

    // MonthlySummary 업데이트
    await prisma.monthlySummary.updateMany({
      where: { clinicId, year, month },
      data: {
        newPatients: monthlyNewPatients,
        totalPatients: monthlyTotalPatients,
        workingDays: workingDays,
        revisitRate: revisitRate
      }
    })

    console.log(`[MONTHLY_UPDATE] ${year}년 ${month}월 - 신환: ${monthlyNewPatients}, 구환: ${returningPatients}, 총환자: ${monthlyTotalPatients}, 재방문율: ${revisitRate.toFixed(1)}%`)

  } catch (error) {
    console.error(`[MONTHLY_UPDATE] ${year}년 ${month}월 업데이트 오류:`, error)
  }
}