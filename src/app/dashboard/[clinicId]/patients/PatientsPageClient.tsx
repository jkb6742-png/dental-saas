"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"
import YearMonthFilter from "@/components/ui/YearMonthFilter"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, BarChart, Bar, ComposedChart, Cell, PieChart, Pie } from "recharts"
import { Users, UserPlus, Activity, DollarSign, TrendingUp, Calendar, Clock, Target, AlertTriangle, CheckCircle } from "lucide-react"

type PatientStatData = {
  id: string
  clinicId: string
  date: Date
  month: number
  year: number
  workingDays: number | null
  newPatients: number | null
  totalVisits: number | null
  totalAppointments: number | null
  avgDailyNewPatients: number | null
  avgDailyAppointments: number | null
  createdAt: Date
}

type MonthlySummaryData = {
  id: string
  clinicId: string
  year: number
  month: number
  totalRevenue: number | null
  totalExpense: number | null
  netProfit: number | null
  newPatients: number | null
  totalPatients: number | null
  workingDays: number | null
  avgDailyRevenue: number | null
  newPatientRevenue: number | null
  revisitRate: number | null
  nonInsuranceRatio: number | null
  revenueGrowth: number | null
  newPatientGrowth: number | null
  totalArrears: number | null
  arrearsRate: number | null
  treatmentCompleteRate: number | null
  createdAt: Date
  updatedAt: Date
}

type AvailableData = {
  year: number
  month: number
}

type ReceptionRecordData = {
  receptionTime: Date | null
  patientName: string | null
  chartNumber: string | null
  patientType: string | null
  totalRevenue: number | null
  createdAt: Date
}

type TreatmentPlanData = {
  patientName: string
  chartNumber: string | null
  writtenDate: Date | null
  lastVisit: Date | null
  nextAppointment: Date | null
  status: string | null
  paymentStatus: string | null
  contractAmount: number | null
  remainingAmount: number | null
}

type HistoricalReceptionData = {
  patientName: string | null
  chartNumber: string | null
  receptionTime: Date | null
  patientType: string | null
}

interface PatientsPageClientProps {
  clinicId: string
  initialYear: number
  initialMonth: number
  yearlyData: PatientStatData[]
  monthlyData: PatientStatData[]
  availableData: AvailableData[]
  fallbackData: MonthlySummaryData[] | null
  receptionRecords: ReceptionRecordData[]
  treatmentPlans: TreatmentPlanData[]
  historicalReceptionData: HistoricalReceptionData[]
}

// 금액 포맷팅 함수
const formatAmount = (amount: number): string => {
  if (amount >= 100000000) { // 1억 이상
    const billions = Math.floor(amount / 100000000);
    const remainder = amount % 100000000;
    if (remainder === 0) {
      return `${billions}억원`;
    } else {
      const thousands = Math.round(remainder / 10000);
      if (thousands === 0) {
        return `${billions}억원`;
      }
      return `${billions}억 ${thousands.toLocaleString()}만원`;
    }
  } else { // 1억 미만
    const thousands = Math.round(amount / 10000);
    if (thousands === 0) {
      return "0원";
    }
    return `${thousands.toLocaleString()}만원`;
  }
}

export default function PatientsPageClient({
  clinicId,
  initialYear,
  initialMonth,
  yearlyData,
  monthlyData,
  availableData,
  fallbackData,
  receptionRecords,
  treatmentPlans,
  historicalReceptionData
}: PatientsPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)

  // URL 업데이트 (무한 루프 방지)
  useEffect(() => {
    const currentParams = new URLSearchParams(searchParams.toString())
    const currentYear = currentParams.get('year')
    const currentMonth = currentParams.get('month')

    // 현재 URL 파라미터와 상태가 다를 때만 업데이트
    if (currentYear !== selectedYear.toString() || currentMonth !== selectedMonth.toString()) {
      const params = new URLSearchParams()
      params.set('year', selectedYear.toString())
      params.set('month', selectedMonth.toString())
      router.replace(`/dashboard/${clinicId}/patients?${params.toString()}`)
    }
  }, [selectedYear, selectedMonth, clinicId, router, searchParams])

  // 연간 월별 추이 데이터 생성 (MonthlySummary 우선 - 정확한 고유 환자 수)
  const createYearlyTrendData = () => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1)

    // MonthlySummary 데이터 우선 사용 (올바른 고유 환자 수 계산)
    if (fallbackData && fallbackData.length > 0) {
      return months.map(month => {
        const data = fallbackData.find(d => d.month === month)
        const newPatients = data?.newPatients || 0
        const totalPatients = data?.totalPatients || 0
        const returningPatients = Math.max(0, totalPatients - newPatients)

        return {
          month: `${month}월`,
          신환수: newPatients,
          구환수: returningPatients,
          총환자수: totalPatients,
          신환진료비: data?.newPatientRevenue || 0,
          재내원율: Math.round((data?.revisitRate || 0) * 100) / 100,
          신환성장률: Math.round((data?.newPatientGrowth || 0) * 100) / 100
        }
      })
    }

    // PatientStat 데이터만 있을 때 (방문수 위주 - 고유 환자수 표시 안 함)
    else if (yearlyData.length > 0) {
      return months.map(month => {
        const monthlyDataForMonth = yearlyData.filter(d => d.month === month)
        const totalVisits = monthlyDataForMonth.reduce((sum, d) => sum + (d.totalVisits || 0), 0)
        const totalAppointments = monthlyDataForMonth.reduce((sum, d) => sum + (d.totalAppointments || 0), 0)
        const avgDailyNewPatients = monthlyDataForMonth.length > 0
          ? monthlyDataForMonth.reduce((sum, d) => sum + (d.avgDailyNewPatients || 0), 0) / monthlyDataForMonth.length
          : 0

        return {
          month: `${month}월`,
          총방문수: totalVisits,
          예약수: totalAppointments,
          일평균신환: Math.round(avgDailyNewPatients * 10) / 10,
          // 신환수는 일별 데이터 합산으로 정확하지 않으므로 제외
          신환수: 0,
          구환수: 0,
          총환자수: 0
        }
      })
    }

    return []
  }

  // 월간 상세 일별 데이터
  const monthlyChartData = monthlyData.map(data => ({
    date: new Date(data.date).getDate(),
    신환수: data.newPatients || 0,
    총방문수: data.totalVisits || 0,
    예약수: data.totalAppointments || 0
  }))

  // 현재 월 통계 계산 (MonthlySummary 우선, 없으면 PatientStat에서 올바른 계산)
  const getCurrentMonthStats = () => {
    // MonthlySummary 데이터 우선 사용 (올바른 고유 환자 수 계산)
    if (fallbackData && fallbackData.length > 0) {
      const currentMonthData = fallbackData.find(d => d.year === selectedYear && d.month === selectedMonth)
      if (currentMonthData) {
        const newPatients = currentMonthData.newPatients || 0
        const totalPatients = currentMonthData.totalPatients || 0
        const returningPatients = Math.max(0, totalPatients - newPatients)
        const newPatientRevenue = currentMonthData.newPatientRevenue || 0
        const avgDailyNewPatients = (currentMonthData.workingDays || 0) > 0 ? newPatients / (currentMonthData.workingDays || 1) : 0

        return {
          신환내원: newPatients,
          구환내원: returningPatients,
          내원환자수: totalPatients,
          일평균신환: Math.round(avgDailyNewPatients * 10) / 10,
          근무일수: currentMonthData.workingDays || 0,
          신환1인객단가: newPatients > 0 ? newPatientRevenue / newPatients : 0,
          신환총진료비: newPatientRevenue
        }
      }
    }

    // MonthlySummary 데이터가 없을 때만 PatientStat 사용 (방문 수만 표시)
    else if (monthlyData.length > 0) {
      const totalVisits = monthlyData.reduce((sum, d) => sum + (d.totalVisits || 0), 0)
      const totalAppointments = monthlyData.reduce((sum, d) => sum + (d.totalAppointments || 0), 0)
      const avgDailyNewPatients = monthlyData.reduce((sum, d) => sum + (d.avgDailyNewPatients || 0), 0) / (monthlyData.length || 1)
      const workingDays = monthlyData.reduce((sum, d) => sum + (d.workingDays || 0), 0)

      // ⚠️ PatientStat는 일별 데이터이므로 고유 환자 수 계산 불가
      // 총방문수만 표시하고 신환/구환 구분은 하지 않음
      return {
        신환내원: 0, // PatientStat에서는 정확한 계산 불가
        구환내원: 0, // PatientStat에서는 정확한 계산 불가
        내원환자수: 0, // 고유 환자 수 계산 불가, 대신 방문수 표시
        총방문수: totalVisits, // 실제 데이터: 총 방문 수
        일평균신환: Math.round(avgDailyNewPatients * 10) / 10,
        근무일수: workingDays,
        신환1인객단가: 0, // PatientStat에는 수익 데이터 없음
        신환총진료비: 0
      }
    }

    return {
      신환내원: 0,
      구환내원: 0,
      내원환자수: 0,
      총방문수: 0,
      일평균신환: 0,
      근무일수: 0,
      신환1인객단가: 0,
      신환총진료비: 0
    }
  }

  const currentStats = getCurrentMonthStats()
  const yearlyTrendData = createYearlyTrendData()

  // 월대월 증감률 계산
  const getPreviousMonthStats = () => {
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear

    if (fallbackData && fallbackData.length > 0) {
      const prevMonthData = fallbackData.find(d => d.year === prevYear && d.month === prevMonth)
      const currentMonthData = fallbackData.find(d => d.year === selectedYear && d.month === selectedMonth)

      if (prevMonthData && currentMonthData) {
        const prevNewPatients = prevMonthData.newPatients || 0
        const currentNewPatients = currentMonthData.newPatients || 0
        const newPatientChange = prevNewPatients > 0 ? ((currentNewPatients - prevNewPatients) / prevNewPatients) * 100 : 0

        const prevTotalPatients = prevMonthData.totalPatients || 0
        const currentTotalPatients = currentMonthData.totalPatients || 0
        const totalPatientChange = prevTotalPatients > 0 ? ((currentTotalPatients - prevTotalPatients) / prevTotalPatients) * 100 : 0

        return { newPatientChange, totalPatientChange }
      }
    }
    return { newPatientChange: 0, totalPatientChange: 0 }
  }

  const { newPatientChange, totalPatientChange } = getPreviousMonthStats()

  // 신환률 계산 (고유환자 데이터가 있을 때만 계산)
  const newPatientRate = currentStats.내원환자수 > 0 ? (currentStats.신환내원 / currentStats.내원환자수) * 100 : 0
  const hasValidPatientData = currentStats.내원환자수 > 0 // MonthlySummary 데이터가 있는지 확인

  // ===== 환자 관리 고도화 분석 함수들 =====

  // 1. 환자 유지율 분석
  const getPatientRetentionAnalysis = () => {
    if (!historicalReceptionData || historicalReceptionData.length === 0) return null

    // 환자별 최근 방문 이력 분석
    const patientVisits = new Map<string, Date[]>()

    historicalReceptionData.forEach(record => {
      if (record.receptionTime && record.patientName) {
        const key = record.chartNumber || record.patientName
        if (!patientVisits.has(key)) {
          patientVisits.set(key, [])
        }
        patientVisits.get(key)!.push(new Date(record.receptionTime))
      }
    })

    // 재방문 패턴 분석
    let returningPatients = 0
    let totalUniquePatients = patientVisits.size
    let avgVisitInterval = 0
    let totalIntervals = 0

    patientVisits.forEach(visits => {
      if (visits.length > 1) {
        returningPatients++
        // 방문 간격 계산
        visits.sort((a, b) => a.getTime() - b.getTime())
        for (let i = 1; i < visits.length; i++) {
          const interval = (visits[i].getTime() - visits[i-1].getTime()) / (1000 * 60 * 60 * 24)
          avgVisitInterval += interval
          totalIntervals++
        }
      }
    })

    const retentionRate = totalUniquePatients > 0 ? (returningPatients / totalUniquePatients) * 100 : 0
    const avgDaysBetweenVisits = totalIntervals > 0 ? Math.round(avgVisitInterval / totalIntervals) : 0

    // 신환의 재방문률 (지난 3개월 신환들의 재방문 현황)
    const newPatientReturns = new Map<string, {firstVisit: Date, hasReturn: boolean}>()

    historicalReceptionData
      .filter(r => r.patientType === '신환' || r.patientType === '새환자')
      .forEach(record => {
        const key = record.chartNumber || record.patientName || 'unknown'
        const visitDate = new Date(record.receptionTime!)

        if (!newPatientReturns.has(key)) {
          newPatientReturns.set(key, { firstVisit: visitDate, hasReturn: false })
        }
      })

    // 신환들의 재방문 체크
    historicalReceptionData.forEach(record => {
      const key = record.chartNumber || record.patientName || 'unknown'
      const newPatientData = newPatientReturns.get(key)

      if (newPatientData && record.receptionTime) {
        const visitDate = new Date(record.receptionTime)
        if (visitDate > newPatientData.firstVisit) {
          newPatientData.hasReturn = true
        }
      }
    })

    const newPatientReturnRate = newPatientReturns.size > 0 ?
      (Array.from(newPatientReturns.values()).filter(p => p.hasReturn).length / newPatientReturns.size) * 100 : 0

    return {
      totalUniquePatients,
      returningPatients,
      retentionRate,
      avgDaysBetweenVisits,
      newPatientReturnRate,
      newPatientCount: newPatientReturns.size
    }
  }

  // 2. 치료 계획 완료율 분석
  const getTreatmentCompletionAnalysis = () => {
    if (!treatmentPlans || treatmentPlans.length === 0) return null

    const total = treatmentPlans.length
    const completed = treatmentPlans.filter(plan => plan.status === 'COMPLETED').length
    const inProgress = treatmentPlans.filter(plan => plan.status === 'IN_PROGRESS').length
    const pending = treatmentPlans.filter(plan => plan.status === 'PENDING').length
    const onHold = treatmentPlans.filter(plan => plan.status === 'ON_HOLD').length

    const completionRate = total > 0 ? (completed / total) * 100 : 0

    const avgContractAmount = treatmentPlans.reduce((sum, plan) => sum + (plan.contractAmount || 0), 0) / (total || 1)
    const totalContractAmount = treatmentPlans.reduce((sum, plan) => sum + (plan.contractAmount || 0), 0)
    const totalRemainingAmount = treatmentPlans.reduce((sum, plan) => sum + (plan.remainingAmount || 0), 0)

    return {
      total,
      completed,
      inProgress,
      pending,
      onHold,
      completionRate,
      avgContractAmount,
      totalContractAmount,
      totalRemainingAmount
    }
  }

  // 3. 요일별/시간대별 패턴 분석
  const getTimePatternAnalysis = () => {
    if (!receptionRecords || receptionRecords.length === 0) return null

    const weekdayPattern = Array(7).fill(0) // 월=0, 일=6
    const hourlyPattern = Array(24).fill(0)
    const weekdayNames = ['월', '화', '수', '목', '금', '토', '일']

    receptionRecords.forEach(record => {
      if (record.receptionTime) {
        const date = new Date(record.receptionTime)
        const weekday = (date.getDay() + 6) % 7 // 월=0, 일=6으로 조정
        const hour = date.getHours()

        weekdayPattern[weekday]++
        hourlyPattern[hour]++
      }
    })

    // 히트맵 데이터 생성
    const heatmapData = []
    for (let day = 0; day < 7; day++) {
      for (let hour = 9; hour < 18; hour++) { // 9시-17시만 표시
        const dayRecords = receptionRecords.filter(r => {
          if (!r.receptionTime) return false
          const date = new Date(r.receptionTime)
          const recordDay = (date.getDay() + 6) % 7
          const recordHour = date.getHours()
          return recordDay === day && recordHour === hour
        })

        heatmapData.push({
          day: weekdayNames[day],
          hour: `${hour}시`,
          value: dayRecords.length,
          dayIndex: day,
          hourIndex: hour
        })
      }
    }

    return {
      weekdayPattern: weekdayPattern.map((count, index) => ({
        day: weekdayNames[index],
        count
      })),
      hourlyPattern: hourlyPattern.map((count, index) => ({
        hour: `${index}시`,
        count
      })).filter(h => h.count > 0),
      heatmapData,
      peakWeekday: weekdayNames[weekdayPattern.indexOf(Math.max(...weekdayPattern))],
      peakHour: hourlyPattern.indexOf(Math.max(...hourlyPattern.slice(9, 18))) + 9
    }
  }

  // 4. 예약 효율성 분석 (예약 vs 실제 내원)
  const getAppointmentEfficiencyAnalysis = () => {
    if (!yearlyData || yearlyData.length === 0) return null

    const currentMonthData = yearlyData.find(d => d.month === selectedMonth)
    if (!currentMonthData) return null

    const totalAppointments = currentMonthData.totalAppointments || 0
    const totalVisits = currentMonthData.totalVisits || 0

    const showRate = totalAppointments > 0 ? (totalVisits / totalAppointments) * 100 : 0
    const noShowRate = 100 - showRate

    return {
      totalAppointments,
      totalVisits,
      showRate,
      noShowRate,
      noShowCount: totalAppointments - totalVisits
    }
  }

  // 5. 목표 대비 성과 분석
  const getGoalAnalysis = () => {
    // 목표 설정 (실제로는 설정 가능하게 만들 수 있음)
    const monthlyNewPatientGoal = 50 // 예시 목표
    const monthlyRevenueGoal = 30000000 // 3천만원 예시

    const actualNewPatients = currentStats.신환내원
    const actualRevenue = currentStats.신환총진료비

    const newPatientAchievementRate = monthlyNewPatientGoal > 0 ? (actualNewPatients / monthlyNewPatientGoal) * 100 : 0
    const revenueAchievementRate = monthlyRevenueGoal > 0 ? (actualRevenue / monthlyRevenueGoal) * 100 : 0

    // 목표 달성까지 필요한 일일 신환수 (남은 날짜 계산)
    const today = new Date()
    const endOfMonth = new Date(selectedYear, selectedMonth, 0)
    const remainingDays = Math.max(0, endOfMonth.getDate() - today.getDate())
    const remainingNewPatientsNeeded = Math.max(0, monthlyNewPatientGoal - actualNewPatients)
    const dailyNewPatientsNeeded = remainingDays > 0 ? remainingNewPatientsNeeded / remainingDays : 0

    return {
      monthlyNewPatientGoal,
      monthlyRevenueGoal,
      actualNewPatients,
      actualRevenue,
      newPatientAchievementRate,
      revenueAchievementRate,
      remainingDays,
      remainingNewPatientsNeeded,
      dailyNewPatientsNeeded
    }
  }

  // 분석 결과 계산
  const retentionAnalysis = getPatientRetentionAnalysis()
  const treatmentAnalysis = getTreatmentCompletionAnalysis()
  const timePatternAnalysis = getTimePatternAnalysis()
  const appointmentAnalysis = getAppointmentEfficiencyAnalysis()
  const goalAnalysis = getGoalAnalysis()

  return (
    <div className="space-y-6">
      {/* 년도 헤더 */}
      <div className="text-center border-b border-[#e5e8eb] pb-6">
        <h1 className="text-[32px] font-bold text-[#191f28] mb-2">{selectedYear}년</h1>
        <p className="text-[16px] text-[#6b7280]">환자 내원 현황 분석 리포트</p>
      </div>

      {/* 년도/월 필터 */}
      <YearMonthFilter
        initialYear={selectedYear}
        initialMonth={selectedMonth}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
      />

      {/* 월별 핵심 지표 */}
      <SectionCard title={`${selectedYear}년 ${selectedMonth}월 환자 내원 현황`} description="필수 지표 요약">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          <KpiCard
            label="신환 내원 현황"
            value={currentStats.신환내원.toLocaleString()}
            unit="명"
            change={newPatientChange}
            icon={<UserPlus className="w-4 h-4" />}
            color="blue"
          />
          <KpiCard
            label="구환 내원 현황"
            value={currentStats.구환내원.toLocaleString()}
            unit="명"
            change={totalPatientChange - newPatientChange}
            icon={<Users className="w-4 h-4" />}
            color="green"
          />
          <KpiCard
            label={currentStats.총방문수 ? "총방문수" : "내원환자수"}
            value={(currentStats.총방문수 || currentStats.내원환자수).toLocaleString()}
            unit={currentStats.총방문수 ? "회" : "명"}
            change={totalPatientChange}
            icon={<Activity className="w-4 h-4" />}
            color="yellow"
          />
          <KpiCard
            label="일평균 신환"
            value={currentStats.일평균신환.toString()}
            unit="명"
            icon={<Calendar className="w-4 h-4" />}
            color="red"
          />
          <KpiCard
            label="신환 1인 객단가"
            value={formatAmount(currentStats.신환1인객단가)}
            unit=""
            icon={<DollarSign className="w-4 h-4" />}
            color="blue"
          />
          <KpiCard
            label="신환 총진료비"
            value={formatAmount(currentStats.신환총진료비)}
            unit=""
            icon={<TrendingUp className="w-4 h-4" />}
            color="green"
          />
        </div>

        {/* 추가 분석 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hasValidPatientData ? (
            <>
              <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[14px] text-blue-600 font-medium">신환률</div>
                    <div className="text-[24px] font-bold text-blue-700 mt-1">{newPatientRate.toFixed(1)}%</div>
                    <div className="text-[12px] text-blue-600 mt-1">신환 / 총환자</div>
                  </div>
                  <div className="text-[32px] text-blue-500">📊</div>
                </div>
              </div>
              <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[14px] text-green-600 font-medium">구환률</div>
                    <div className="text-[24px] font-bold text-green-700 mt-1">{(100 - newPatientRate).toFixed(1)}%</div>
                    <div className="text-[12px] text-green-600 mt-1">구환 / 총환자</div>
                  </div>
                  <div className="text-[32px] text-green-500">🔄</div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-orange-50 rounded-xl p-6 border-l-4 border-orange-500 col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-orange-600 font-medium">⚠️ 데이터 제한</div>
                  <div className="text-[16px] font-bold text-orange-700 mt-1">방문 데이터만 사용 중</div>
                  <div className="text-[12px] text-orange-600 mt-1">고유 환자 수 집계를 위해 데이터 재생성이 필요합니다</div>
                </div>
                <div className="text-[32px] text-orange-500">⚠️</div>
              </div>
            </div>
          )}
          <div className="bg-yellow-50 rounded-xl p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] text-yellow-600 font-medium">근무일수</div>
                <div className="text-[24px] font-bold text-yellow-700 mt-1">{currentStats.근무일수}</div>
                <div className="text-[12px] text-yellow-600 mt-1">이번 달 총 근무일</div>
              </div>
              <div className="text-[32px] text-yellow-500">📅</div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 연간 환자 추이 차트 */}
      <SectionCard title={`${selectedYear}년 월별 환자 현황 추이`} description="연간 전체 트렌드">
        {yearlyTrendData.length > 0 ? (
          <div className="h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={yearlyTrendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  stroke="#9ca3af"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  stroke="#9ca3af"
                />
                <Legend />

                {/* 막대 차트 - 환자 수 */}
                {fallbackData && fallbackData.length > 0 ? (
                  <>
                    <Bar dataKey="신환수" fill="#3182f6" name="신환수 (고유환자)" />
                    <Bar dataKey="구환수" fill="#10b981" name="구환수 (고유환자)" />
                  </>
                ) : (
                  <>
                    <Bar dataKey="총방문수" fill="#10b981" name="총방문수" />
                    <Bar dataKey="예약수" fill="#f59e0b" name="총예약수" />
                  </>
                )}

                {/* 꺾은선 차트 - 일평균 */}
                <Line
                  type="monotone"
                  dataKey="일평균신환"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 5 }}
                  name="일평균 신환"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[400px] text-[#8b95a1]">
            연간 데이터가 없습니다.
          </div>
        )}
      </SectionCard>

      {/* 월간 일별 상세 차트 */}
      {monthlyChartData.length > 0 && (
        <SectionCard title={`${selectedYear}년 ${selectedMonth}월 일별 환자 현황`} description="선택된 월의 상세 분석">
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  stroke="#9ca3af"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  stroke="#9ca3af"
                />
                <Legend />
                <Bar dataKey="신환수" fill="#3182f6" name="신환수" />
                <Bar dataKey="총방문수" fill="#e74c3c" name="총방문수" />
                <Bar dataKey="예약수" fill="#f39c12" name="예약수" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      {/* 신환 수익 분석 (MonthlySummary 데이터가 있을 때) */}
      {fallbackData && fallbackData.length > 0 && (
        <SectionCard title={`${selectedYear}년 신환 수익 분석`} description="신환 관련 재무 지표">
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={yearlyTrendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  stroke="#9ca3af"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  stroke="#9ca3af"
                />
                <Legend />
                <Bar
                  dataKey="신환진료비"
                  fill="#8b5cf6"
                  name="신환 총진료비"
                />
                <Line
                  type="monotone"
                  dataKey="신환수"
                  stroke="#3182f6"
                  strokeWidth={3}
                  dot={{ fill: '#3182f6', strokeWidth: 2, r: 5 }}
                  name="신환 수"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      {/* ===== 환자 관리 고도화 섹션들 ===== */}

      {/* 환자 유지율 분석 */}
      {retentionAnalysis && (
        <SectionCard title="환자 유지율 분석" description="환자 재방문 패턴 및 충성도 지표">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <KpiCard
              label="전체 환자 유지율"
              value={retentionAnalysis.retentionRate.toFixed(1)}
              unit="%"
              icon={<Users className="w-4 h-4" />}
              color="blue"
            />
            <KpiCard
              label="신환 재방문율"
              value={retentionAnalysis.newPatientReturnRate.toFixed(1)}
              unit="%"
              icon={<UserPlus className="w-4 h-4" />}
              color="green"
            />
            <KpiCard
              label="평균 재방문 주기"
              value={retentionAnalysis.avgDaysBetweenVisits.toString()}
              unit="일"
              icon={<Calendar className="w-4 h-4" />}
              color="yellow"
            />
            <KpiCard
              label="총 환자수"
              value={retentionAnalysis.totalUniquePatients.toString()}
              unit="명"
              icon={<Activity className="w-4 h-4" />}
              color="red"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-4">환자 충성도 분석</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">재방문 환자</span>
                  <span className="text-[16px] font-bold text-blue-700">{retentionAnalysis.returningPatients}명</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">신규 환자</span>
                  <span className="text-[16px] font-bold text-green-700">{retentionAnalysis.newPatientCount}명</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
                  <div
                    className="bg-blue-500 h-3 rounded-full"
                    style={{width: `${retentionAnalysis.retentionRate}%`}}
                  ></div>
                </div>
                <p className="text-[12px] text-[#6b7280] mt-2">
                  {retentionAnalysis.retentionRate >= 70 ? '✅ 우수한 환자 유지율' :
                   retentionAnalysis.retentionRate >= 50 ? '⚠️ 보통 수준' : '🚨 개선 필요'}
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-4">신환 관리 현황</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">신환 재방문율</span>
                  <span className="text-[16px] font-bold text-green-700">{retentionAnalysis.newPatientReturnRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">평균 재방문 주기</span>
                  <span className="text-[16px] font-bold text-yellow-700">{retentionAnalysis.avgDaysBetweenVisits}일</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
                  <div
                    className="bg-green-500 h-3 rounded-full"
                    style={{width: `${retentionAnalysis.newPatientReturnRate}%`}}
                  ></div>
                </div>
                <p className="text-[12px] text-[#6b7280] mt-2">
                  {retentionAnalysis.newPatientReturnRate >= 60 ? '✅ 신환 관리 우수' :
                   retentionAnalysis.newPatientReturnRate >= 40 ? '⚠️ 보통 수준' : '🚨 신환 관리 강화 필요'}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* 치료 계획 완료율 분석 */}
      {treatmentAnalysis && (
        <SectionCard title="치료 계획 현황" description="치료 진행 상태 및 완료율 분석">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <KpiCard
              label="치료 완료율"
              value={treatmentAnalysis.completionRate.toFixed(1)}
              unit="%"
              icon={<CheckCircle className="w-4 h-4" />}
              color="blue"
            />
            <KpiCard
              label="총 치료 계획"
              value={treatmentAnalysis.total.toString()}
              unit="건"
              icon={<Activity className="w-4 h-4" />}
              color="green"
            />
            <KpiCard
              label="평균 계약금액"
              value={formatAmount(treatmentAnalysis.avgContractAmount)}
              unit=""
              icon={<DollarSign className="w-4 h-4" />}
              color="yellow"
            />
            <KpiCard
              label="총 잔여금액"
              value={formatAmount(treatmentAnalysis.totalRemainingAmount)}
              unit=""
              icon={<TrendingUp className="w-4 h-4" />}
              color="red"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 치료 상태별 분포 */}
            <div>
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-4">치료 상태별 현황</h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: '완료', value: treatmentAnalysis.completed, color: '#10b981' },
                        { name: '진행중', value: treatmentAnalysis.inProgress, color: '#3182f6' },
                        { name: '대기', value: treatmentAnalysis.pending, color: '#f59e0b' },
                        { name: '보류', value: treatmentAnalysis.onHold, color: '#ef4444' }
                      ].filter(item => item.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({name, value}) => `${name}: ${value}건`}
                    >
                      {[
                        { name: '완료', value: treatmentAnalysis.completed, color: '#10b981' },
                        { name: '진행중', value: treatmentAnalysis.inProgress, color: '#3182f6' },
                        { name: '대기', value: treatmentAnalysis.pending, color: '#f59e0b' },
                        { name: '보류', value: treatmentAnalysis.onHold, color: '#ef4444' }
                      ].filter(item => item.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 치료비 현황 */}
            <div>
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-4">치료비 현황</h4>
              <div className="space-y-6">
                <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] text-blue-600 font-medium">총 계약금액</div>
                      <div className="text-[24px] font-bold text-blue-700 mt-1">{formatAmount(treatmentAnalysis.totalContractAmount)}</div>
                    </div>
                    <div className="text-[32px] text-blue-500">💰</div>
                  </div>
                </div>
                <div className="bg-yellow-50 rounded-xl p-6 border-l-4 border-yellow-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] text-yellow-600 font-medium">잔여금액</div>
                      <div className="text-[24px] font-bold text-yellow-700 mt-1">{formatAmount(treatmentAnalysis.totalRemainingAmount)}</div>
                    </div>
                    <div className="text-[32px] text-yellow-500">⏳</div>
                  </div>
                </div>
                <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] text-green-600 font-medium">수납률</div>
                      <div className="text-[24px] font-bold text-green-700 mt-1">
                        {treatmentAnalysis.totalContractAmount > 0 ?
                          (((treatmentAnalysis.totalContractAmount - treatmentAnalysis.totalRemainingAmount) / treatmentAnalysis.totalContractAmount) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                    <div className="text-[32px] text-green-500">✅</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* 요일별/시간대별 패턴 분석 */}
      {timePatternAnalysis && (
        <SectionCard title="내원 시간 패턴 분석" description="요일별, 시간대별 환자 내원 현황">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* 요일별 현황 */}
            <div>
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-4">요일별 내원 현황</h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timePatternAnalysis.weekdayPattern}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#6b7280" }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} stroke="#9ca3af" />
                    <Bar dataKey="count" fill="#3182f6" name="내원 수" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 시간대별 현황 */}
            <div>
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-4">시간대별 내원 현황</h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timePatternAnalysis.hourlyPattern}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#6b7280" }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} stroke="#9ca3af" />
                    <Bar dataKey="count" fill="#10b981" name="내원 수" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 피크 시간 인사이트 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-blue-600 font-medium">최고 바쁜 요일</div>
                  <div className="text-[24px] font-bold text-blue-700 mt-1">{timePatternAnalysis.peakWeekday}요일</div>
                  <div className="text-[12px] text-blue-600 mt-1">스태프 배치 최적화 고려</div>
                </div>
                <div className="text-[32px] text-blue-500">📅</div>
              </div>
            </div>
            <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-green-600 font-medium">최고 바쁜 시간</div>
                  <div className="text-[24px] font-bold text-green-700 mt-1">{timePatternAnalysis.peakHour}시</div>
                  <div className="text-[12px] text-green-600 mt-1">예약 시간 분산 고려</div>
                </div>
                <div className="text-[32px] text-green-500">🕐</div>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* 예약 효율성 분석 */}
      {appointmentAnalysis && (
        <SectionCard title="예약 효율성 분석" description="예약 대비 실제 내원율 현황">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <KpiCard
              label="내원율"
              value={appointmentAnalysis.showRate.toFixed(1)}
              unit="%"
              icon={<CheckCircle className="w-4 h-4" />}
              color="blue"
            />
            <KpiCard
              label="노쇼율"
              value={appointmentAnalysis.noShowRate.toFixed(1)}
              unit="%"
              icon={<AlertTriangle className="w-4 h-4" />}
              color="red"
            />
            <KpiCard
              label="노쇼 환자"
              value={appointmentAnalysis.noShowCount.toString()}
              unit="명"
              icon={<Users className="w-4 h-4" />}
              color="yellow"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 예약 대비 내원 현황 */}
            <div className="h-[300px]">
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-4">예약 vs 실제 내원</h4>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  {
                    name: '예약 현황',
                    예약수: appointmentAnalysis.totalAppointments,
                    실제내원: appointmentAnalysis.totalVisits,
                    노쇼: appointmentAnalysis.noShowCount
                  }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} stroke="#9ca3af" />
                  <Legend />
                  <Bar dataKey="예약수" fill="#3182f6" name="총 예약수" />
                  <Bar dataKey="실제내원" fill="#10b981" name="실제 내원" />
                  <Bar dataKey="노쇼" fill="#ef4444" name="노쇼" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 효율성 인사이트 */}
            <div className="space-y-4">
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-4">예약 관리 인사이트</h4>

              <div className={`rounded-xl p-6 border-l-4 ${
                appointmentAnalysis.showRate >= 90 ? 'bg-green-50 border-green-500' :
                appointmentAnalysis.showRate >= 80 ? 'bg-yellow-50 border-yellow-500' :
                'bg-red-50 border-red-500'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className={`text-[14px] font-medium ${
                    appointmentAnalysis.showRate >= 90 ? 'text-green-600' :
                    appointmentAnalysis.showRate >= 80 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>내원율 평가</div>
                  <div className="text-[24px]">
                    {appointmentAnalysis.showRate >= 90 ? '😊' :
                     appointmentAnalysis.showRate >= 80 ? '😐' : '😞'}
                  </div>
                </div>
                <div className={`text-[24px] font-bold mb-2 ${
                  appointmentAnalysis.showRate >= 90 ? 'text-green-700' :
                  appointmentAnalysis.showRate >= 80 ? 'text-yellow-700' :
                  'text-red-700'
                }`}>
                  {appointmentAnalysis.showRate.toFixed(1)}%
                </div>
                <div className={`text-[12px] ${
                  appointmentAnalysis.showRate >= 90 ? 'text-green-600' :
                  appointmentAnalysis.showRate >= 80 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {appointmentAnalysis.showRate >= 90 ? '✅ 매우 우수한 내원율' :
                   appointmentAnalysis.showRate >= 80 ? '⚠️ 보통 수준 - 개선 가능' :
                   '🚨 낮은 내원율 - 개선 필요'}
                </div>
              </div>

              {appointmentAnalysis.noShowRate > 20 && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <div className="text-[14px] font-medium text-orange-800 mb-1">📢 개선 제안</div>
                  <div className="text-[12px] text-orange-700">
                    • 예약 1일 전 리마인더 발송<br/>
                    • 노쇼 환자 패턴 분석<br/>
                    • 예약 확정 프로세스 강화
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* 목표 관리 시스템 */}
      {goalAnalysis && (
        <SectionCard title="목표 관리 및 성과 추적" description="월별 목표 대비 달성 현황">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <KpiCard
              label="신환 목표 달성률"
              value={goalAnalysis.newPatientAchievementRate.toFixed(1)}
              unit="%"
              icon={<Target className="w-4 h-4" />}
              color="blue"
            />
            <KpiCard
              label="수익 목표 달성률"
              value={goalAnalysis.revenueAchievementRate.toFixed(1)}
              unit="%"
              icon={<DollarSign className="w-4 h-4" />}
              color="green"
            />
            <KpiCard
              label="남은 근무일"
              value={goalAnalysis.remainingDays.toString()}
              unit="일"
              icon={<Calendar className="w-4 h-4" />}
              color="yellow"
            />
            <KpiCard
              label="일일 필요 신환"
              value={goalAnalysis.dailyNewPatientsNeeded.toFixed(1)}
              unit="명"
              icon={<TrendingUp className="w-4 h-4" />}
              color="red"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 신환 목표 달성 현황 */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-6">신환 목표 달성 현황</h4>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">목표</span>
                  <span className="text-[16px] font-bold text-blue-700">{goalAnalysis.monthlyNewPatientGoal}명</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">현재 달성</span>
                  <span className="text-[16px] font-bold text-green-700">{goalAnalysis.actualNewPatients}명</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">남은 목표</span>
                  <span className="text-[16px] font-bold text-red-700">{goalAnalysis.remainingNewPatientsNeeded}명</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-4 mt-4">
                  <div
                    className={`h-4 rounded-full transition-all duration-300 ${
                      goalAnalysis.newPatientAchievementRate >= 100 ? 'bg-green-500' :
                      goalAnalysis.newPatientAchievementRate >= 80 ? 'bg-blue-500' :
                      goalAnalysis.newPatientAchievementRate >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{width: `${Math.min(100, goalAnalysis.newPatientAchievementRate)}%`}}
                  ></div>
                </div>

                <p className="text-[12px] text-[#6b7280] mt-2 text-center">
                  {goalAnalysis.newPatientAchievementRate >= 100 ? '🎉 목표 달성 완료!' :
                   goalAnalysis.remainingDays > 0 ?
                   `📈 일일 ${goalAnalysis.dailyNewPatientsNeeded.toFixed(1)}명 필요` :
                   '⏰ 목표 달성 기간 종료'}
                </p>
              </div>
            </div>

            {/* 수익 목표 달성 현황 */}
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-6">수익 목표 달성 현황</h4>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">목표</span>
                  <span className="text-[16px] font-bold text-green-700">{formatAmount(goalAnalysis.monthlyRevenueGoal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">현재 달성</span>
                  <span className="text-[16px] font-bold text-blue-700">{formatAmount(goalAnalysis.actualRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">남은 목표</span>
                  <span className="text-[16px] font-bold text-red-700">
                    {formatAmount(Math.max(0, goalAnalysis.monthlyRevenueGoal - goalAnalysis.actualRevenue))}
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-4 mt-4">
                  <div
                    className={`h-4 rounded-full transition-all duration-300 ${
                      goalAnalysis.revenueAchievementRate >= 100 ? 'bg-green-500' :
                      goalAnalysis.revenueAchievementRate >= 80 ? 'bg-blue-500' :
                      goalAnalysis.revenueAchievementRate >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{width: `${Math.min(100, goalAnalysis.revenueAchievementRate)}%`}}
                  ></div>
                </div>

                <p className="text-[12px] text-[#6b7280] mt-2 text-center">
                  {goalAnalysis.revenueAchievementRate >= 100 ? '🎉 수익 목표 달성!' :
                   `📊 ${goalAnalysis.revenueAchievementRate.toFixed(1)}% 달성`}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* 데이터가 없는 경우 */}
      {yearlyTrendData.length === 0 && (
        <div className="text-center py-12 text-[14px] text-[#8b95a1]">
          환자 통계 데이터가 없습니다. 엑셀을 업로드해주세요.
        </div>
      )}
    </div>
  )
}