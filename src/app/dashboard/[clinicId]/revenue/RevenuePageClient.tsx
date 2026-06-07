"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"
import YearMonthFilter from "@/components/ui/YearMonthFilter"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, BarChart, Bar, ComposedChart, Area, AreaChart, Tooltip } from "recharts"
import { TrendingUp, TrendingDown, Target, Activity, DollarSign, Calendar, AlertCircle } from "lucide-react"

type MonthlySummaryData = {
  id: string
  clinicId: string
  year: number
  month: number
  totalRevenue: number | null
  totalExpense: number | null
  netProfit: number | null
  cashIncome: number | null
  cardIncome: number | null
  insuranceClaim: number | null
  nonInsuranceRevenue: number | null
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

interface RevenuePageClientProps {
  clinicId: string
  initialYear: number
  initialMonth: number
  monthlySummaries: MonthlySummaryData[]
  availableMonths: Array<{ year: number; month: number }>
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

export default function RevenuePageClient({
  clinicId,
  initialYear,
  initialMonth,
  monthlySummaries,
  availableMonths
}: RevenuePageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [chartsReady, setChartsReady] = useState(false)

  // 차트 렌더링 준비 - DOM이 완전히 로드된 후 차트 렌더링
  useEffect(() => {
    const timer = setTimeout(() => {
      setChartsReady(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

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
      router.replace(`/dashboard/${clinicId}/revenue?${params.toString()}`)
    }
  }, [selectedYear, selectedMonth, clinicId, router, searchParams])

  // 현재 선택된 월 데이터
  const currentMonthData = monthlySummaries.find(s => s.year === selectedYear && s.month === selectedMonth)

  // 이전 월 데이터 (월대월 비교용)
  const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
  const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
  const prevMonthData = monthlySummaries.find(s => s.year === prevYear && s.month === prevMonth)

  // 전년 동월 데이터 (년대년 비교용)
  const lastYearData = monthlySummaries.find(s => s.year === selectedYear - 1 && s.month === selectedMonth)

  // ===== 성장성 지표 분석 함수들 =====

  // 1. 성장률 계산
  const getGrowthAnalysis = () => {
    const currentRevenue = currentMonthData?.totalRevenue || 0
    const prevRevenue = prevMonthData?.totalRevenue || 0
    const lastYearRevenue = lastYearData?.totalRevenue || 0

    const momGrowth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0
    const yoyGrowth = lastYearRevenue > 0 ? ((currentRevenue - lastYearRevenue) / lastYearRevenue) * 100 : 0

    // 연간 누적 매출 계산
    const yearToDateRevenue = monthlySummaries
      .filter(s => s.year === selectedYear && s.month <= selectedMonth)
      .reduce((sum, s) => sum + (s.totalRevenue || 0), 0)

    const lastYearToDateRevenue = monthlySummaries
      .filter(s => s.year === selectedYear - 1 && s.month <= selectedMonth)
      .reduce((sum, s) => sum + (s.totalRevenue || 0), 0)

    const ytdGrowth = lastYearToDateRevenue > 0 ?
      ((yearToDateRevenue - lastYearToDateRevenue) / lastYearToDateRevenue) * 100 : 0

    // 분기별 누적 매출 계산
    const getQuarter = (month: number) => Math.ceil(month / 3)
    const currentQuarter = getQuarter(selectedMonth)
    const quarterStartMonth = (currentQuarter - 1) * 3 + 1
    const quarterEndMonth = Math.min(currentQuarter * 3, selectedMonth)

    const quarterToDateRevenue = monthlySummaries
      .filter(s => s.year === selectedYear && s.month >= quarterStartMonth && s.month <= quarterEndMonth)
      .reduce((sum, s) => sum + (s.totalRevenue || 0), 0)

    const lastYearQuarterRevenue = monthlySummaries
      .filter(s => s.year === selectedYear - 1 && s.month >= quarterStartMonth && s.month <= quarterEndMonth)
      .reduce((sum, s) => sum + (s.totalRevenue || 0), 0)

    const quarterGrowth = lastYearQuarterRevenue > 0 ?
      ((quarterToDateRevenue - lastYearQuarterRevenue) / lastYearQuarterRevenue) * 100 : 0

    return {
      currentRevenue,
      momGrowth,
      yoyGrowth,
      ytdGrowth,
      yearToDateRevenue,
      lastYearToDateRevenue,
      quarterToDateRevenue,
      lastYearQuarterRevenue,
      quarterGrowth,
      currentQuarter,
      quarterStartMonth,
      quarterEndMonth
    }
  }

  // 2. 트렌드 분석 (최근 6개월)
  const getTrendAnalysis = () => {
    const recent6Months = monthlySummaries
      .filter(s => {
        const dataDate = new Date(s.year, s.month - 1)
        const sixMonthsAgo = new Date(selectedYear, selectedMonth - 7)
        const currentDate = new Date(selectedYear, selectedMonth - 1)
        return dataDate >= sixMonthsAgo && dataDate <= currentDate
      })
      .sort((a, b) => a.year - b.year || a.month - b.month)

    if (recent6Months.length < 3) return null

    const revenues = recent6Months.map(s => s.totalRevenue || 0)

    // 단순 선형 트렌드 계산
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
    revenues.forEach((revenue, index) => {
      sumX += index
      sumY += revenue
      sumXY += index * revenue
      sumXX += index * index
    })

    const n = revenues.length
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const avgRevenue = sumY / n
    const trendDirection = slope > avgRevenue * 0.05 ? 'rising' :
                          slope < -avgRevenue * 0.05 ? 'falling' : 'stable'

    // 변동성 계산 (표준편차)
    const variance = revenues.reduce((sum, rev) => sum + Math.pow(rev - avgRevenue, 2), 0) / n
    const volatility = Math.sqrt(variance) / avgRevenue * 100

    return {
      trendDirection,
      slope,
      avgRevenue,
      volatility,
      recent6Months: recent6Months.map(s => ({
        month: `${s.year}.${s.month.toString().padStart(2, '0')}`,
        revenue: s.totalRevenue || 0,
        growth: s.revenueGrowth || 0
      }))
    }
  }

  // 제거됨: 예측 모델링 및 ARPU 분석 기능 (사용자 요청에 따라 제거)

  // 5. 매출 목표 관리 (월별 목표만 유지)
  const [revenueGoals, setRevenueGoals] = useState<{
    monthlyGoal: number | null
    yearlyGoal: number | null
  }>({
    monthlyGoal: null,
    yearlyGoal: null
  })

  // 6. 전년 대비 매출 분석
  const [previousYearData, setPreviousYearData] = useState<{
    currentYearTotal: number
    previousYearTotal: number
    growthAmount: number
    growthRate: number
    currentMonthRevenue: number
    previousYearSameMonth: number
    monthlyGrowthAmount: number
    monthlyGrowthRate: number
  }>({
    currentYearTotal: 0,
    previousYearTotal: 0,
    growthAmount: 0,
    growthRate: 0,
    currentMonthRevenue: 0,
    previousYearSameMonth: 0,
    monthlyGrowthAmount: 0,
    monthlyGrowthRate: 0
  })

  // 목표 데이터 로드
  useEffect(() => {
    const fetchGoals = async () => {
      try {
        console.log(`[GOALS DEBUG] 목표 조회 시작: clinicId=${clinicId}, year=${selectedYear}, month=${selectedMonth}`)

        // 월별 목표 조회
        const monthlyResponse = await fetch(`/api/goals?clinicId=${clinicId}&year=${selectedYear}&month=${selectedMonth}`)
        console.log(`[GOALS DEBUG] 월별 목표 응답 상태: ${monthlyResponse.status}`)

        if (!monthlyResponse.ok) {
          const errorText = await monthlyResponse.text()
          console.error(`[GOALS DEBUG] 월별 목표 조회 실패: ${monthlyResponse.status} - ${errorText}`)
          setRevenueGoals({
            monthlyGoal: null,
            yearlyGoal: null
          })
          return
        }

        const monthlyData = await monthlyResponse.json()
        console.log(`[GOALS DEBUG] 월별 목표 데이터:`, monthlyData)

        // 연간 목표 조회
        const yearlyResponse = await fetch(`/api/goals?clinicId=${clinicId}&year=${selectedYear}`)
        console.log(`[GOALS DEBUG] 연간 목표 응답 상태: ${yearlyResponse.status}`)

        if (!yearlyResponse.ok) {
          const errorText = await yearlyResponse.text()
          console.error(`[GOALS DEBUG] 연간 목표 조회 실패: ${yearlyResponse.status} - ${errorText}`)
        } else {
          const yearlyData = await yearlyResponse.json()
          console.log(`[GOALS DEBUG] 연간 목표 데이터:`, yearlyData)

          setRevenueGoals({
            monthlyGoal: monthlyData.goals?.find((g: any) => g.month === selectedMonth)?.revenueGoal || null,
            yearlyGoal: yearlyData.goals?.find((g: any) => g.month === null)?.revenueGoal || null
          })
        }
      } catch (error) {
        console.error('[GOALS DEBUG] 목표 조회 중 예외 발생:', error)
        setRevenueGoals({
          monthlyGoal: null,
          yearlyGoal: null
        })
      }
    }

    fetchGoals()
  }, [clinicId, selectedYear, selectedMonth])

  // 전년 대비 데이터 계산
  useEffect(() => {
    const calculateYearOverYearGrowth = () => {
      // 현재 년도 데이터 (1월 ~ 현재 월까지)
      const currentYearData = monthlySummaries.filter(s =>
        s.year === selectedYear && s.month <= selectedMonth
      )

      // 전년 같은 기간 데이터 (1월 ~ 현재 월까지)
      const previousYearData = monthlySummaries.filter(s =>
        s.year === selectedYear - 1 && s.month <= selectedMonth
      )

      // 현재 월 매출
      const currentMonthRevenue = monthlySummaries.find(s =>
        s.year === selectedYear && s.month === selectedMonth
      )?.totalRevenue || 0

      // 전년 동월 매출
      const previousYearSameMonth = monthlySummaries.find(s =>
        s.year === selectedYear - 1 && s.month === selectedMonth
      )?.totalRevenue || 0

      // 누적 매출 계산
      const currentYearTotal = currentYearData.reduce((sum, s) =>
        sum + (s.totalRevenue || 0), 0
      )

      const previousYearTotal = previousYearData.reduce((sum, s) =>
        sum + (s.totalRevenue || 0), 0
      )

      // 증감액과 증감률 계산
      const growthAmount = currentYearTotal - previousYearTotal
      const growthRate = previousYearTotal > 0
        ? (growthAmount / previousYearTotal) * 100
        : 0

      // 월별 증감 계산
      const monthlyGrowthAmount = currentMonthRevenue - previousYearSameMonth
      const monthlyGrowthRate = previousYearSameMonth > 0
        ? (monthlyGrowthAmount / previousYearSameMonth) * 100
        : 0

      console.log('[전년대비] 계산 결과:', {
        currentYearTotal,
        previousYearTotal,
        growthAmount,
        growthRate,
        currentMonthRevenue,
        previousYearSameMonth,
        monthlyGrowthAmount,
        monthlyGrowthRate
      })

      setPreviousYearData({
        currentYearTotal,
        previousYearTotal,
        growthAmount,
        growthRate,
        currentMonthRevenue,
        previousYearSameMonth,
        monthlyGrowthAmount,
        monthlyGrowthRate
      })
    }

    calculateYearOverYearGrowth()
  }, [monthlySummaries, selectedYear, selectedMonth])

  const getMonthlyComparisonAnalysis = () => {
    // 월별 목표는 유지 (사용자가 월별 목표만 제거하라고 하지 않았으므로)
    const monthlyRevenueGoal = revenueGoals.monthlyGoal || 50000000 // 기본값 5천만원
    const currentRevenue = currentMonthData?.totalRevenue || 0
    const monthlyAchievementRate = (currentRevenue / monthlyRevenueGoal) * 100

    // 전년 동월과의 비교
    const previousYearSameMonth = monthlySummaries.find(s =>
      s.year === selectedYear - 1 && s.month === selectedMonth
    )?.totalRevenue || 0

    const monthlyGrowthAmount = currentRevenue - previousYearSameMonth
    const monthlyGrowthRate = previousYearSameMonth > 0 ?
      (monthlyGrowthAmount / previousYearSameMonth) * 100 : 0

    return {
      monthlyRevenueGoal,
      currentRevenue,
      monthlyAchievementRate,
      previousYearSameMonth,
      monthlyGrowthAmount,
      monthlyGrowthRate,
      hasMonthlyGoal: !!revenueGoals.monthlyGoal,
      remainingMonths: Math.max(0, 12 - selectedMonth)
    }
  }

  // 연간 트렌드 데이터 생성 (선택한 월까지만)
  const createYearlyTrendData = () => {
    const months = Array.from({ length: selectedMonth }, (_, i) => i + 1)

    return months.map(month => {
      const currentYearData = monthlySummaries.find(s => s.year === selectedYear && s.month === month)
      const lastYearData = monthlySummaries.find(s => s.year === selectedYear - 1 && s.month === month)

      return {
        month: `${month}월`,
        현재년도: currentYearData?.totalRevenue || 0,
        전년도: lastYearData?.totalRevenue || 0,
        순이익: currentYearData?.netProfit || 0,
        성장률: currentYearData?.revenueGrowth || 0
      }
    })
  }

  // 분석 결과 계산
  const growthAnalysis = getGrowthAnalysis()
  const trendAnalysis = getTrendAnalysis()
  const monthlyAnalysis = getMonthlyComparisonAnalysis()
  const yearlyTrendData = createYearlyTrendData()

  // 제거된 기능들을 위한 더미 객체 (에러 방지)
  const predictionAnalysis = null
  const arpuAnalysis = null

  return (
    <div className="space-y-6">
      {/* 년도 헤더 */}
      <div className="text-center border-b border-[#e5e8eb] pb-6">
        <h1 className="text-[32px] font-bold text-[#191f28] mb-2">{selectedYear}년</h1>
        <p className="text-[16px] text-[#6b7280]">매출 성장성 및 예측 분석 리포트</p>
      </div>

      {/* 년도/월 필터 */}
      <YearMonthFilter
        initialYear={selectedYear}
        initialMonth={selectedMonth}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
      />

      {/* 핵심 성장 지표 */}
      <SectionCard title={`${selectedYear}년 ${selectedMonth}월 성장 지표`} description="매출 성장성 및 트렌드 분석">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <KpiCard
            label="월 매출"
            value={formatAmount(growthAnalysis.currentRevenue)}
            unit=""
            change={growthAnalysis.momGrowth}
            changeLabel="전월 대비"
            icon={<DollarSign className="w-4 h-4" />}
            color="blue"
          />
          <KpiCard
            label="전년 동월 성장률"
            value={growthAnalysis.yoyGrowth.toFixed(1)}
            unit="%"
            icon={<TrendingUp className="w-4 h-4" />}
            color={growthAnalysis.yoyGrowth >= 0 ? "green" : "red"}
          />
          <KpiCard
            label="연간 누적 금액"
            value={formatAmount(growthAnalysis.yearToDateRevenue)}
            unit=""
            icon={<Activity className="w-4 h-4" />}
            color="purple"
          />
          {/* ARPU 분석 카드 제거됨 */}
        </div>


        {/* 분기별/연간 누적 매출 상세 분석 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* 분기별 누적 매출 상세 분석 */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg font-bold">Q{growthAnalysis.currentQuarter}</span>
              </div>
              <div>
                <h4 className="text-[18px] font-bold text-slate-900">{growthAnalysis.currentQuarter}분기 누적 매출 분석</h4>
                <p className="text-[12px] text-slate-600">{growthAnalysis.quarterStartMonth}월~{selectedMonth}월 누적</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-slate-600">올해 {growthAnalysis.currentQuarter}분기</span>
                <span className="text-[18px] font-bold text-purple-700">
                  {formatAmount(growthAnalysis.quarterToDateRevenue)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-slate-600">작년 동분기</span>
                <span className="text-[16px] font-semibold text-slate-700">
                  {formatAmount(growthAnalysis.lastYearQuarterRevenue)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-slate-600">증감액</span>
                <span className={`text-[16px] font-bold ${
                  (growthAnalysis.quarterToDateRevenue - growthAnalysis.lastYearQuarterRevenue) >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {(growthAnalysis.quarterToDateRevenue - growthAnalysis.lastYearQuarterRevenue) >= 0 ? '+' : ''}
                  {formatAmount(growthAnalysis.quarterToDateRevenue - growthAnalysis.lastYearQuarterRevenue)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-slate-600">증감률</span>
                <span className={`text-[20px] font-bold ${
                  growthAnalysis.quarterGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {growthAnalysis.quarterGrowth >= 0 ? '+' : ''}{growthAnalysis.quarterGrowth.toFixed(1)}%
                </span>
              </div>

              {/* 성장률 프로그레스 바 */}
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      growthAnalysis.quarterGrowth >= 20 ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                      growthAnalysis.quarterGrowth >= 10 ? 'bg-gradient-to-r from-blue-500 to-indigo-500' :
                      growthAnalysis.quarterGrowth >= 0 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                      'bg-gradient-to-r from-red-500 to-pink-500'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(10, Math.abs(growthAnalysis.quarterGrowth) * 2))}%`
                    }}
                  ></div>
                </div>
                <p className="text-[12px] text-slate-500 mt-2 text-center">
                  {growthAnalysis.quarterGrowth >= 20 ? '🚀 매우 높은 성장!' :
                   growthAnalysis.quarterGrowth >= 10 ? '📈 양호한 성장세' :
                   growthAnalysis.quarterGrowth >= 0 ? '📊 안정적 성장' :
                   growthAnalysis.quarterGrowth >= -10 ? '⚠️ 소폭 감소' :
                   '🔴 성장 전략 필요'}
                </p>
              </div>
            </div>
          </div>

          {/* 연간 누적 매출 상세 분석 */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg font-bold">{selectedYear.toString().slice(-2)}</span>
              </div>
              <div>
                <h4 className="text-[18px] font-bold text-slate-900">연간 누적 매출 분석</h4>
                <p className="text-[12px] text-slate-600">1월~{selectedMonth}월 누적</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-slate-600">올해 누적 ({selectedYear}년)</span>
                <span className="text-[18px] font-bold text-emerald-700">
                  {formatAmount(growthAnalysis.yearToDateRevenue)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-slate-600">작년 동기간 ({selectedYear-1}년)</span>
                <span className="text-[16px] font-semibold text-slate-700">
                  {formatAmount(growthAnalysis.lastYearToDateRevenue)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-slate-600">증감액</span>
                <span className={`text-[16px] font-bold ${
                  (growthAnalysis.yearToDateRevenue - growthAnalysis.lastYearToDateRevenue) >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {(growthAnalysis.yearToDateRevenue - growthAnalysis.lastYearToDateRevenue) >= 0 ? '+' : ''}
                  {formatAmount(growthAnalysis.yearToDateRevenue - growthAnalysis.lastYearToDateRevenue)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-slate-600">증감률</span>
                <span className={`text-[20px] font-bold ${
                  growthAnalysis.ytdGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {growthAnalysis.ytdGrowth >= 0 ? '+' : ''}{growthAnalysis.ytdGrowth.toFixed(1)}%
                </span>
              </div>

              {/* 성장률 프로그레스 바 */}
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      growthAnalysis.ytdGrowth >= 20 ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                      growthAnalysis.ytdGrowth >= 10 ? 'bg-gradient-to-r from-blue-500 to-indigo-500' :
                      growthAnalysis.ytdGrowth >= 0 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                      'bg-gradient-to-r from-red-500 to-pink-500'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(10, Math.abs(growthAnalysis.ytdGrowth) * 2))}%`
                    }}
                  ></div>
                </div>
                <p className="text-[12px] text-slate-500 mt-2 text-center">
                  {growthAnalysis.ytdGrowth >= 20 ? '🚀 매우 높은 성장!' :
                   growthAnalysis.ytdGrowth >= 10 ? '📈 양호한 성장세' :
                   growthAnalysis.ytdGrowth >= 0 ? '📊 안정적 성장' :
                   growthAnalysis.ytdGrowth >= -10 ? '⚠️ 소폭 감소' :
                   '🔴 성장 전략 필요'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 연간 매출 추이 및 성장 트렌드 */}
      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-slate-900">매출 추이 분석</h3>
            <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs px-3 py-1 rounded-full font-medium">
              {selectedYear}년
            </span>
          </div>
          <p className="text-slate-600">
            {selectedYear}년 1월부터 {selectedMonth}월까지의 매출 성장 패턴을 확인하세요
          </p>
        </div>

        {/* 현재년도 매출 추이 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8 hover:shadow-lg transition-all duration-300">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {selectedYear}년 1~{selectedMonth}월 매출 추이
              </h3>
              <p className="text-sm text-slate-600">
                {selectedMonth}월까지 누적 매출: {formatAmount(growthAnalysis.yearToDateRevenue)}
              </p>
            </div>
          </div>

          <div className="h-64 mb-4 w-full min-h-[256px] min-w-0">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height={256} minHeight={256}>
                <AreaChart data={yearlyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradient-current-year" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${(value / 100000000).toFixed(0)}억`}
                    width={50}
                  />
                  <Tooltip
                    formatter={(value: any) => [`${formatAmount(value)}`, '매출']}
                    contentStyle={{
                      borderRadius: 12,
                      border: 'none',
                      boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)',
                      fontSize: 13,
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(8px)'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="현재년도"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fill="url(#gradient-current-year)"
                    dot={{ fill: '#3b82f6', strokeWidth: 2, stroke: '#ffffff', r: 4 }}
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[256px] flex items-center justify-center">
                <div className="text-gray-500">차트를 로딩 중...</div>
              </div>
            )}
          </div>
        </div>

        {/* 전년도 대비 추이 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8 hover:shadow-lg transition-all duration-300">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                전년도 대비 매출 추이 (1~{selectedMonth}월)
              </h3>
              <p className="text-sm text-slate-600">
                {selectedYear - 1}년 vs {selectedYear}년 동기간 비교
              </p>
            </div>
          </div>

          <div className="h-64 mb-4 w-full min-h-[256px] min-w-0">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height={256} minHeight={256}>
                <AreaChart data={yearlyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradient-current" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="gradient-previous" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#64748b" stopOpacity={0.2}/>
                      <stop offset="100%" stopColor="#64748b" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${(value / 100000000).toFixed(0)}억`}
                    width={50}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [`${formatAmount(value)}`, name]}
                    contentStyle={{
                      borderRadius: 12,
                      border: 'none',
                      boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)',
                      fontSize: 13,
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(8px)'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="전년도"
                    stroke="#64748b"
                    strokeWidth={2}
                    fill="url(#gradient-previous)"
                    dot={{ fill: '#64748b', strokeWidth: 2, stroke: '#ffffff', r: 3 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="현재년도"
                    stroke="#10b981"
                    strokeWidth={3}
                    fill="url(#gradient-current)"
                    dot={{ fill: '#10b981', strokeWidth: 2, stroke: '#ffffff', r: 4 }}
                    activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[256px] flex items-center justify-center">
                <div className="text-gray-500">차트를 로딩 중...</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 예측 분석 섹션 제거됨 (사용자 요청) */}
      {predictionAnalysis && (
        <SectionCard title="트렌드 분석 및 매출 예측" description="데이터 기반 매출 전망">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            {/* 예측 분석 KPI 카드들 제거됨 (사용자 요청) */}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 트렌드 방향 분석 */}
            <div className={`rounded-xl p-6 border-l-4 ${
              trendAnalysis.trendDirection === 'rising' ? 'bg-green-50 border-green-500' :
              trendAnalysis.trendDirection === 'falling' ? 'bg-red-50 border-red-500' :
              'bg-blue-50 border-blue-500'
            }`}>
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-4">매출 트렌드 분석</h4>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-[14px] font-medium ${
                    trendAnalysis.trendDirection === 'rising' ? 'text-green-600' :
                    trendAnalysis.trendDirection === 'falling' ? 'text-red-600' :
                    'text-blue-600'
                  }`}>
                    {trendAnalysis.trendDirection === 'rising' ? '상승 추세' :
                     trendAnalysis.trendDirection === 'falling' ? '하락 추세' : '안정 추세'}
                  </div>
                  <div className={`text-[20px] font-bold mt-2 ${
                    trendAnalysis.trendDirection === 'rising' ? 'text-green-700' :
                    trendAnalysis.trendDirection === 'falling' ? 'text-red-700' :
                    'text-blue-700'
                  }`}>
                    최근 6개월 분석
                  </div>
                  <div className={`text-[12px] mt-2 ${
                    trendAnalysis.trendDirection === 'rising' ? 'text-green-600' :
                    trendAnalysis.trendDirection === 'falling' ? 'text-red-600' :
                    'text-blue-600'
                  }`}>
                    변동성: {trendAnalysis.volatility.toFixed(1)}%
                  </div>
                </div>
                <div className="text-[48px]">
                  {trendAnalysis.trendDirection === 'rising' ? '📈' :
                   trendAnalysis.trendDirection === 'falling' ? '📉' : '➡️'}
                </div>
              </div>
            </div>

            {/* 예측 정확도 및 인사이트 */}
            <div className="space-y-4">
              <h4 className="text-[16px] font-semibold text-[#191f28]">예측 모델 인사이트</h4>

              <div className={`p-4 rounded-xl ${
                predictionAnalysis.confidence >= 80 ? 'bg-green-50 border border-green-200' :
                predictionAnalysis.confidence >= 60 ? 'bg-yellow-50 border border-yellow-200' :
                'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[14px] font-medium">예측 신뢰도</span>
                  <span className={`text-[16px] font-bold ${
                    predictionAnalysis.confidence >= 80 ? 'text-green-700' :
                    predictionAnalysis.confidence >= 60 ? 'text-yellow-700' :
                    'text-red-700'
                  }`}>
                    {predictionAnalysis.confidence.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      predictionAnalysis.confidence >= 80 ? 'bg-green-500' :
                      predictionAnalysis.confidence >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{width: `${predictionAnalysis.confidence}%`}}
                  ></div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="text-[14px] font-medium text-blue-800 mb-1">📊 계절성 팩터</div>
                <div className="text-[12px] text-blue-700">
                  계절성 분석 데이터가 준비 중입니다.
                </div>
              </div>

              {trendAnalysis.volatility > 30 && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <div className="text-[14px] font-medium text-orange-800 mb-1">⚠️ 높은 변동성 감지</div>
                  <div className="text-[12px] text-orange-700">
                    매출 변동성이 높아 예측 정확도가 낮을 수 있습니다. 안정적인 운영 전략 수립이 필요합니다.
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* ARPU 및 환자당 수익성 분석 - 제거됨 (사용자 요청) */}
      {arpuAnalysis && (
        <SectionCard title="환자당 수익성 분석 (ARPU)" description="환자 1인당 평균 매출 및 효율성 지표">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-blue-600 font-medium">전체 환자 ARPU</div>
                  <div className="text-[24px] font-bold text-blue-700 mt-1">
                    {formatAmount(arpuAnalysis.currentARPU)}
                  </div>
                  <div className="text-[12px] text-blue-600 mt-1">
                    전월 대비 {arpuAnalysis.arpuGrowth >= 0 ? '+' : ''}{arpuAnalysis.arpuGrowth.toFixed(1)}%
                  </div>
                </div>
                <div className="text-[32px] text-blue-500">👥</div>
              </div>
            </div>

            <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-green-600 font-medium">신환 ARPU</div>
                  <div className="text-[24px] font-bold text-green-700 mt-1">
                    {formatAmount(arpuAnalysis.newPatientARPU)}
                  </div>
                  <div className="text-[12px] text-green-600 mt-1">신환 {arpuAnalysis.newPatients}명</div>
                </div>
                <div className="text-[32px] text-green-500">✨</div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-xl p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-purple-600 font-medium">ARPU 효율성</div>
                  <div className="text-[20px] font-bold text-purple-700 mt-1">
                    {arpuAnalysis.currentARPU > arpuAnalysis.newPatientARPU * 0.8 ? '우수' :
                     arpuAnalysis.currentARPU > arpuAnalysis.newPatientARPU * 0.6 ? '보통' : '개선필요'}
                  </div>
                  <div className="text-[12px] text-purple-600 mt-1">
                    총 {arpuAnalysis.totalPatients}명 환자
                  </div>
                </div>
                <div className="text-[32px] text-purple-500">📊</div>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* 목표 관리 및 성과 추적 */}
      <SectionCard
        title="매출 성과 분석 & 전년 대비"
        description="월별 목표 달성률과 전년 동기 대비 매출 성장률을 확인하세요"
      >
        {(!revenueGoals.monthlyGoal && !revenueGoals.yearlyGoal) ? (
          // 목표가 설정되지 않은 경우
          <div className="text-center py-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <Target className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">목표를 설정하여 성과를 관리하세요</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              월별 및 연간 매출 목표를 설정하면 달성률을 실시간으로 추적하고 성장을 관리할 수 있습니다.
            </p>
            <div className="space-y-3">
              <a
                href="/admin/goals"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <Target className="w-4 h-4 mr-2" />
                목표 설정하기
              </a>
              <div className="text-sm text-gray-500">
                관리자 권한이 필요합니다
              </div>
            </div>
          </div>
        ) : monthlyAnalysis ? (
          // 목표가 설정된 경우 기존 UI
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
              <KpiCard
                label="월 목표 달성률"
                value={monthlyAnalysis.monthlyAchievementRate.toFixed(1)}
                unit="%"
                icon={<Target className="w-4 h-4" />}
                color="blue"
              />
              <KpiCard
                label="전년 동월 대비"
                value={(monthlyAnalysis.monthlyGrowthRate || 0).toFixed(1)}
                unit="%"
                icon={<Activity className="w-4 h-4" />}
                color={monthlyAnalysis.monthlyGrowthRate >= 0 ? "green" : "red"}
              />
              <KpiCard
                label="전년 누적 대비"
                value={(previousYearData.growthRate || 0).toFixed(1)}
                unit="%"
                icon={<TrendingUp className="w-4 h-4" />}
                color={previousYearData.growthRate >= 0 ? "green" : "red"}
              />
              <KpiCard
                label="현재 누적 매출"
                value={formatAmount(previousYearData.currentYearTotal)}
                unit=""
                icon={<DollarSign className="w-4 h-4" />}
                color="purple"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 월별 목표 달성 & 전년 대비 현황 */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-6">월별 목표 달성 & 전년 대비</h4>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">월 목표</span>
                  <span className="text-[16px] font-bold text-blue-700">{formatAmount(monthlyAnalysis.monthlyRevenueGoal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">현재 달성</span>
                  <span className="text-[16px] font-bold text-green-700">{formatAmount(monthlyAnalysis.currentRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">전년 동월</span>
                  <span className="text-[16px] font-bold text-gray-700">{formatAmount(monthlyAnalysis.previousYearSameMonth)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">전년 대비</span>
                  <span className={`text-[16px] font-bold ${
                    monthlyAnalysis.monthlyGrowthRate >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {monthlyAnalysis.monthlyGrowthRate >= 0 ? '+' : ''}{monthlyAnalysis.monthlyGrowthRate.toFixed(1)}%
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-4 mt-4">
                  <div
                    className={`h-4 rounded-full transition-all duration-300 ${
                      monthlyAnalysis.monthlyAchievementRate >= 100 ? 'bg-green-500' :
                      monthlyAnalysis.monthlyAchievementRate >= 80 ? 'bg-blue-500' :
                      monthlyAnalysis.monthlyAchievementRate >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{width: `${Math.min(100, monthlyAnalysis.monthlyAchievementRate)}%`}}
                  ></div>
                </div>

                <p className="text-[12px] text-[#6b7280] mt-2 text-center">
                  {monthlyAnalysis.monthlyAchievementRate >= 100 ? '🎉 월 목표 달성!' :
                   monthlyAnalysis.monthlyAchievementRate >= 80 ? '🔥 목표 달성 임박' :
                   monthlyAnalysis.monthlyAchievementRate >= 60 ? '💪 목표 달성 진행 중' :
                   '⚠️ 목표 달성 노력 필요'}
                </p>
              </div>
            </div>

            {/* 전년 대비 매출 현황 */}
            <div className={`bg-gradient-to-r rounded-xl p-6 border ${
              previousYearData.growthRate >= 0
                ? 'from-blue-50 to-green-100 border-blue-200'
                : 'from-red-50 to-orange-100 border-red-200'
            }`}>
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-6">전년 총매출 대비 현황</h4>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">전년 누적매출 ({selectedYear - 1}년 1~{selectedMonth}월)</span>
                  <span className="text-[16px] font-bold text-gray-700">{formatAmount(previousYearData.previousYearTotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">현재 누적매출 ({selectedYear}년 1~{selectedMonth}월)</span>
                  <span className="text-[16px] font-bold text-blue-700">{formatAmount(previousYearData.currentYearTotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">증감액</span>
                  <span className={`text-[16px] font-bold ${
                    previousYearData.growthAmount >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {previousYearData.growthAmount >= 0 ? '+' : ''}{formatAmount(previousYearData.growthAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">증감률</span>
                  <span className={`text-[18px] font-bold ${
                    previousYearData.growthRate >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {previousYearData.growthRate >= 0 ? '+' : ''}{previousYearData.growthRate.toFixed(1)}%
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-4 mt-4">
                  <div
                    className={`h-4 rounded-full transition-all duration-300 ${
                      previousYearData.growthRate >= 20 ? 'bg-green-500' :
                      previousYearData.growthRate >= 10 ? 'bg-blue-500' :
                      previousYearData.growthRate >= 0 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(10, Math.abs(previousYearData.growthRate) * 2))}%`
                    }}
                  ></div>
                </div>

                <p className="text-[12px] text-[#6b7280] mt-2 text-center">
                  {previousYearData.growthRate >= 20 ? '🚀 매우 높은 성장!' :
                   previousYearData.growthRate >= 10 ? '📈 양호한 성장세' :
                   previousYearData.growthRate >= 0 ? '📊 안정적 성장' :
                   previousYearData.growthRate >= -10 ? '⚠️ 소폭 감소' :
                   '🔴 성장 전략 필요'}
                </p>
              </div>
            </div>
          </div>
        </div>
        ) : null}
      </SectionCard>

      {/* 데이터가 없는 경우 */}
      {monthlySummaries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-xl border border-gray-200">
          <DollarSign className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">매출 데이터가 없습니다</h3>
          <p className="text-gray-600 text-center mb-6 max-w-md">
            매출 분석을 보려면 일별 매출 데이터(월간장부)나 기타 매출 관련 데이터를 업로드해주세요
          </p>
          <div className="flex space-x-3">
            <a
              href={`/dashboard/${clinicId}/upload`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Activity className="w-4 h-4 mr-2" />
              데이터 업로드하기
            </a>
            <a
              href="/admin/goals"
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              <Target className="w-4 h-4 mr-2" />
              목표 먼저 설정하기
            </a>
          </div>
        </div>
      )}
    </div>
  )
}