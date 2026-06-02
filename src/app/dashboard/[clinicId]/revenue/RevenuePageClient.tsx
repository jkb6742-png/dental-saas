"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"
import YearMonthFilter from "@/components/ui/YearMonthFilter"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, BarChart, Bar, ComposedChart, Area, AreaChart } from "recharts"
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

    return {
      currentRevenue,
      momGrowth,
      yoyGrowth,
      ytdGrowth,
      yearToDateRevenue,
      lastYearToDateRevenue
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

  // 3. 예측 모델링
  const getPredictionAnalysis = () => {
    const trendData = getTrendAnalysis()
    if (!trendData) return null

    const currentRevenue = currentMonthData?.totalRevenue || 0
    const avgGrowth = trendData.recent6Months.slice(1).reduce((sum, month, index) => {
      const prevRevenue = trendData.recent6Months[index]?.revenue || 1
      return sum + ((month.revenue - prevRevenue) / prevRevenue)
    }, 0) / (trendData.recent6Months.length - 1)

    // 다음달 예측 (트렌드 기반)
    const nextMonthPrediction = currentRevenue * (1 + avgGrowth)

    // 연말 예측 (현재 월부터 12월까지)
    const remainingMonths = 12 - selectedMonth
    let yearEndPrediction = monthlySummaries
      .filter(s => s.year === selectedYear && s.month <= selectedMonth)
      .reduce((sum, s) => sum + (s.totalRevenue || 0), 0)

    for (let i = 0; i < remainingMonths; i++) {
      yearEndPrediction += currentRevenue * (1 + avgGrowth * (i + 1) / 12)
    }

    // 계절성 팩터 (전년 동월 대비 평균)
    const seasonalFactors = []
    for (let m = 1; m <= 12; m++) {
      const thisYearMonth = monthlySummaries.find(s => s.year === selectedYear && s.month === m)
      const lastYearMonth = monthlySummaries.find(s => s.year === selectedYear - 1 && s.month === m)
      if (thisYearMonth && lastYearMonth && lastYearMonth.totalRevenue) {
        seasonalFactors.push((thisYearMonth.totalRevenue || 0) / lastYearMonth.totalRevenue)
      }
    }

    const avgSeasonalFactor = seasonalFactors.length > 0 ?
      seasonalFactors.reduce((sum, f) => sum + f, 0) / seasonalFactors.length : 1

    return {
      nextMonthPrediction,
      yearEndPrediction,
      avgGrowthRate: avgGrowth * 100,
      seasonalFactor: (avgSeasonalFactor - 1) * 100,
      confidence: Math.max(0, Math.min(100, 100 - trendData.volatility))
    }
  }

  // 4. ARPU 분석
  const getARPUAnalysis = () => {
    if (!currentMonthData) return null

    const currentARPU = (currentMonthData.totalPatients || 0) > 0 ?
      (currentMonthData.totalRevenue || 0) / (currentMonthData.totalPatients || 1) : 0

    const prevARPU = (prevMonthData?.totalPatients || 0) > 0 ?
      (prevMonthData?.totalRevenue || 0) / (prevMonthData?.totalPatients || 1) : 0

    const arpuGrowth = prevARPU > 0 ? ((currentARPU - prevARPU) / prevARPU) * 100 : 0

    const newPatientARPU = (currentMonthData.newPatients || 0) > 0 ?
      (currentMonthData.newPatientRevenue || 0) / (currentMonthData.newPatients || 1) : 0

    return {
      currentARPU,
      arpuGrowth,
      newPatientARPU,
      totalPatients: currentMonthData.totalPatients || 0,
      newPatients: currentMonthData.newPatients || 0
    }
  }

  // 5. 목표 관리 (예시 목표값들)
  const getGoalAnalysis = () => {
    const monthlyRevenueGoal = 50000000 // 5천만원 예시
    const yearlyRevenueGoal = 600000000 // 6억원 예시

    const currentRevenue = currentMonthData?.totalRevenue || 0
    const monthlyAchievementRate = (currentRevenue / monthlyRevenueGoal) * 100

    const ytdRevenue = monthlySummaries
      .filter(s => s.year === selectedYear && s.month <= selectedMonth)
      .reduce((sum, s) => sum + (s.totalRevenue || 0), 0)

    const yearlyAchievementRate = (ytdRevenue / yearlyRevenueGoal) * 100

    // 연말까지 필요한 월평균 매출
    const remainingMonths = Math.max(0, 12 - selectedMonth)
    const requiredMonthlyAverage = remainingMonths > 0 ?
      (yearlyRevenueGoal - ytdRevenue) / remainingMonths : 0

    return {
      monthlyRevenueGoal,
      yearlyRevenueGoal,
      currentRevenue,
      ytdRevenue,
      monthlyAchievementRate,
      yearlyAchievementRate,
      remainingMonths,
      requiredMonthlyAverage
    }
  }

  // 연간 트렌드 데이터 생성
  const createYearlyTrendData = () => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1)

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
  const predictionAnalysis = getPredictionAnalysis()
  const arpuAnalysis = getARPUAnalysis()
  const goalAnalysis = getGoalAnalysis()
  const yearlyTrendData = createYearlyTrendData()

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
            label="누적 성장률"
            value={growthAnalysis.ytdGrowth.toFixed(1)}
            unit="%"
            icon={<Activity className="w-4 h-4" />}
            color={growthAnalysis.ytdGrowth >= 0 ? "green" : "red"}
          />
          {arpuAnalysis && (
            <KpiCard
              label="환자당 매출 (ARPU)"
              value={formatAmount(arpuAnalysis.currentARPU)}
              unit=""
              change={arpuAnalysis.arpuGrowth}
              changeLabel="전월 대비"
              icon={<Target className="w-4 h-4" />}
              color="yellow"
            />
          )}
        </div>

        {/* 성장률 상세 분석 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`rounded-xl p-6 border-l-4 ${
            growthAnalysis.momGrowth >= 5 ? 'bg-green-50 border-green-500' :
            growthAnalysis.momGrowth >= 0 ? 'bg-blue-50 border-blue-500' :
            growthAnalysis.momGrowth >= -5 ? 'bg-yellow-50 border-yellow-500' :
            'bg-red-50 border-red-500'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-[14px] font-medium ${
                  growthAnalysis.momGrowth >= 5 ? 'text-green-600' :
                  growthAnalysis.momGrowth >= 0 ? 'text-blue-600' :
                  growthAnalysis.momGrowth >= -5 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>월대월 성장률</div>
                <div className={`text-[24px] font-bold mt-1 ${
                  growthAnalysis.momGrowth >= 5 ? 'text-green-700' :
                  growthAnalysis.momGrowth >= 0 ? 'text-blue-700' :
                  growthAnalysis.momGrowth >= -5 ? 'text-yellow-700' :
                  'text-red-700'
                }`}>
                  {growthAnalysis.momGrowth >= 0 ? '+' : ''}{growthAnalysis.momGrowth.toFixed(1)}%
                </div>
                <div className={`text-[12px] mt-1 ${
                  growthAnalysis.momGrowth >= 5 ? 'text-green-600' :
                  growthAnalysis.momGrowth >= 0 ? 'text-blue-600' :
                  growthAnalysis.momGrowth >= -5 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {growthAnalysis.momGrowth >= 5 ? '🚀 급성장' :
                   growthAnalysis.momGrowth >= 0 ? '📈 성장' :
                   growthAnalysis.momGrowth >= -5 ? '⚠️ 소폭 하락' :
                   '📉 큰 폭 하락'}
                </div>
              </div>
              <div className="text-[32px]">
                {growthAnalysis.momGrowth >= 5 ? '🚀' :
                 growthAnalysis.momGrowth >= 0 ? '📈' :
                 growthAnalysis.momGrowth >= -5 ? '⚠️' : '📉'}
              </div>
            </div>
          </div>

          <div className={`rounded-xl p-6 border-l-4 ${
            growthAnalysis.yoyGrowth >= 10 ? 'bg-green-50 border-green-500' :
            growthAnalysis.yoyGrowth >= 0 ? 'bg-blue-50 border-blue-500' :
            'bg-red-50 border-red-500'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-[14px] font-medium ${
                  growthAnalysis.yoyGrowth >= 10 ? 'text-green-600' :
                  growthAnalysis.yoyGrowth >= 0 ? 'text-blue-600' :
                  'text-red-600'
                }`}>년대년 성장률</div>
                <div className={`text-[24px] font-bold mt-1 ${
                  growthAnalysis.yoyGrowth >= 10 ? 'text-green-700' :
                  growthAnalysis.yoyGrowth >= 0 ? 'text-blue-700' :
                  'text-red-700'
                }`}>
                  {growthAnalysis.yoyGrowth >= 0 ? '+' : ''}{growthAnalysis.yoyGrowth.toFixed(1)}%
                </div>
                <div className={`text-[12px] mt-1 ${
                  growthAnalysis.yoyGrowth >= 10 ? 'text-green-600' :
                  growthAnalysis.yoyGrowth >= 0 ? 'text-blue-600' :
                  'text-red-600'
                }`}>전년 동월 대비</div>
              </div>
              <div className="text-[32px]">📅</div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-xl p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] text-purple-600 font-medium">누적 매출</div>
                <div className="text-[24px] font-bold text-purple-700 mt-1">
                  {formatAmount(growthAnalysis.yearToDateRevenue)}
                </div>
                <div className="text-[12px] text-purple-600 mt-1">
                  전년 대비 {growthAnalysis.ytdGrowth >= 0 ? '+' : ''}{growthAnalysis.ytdGrowth.toFixed(1)}%
                </div>
              </div>
              <div className="text-[32px] text-purple-500">💰</div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 연간 매출 추이 및 성장 트렌드 */}
      <SectionCard title={`${selectedYear}년 매출 추이 분석`} description="월별 성장 패턴 및 전년 대비">
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
                tickFormatter={(value) => formatAmount(value)}
              />
              <Legend />

              {/* 면적 차트 - 전년도 */}
              <Area
                dataKey="전년도"
                fill="#e5e8eb"
                stroke="#9ca3af"
                strokeWidth={2}
                name="전년도 매출"
                fillOpacity={0.3}
              />

              {/* 막대 차트 - 현재년도 */}
              <Bar
                dataKey="현재년도"
                fill="#3182f6"
                name="현재년도 매출"
                radius={[4, 4, 0, 0]}
              />

              {/* 선 차트 - 순이익 */}
              <Line
                type="monotone"
                dataKey="순이익"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 5 }}
                name="순이익"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* 트렌드 분석 및 예측 */}
      {trendAnalysis && predictionAnalysis && (
        <SectionCard title="트렌드 분석 및 매출 예측" description="데이터 기반 매출 전망">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <KpiCard
              label="다음달 예상 매출"
              value={formatAmount(predictionAnalysis.nextMonthPrediction)}
              unit=""
              icon={<Calendar className="w-4 h-4" />}
              color="blue"
            />
            <KpiCard
              label="연말 예상 매출"
              value={formatAmount(predictionAnalysis.yearEndPrediction)}
              unit=""
              icon={<Target className="w-4 h-4" />}
              color="green"
            />
            <KpiCard
              label="평균 성장률"
              value={predictionAnalysis.avgGrowthRate.toFixed(1)}
              unit="% (월평균)"
              icon={<TrendingUp className="w-4 h-4" />}
              color="yellow"
            />
            <KpiCard
              label="예측 신뢰도"
              value={predictionAnalysis.confidence.toFixed(0)}
              unit="%"
              icon={<AlertCircle className="w-4 h-4" />}
              color="red"
            />
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
                  {predictionAnalysis.seasonalFactor > 0 ?
                    `이 시기는 평균보다 ${predictionAnalysis.seasonalFactor.toFixed(1)}% 높은 매출을 보입니다` :
                    `이 시기는 평균보다 ${Math.abs(predictionAnalysis.seasonalFactor).toFixed(1)}% 낮은 매출을 보입니다`
                  }
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

      {/* ARPU 및 환자당 수익성 분석 */}
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
      {goalAnalysis && (
        <SectionCard title="목표 관리 및 달성 현황" description="매출 목표 대비 실적 추적">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <KpiCard
              label="월 목표 달성률"
              value={goalAnalysis.monthlyAchievementRate.toFixed(1)}
              unit="%"
              icon={<Target className="w-4 h-4" />}
              color="blue"
            />
            <KpiCard
              label="연간 목표 달성률"
              value={goalAnalysis.yearlyAchievementRate.toFixed(1)}
              unit="%"
              icon={<Activity className="w-4 h-4" />}
              color="green"
            />
            <KpiCard
              label="연말까지 남은 달"
              value={goalAnalysis.remainingMonths.toString()}
              unit="개월"
              icon={<Calendar className="w-4 h-4" />}
              color="yellow"
            />
            <KpiCard
              label="필요 월평균 매출"
              value={formatAmount(goalAnalysis.requiredMonthlyAverage)}
              unit=""
              icon={<TrendingUp className="w-4 h-4" />}
              color="red"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 월 목표 달성 현황 */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-6">월별 목표 달성 현황</h4>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">목표</span>
                  <span className="text-[16px] font-bold text-blue-700">{formatAmount(goalAnalysis.monthlyRevenueGoal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">현재 달성</span>
                  <span className="text-[16px] font-bold text-green-700">{formatAmount(goalAnalysis.currentRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">남은 목표</span>
                  <span className="text-[16px] font-bold text-red-700">
                    {formatAmount(Math.max(0, goalAnalysis.monthlyRevenueGoal - goalAnalysis.currentRevenue))}
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-4 mt-4">
                  <div
                    className={`h-4 rounded-full transition-all duration-300 ${
                      goalAnalysis.monthlyAchievementRate >= 100 ? 'bg-green-500' :
                      goalAnalysis.monthlyAchievementRate >= 80 ? 'bg-blue-500' :
                      goalAnalysis.monthlyAchievementRate >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{width: `${Math.min(100, goalAnalysis.monthlyAchievementRate)}%`}}
                  ></div>
                </div>

                <p className="text-[12px] text-[#6b7280] mt-2 text-center">
                  {goalAnalysis.monthlyAchievementRate >= 100 ? '🎉 월 목표 달성!' :
                   goalAnalysis.monthlyAchievementRate >= 80 ? '🔥 목표 달성 임박' :
                   goalAnalysis.monthlyAchievementRate >= 60 ? '💪 목표 달성 진행 중' :
                   '⚠️ 목표 달성 노력 필요'}
                </p>
              </div>
            </div>

            {/* 연간 목표 달성 현황 */}
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-6">연간 목표 달성 현황</h4>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">연간 목표</span>
                  <span className="text-[16px] font-bold text-green-700">{formatAmount(goalAnalysis.yearlyRevenueGoal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">현재 누적</span>
                  <span className="text-[16px] font-bold text-blue-700">{formatAmount(goalAnalysis.ytdRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">필요 월평균</span>
                  <span className="text-[16px] font-bold text-purple-700">
                    {formatAmount(goalAnalysis.requiredMonthlyAverage)}
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-4 mt-4">
                  <div
                    className={`h-4 rounded-full transition-all duration-300 ${
                      goalAnalysis.yearlyAchievementRate >= 100 ? 'bg-green-500' :
                      goalAnalysis.yearlyAchievementRate >= (selectedMonth / 12 * 100) ? 'bg-blue-500' :
                      'bg-yellow-500'
                    }`}
                    style={{width: `${Math.min(100, goalAnalysis.yearlyAchievementRate)}%`}}
                  ></div>
                </div>

                <p className="text-[12px] text-[#6b7280] mt-2 text-center">
                  {goalAnalysis.yearlyAchievementRate >= 100 ? '🎊 연간 목표 달성!' :
                   goalAnalysis.yearlyAchievementRate >= (selectedMonth / 12 * 100) ? '📈 목표 대비 순조로운 진행' :
                   '📊 추가 성장 전략 필요'}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* 데이터가 없는 경우 */}
      {monthlySummaries.length === 0 && (
        <div className="text-center py-12 text-[14px] text-[#8b95a1]">
          매출 데이터가 없습니다. 월간 요약 데이터를 생성해주세요.
        </div>
      )}
    </div>
  )
}