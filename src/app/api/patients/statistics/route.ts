import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get("clinicId")
    const year = parseInt(searchParams.get("year") || "2026")
    const month = parseInt(searchParams.get("month") || "5")

    if (!clinicId) {
      return NextResponse.json({ error: "Clinic ID required" }, { status: 400 })
    }

    // 해당 월의 시작일과 종료일
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 1)

    // 월별 추이 데이터 (최근 6개월)
    const trendData = []
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(year, month - 1 - i, 1)
      const nextMonth = new Date(year, month - i, 1)

      // 해당 월의 ReceptionRecord 조회
      const monthlyRecords = await prisma.receptionRecord.findMany({
        where: {
          clinicId,
          receptionTime: {
            gte: targetDate,
            lt: nextMonth
          }
        }
      })

      // 신환 데이터 계산
      const newPatientRecords = monthlyRecords.filter(r => r.patientType === '신환')
      const newPatients = newPatientRecords.length
      const newPatientRevenue = newPatientRecords.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)
      const avgNewPatientRevenue = newPatients > 0 ? Math.round(newPatientRevenue / newPatients) : 0

      // 전체 데이터
      const totalPatients = monthlyRecords.length
      const returnPatients = totalPatients - newPatients
      const totalRevenue = monthlyRecords.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)

      trendData.push({
        label: `${targetDate.getFullYear()}.${String(targetDate.getMonth() + 1).padStart(2, '0')}`,
        month: targetDate.getMonth() + 1,
        year: targetDate.getFullYear(),
        newPatients,
        returnPatients,
        totalPatients,
        newPatientRevenue,
        totalRevenue,
        avgNewPatientRevenue
      })
    }

    // 요일별 분석 데이터 (선택된 월 기준)
    const monthlyRecords = await prisma.receptionRecord.findMany({
      where: {
        clinicId,
        receptionTime: {
          gte: startDate,
          lt: endDate
        }
      }
    })

    // 요일별 집계 (환자 수 + 대기시간 분석)
    const dayAnalysisMap = new Map()
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']

    monthlyRecords.forEach(record => {
      const dayOfWeek = record.receptionTime.getDay()
      const dayName = dayNames[dayOfWeek]

      if (!dayAnalysisMap.has(dayOfWeek)) {
        dayAnalysisMap.set(dayOfWeek, {
          day: dayName,
          dayOfWeek,
          newPatients: 0,
          returnPatients: 0,
          totalPatients: 0,
          waitingTimes: [], // 대기시간 배열
          avgWaitingTime: 0,
          maxWaitingTime: 0,
          minWaitingTime: 0
        })
      }

      const dayData = dayAnalysisMap.get(dayOfWeek)
      dayData.totalPatients++

      if (record.patientType === '신환') {
        dayData.newPatients++
      } else {
        dayData.returnPatients++
      }

      // 대기시간 데이터 수집 (유효한 값만)
      if (record.waitingTime !== null && record.waitingTime !== undefined && record.waitingTime >= 0) {
        dayData.waitingTimes.push(record.waitingTime)
      }
    })

    // 요일별 대기시간 통계 계산
    const dayAnalysis = Array.from(dayAnalysisMap.values())
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map(dayData => {
        const { waitingTimes, ...rest } = dayData

        if (waitingTimes.length > 0) {
          const avgWaitingTime = Math.round(waitingTimes.reduce((sum, time) => sum + time, 0) / waitingTimes.length * 10) / 10
          const maxWaitingTime = Math.max(...waitingTimes)
          const minWaitingTime = Math.min(...waitingTimes)

          return {
            ...rest,
            avgWaitingTime,
            maxWaitingTime,
            minWaitingTime,
            waitingTimeCount: waitingTimes.length
          }
        } else {
          return {
            ...rest,
            avgWaitingTime: 0,
            maxWaitingTime: 0,
            minWaitingTime: 0,
            waitingTimeCount: 0
          }
        }
      })

    // 시간대별 분석 데이터 (선택된 월 기준)
    const timeAnalysisMap = new Map()

    monthlyRecords.forEach(record => {
      const hour = record.receptionTime.getHours()
      const timeSlot = `${String(hour).padStart(2, '0')}시`

      if (!timeAnalysisMap.has(hour)) {
        timeAnalysisMap.set(hour, {
          hour,
          timeSlot,
          patientCount: 0
        })
      }

      timeAnalysisMap.get(hour).patientCount++
    })

    const timeAnalysis = Array.from(timeAnalysisMap.values())
      .sort((a, b) => a.hour - b.hour)

    return NextResponse.json({
      trendData,
      dayAnalysis,
      timeAnalysis,
      summary: {
        totalRecords: monthlyRecords.length,
        newPatients: monthlyRecords.filter(r => r.patientType === '신환').length,
        totalRevenue: monthlyRecords.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)
      }
    })

  } catch (error) {
    console.error("환자 통계 조회 실패:", error)
    return NextResponse.json({ error: "환자 통계 조회 실패" }, { status: 500 })
  }
}