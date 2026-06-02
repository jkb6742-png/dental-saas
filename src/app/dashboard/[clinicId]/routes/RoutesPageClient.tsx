"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"
import YearMonthFilter from "@/components/ui/YearMonthFilter"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, BarChart, Bar, LabelList, ComposedChart } from "recharts"
import { MapPin, TrendingUp, DollarSign, Users } from "lucide-react"

interface VisitRouteData {
  id: string
  routeName: string
  year: number
  month: number
  totalVisitors?: number | null
  newPatients?: number | null
  returningPatients?: number | null
  totalRevenue?: number | null
  avgRevenue?: number | null
  acquisitionCost?: number | null
}

interface RoutesPageClientProps {
  clinicId: string
  initialYear: number
  initialMonth: number
  yearlyData: VisitRouteData[]
  monthlyData: VisitRouteData[]
  availableData: Array<{ year: number; month: number }>
}

export default function RoutesPageClient({
  clinicId,
  initialYear,
  initialMonth,
  yearlyData,
  monthlyData,
  availableData
}: RoutesPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 사용 가능한 내원경로 목록 (실제 데이터가 있는 것만, 평균 제외, 신환 수 기준 정렬)
  const availableRoutes = [...new Set(yearlyData.map(d => d.routeName))]
    .filter(routeName => {
      // "평균" 항목 제외
      if (routeName === "평균" || routeName === "average" || routeName === "Average" || routeName.includes("평균")) {
        return false
      }
      // 해당 내원경로에 실제 데이터가 있는지 확인
      return yearlyData.some(d =>
        d.routeName === routeName &&
        ((d.newPatients || 0) > 0 || (d.returningPatients || 0) > 0 || (d.totalRevenue || 0) > 0)
      )
    })
    .sort((a, b) => {
      const totalA = yearlyData.filter(d => d.routeName === a).reduce((sum, d) => sum + (d.newPatients || 0), 0)
      const totalB = yearlyData.filter(d => d.routeName === b).reduce((sum, d) => sum + (d.newPatients || 0), 0)
      return totalB - totalA // 신환 수 많은 순서로 정렬
    })

  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [selectedRoute, setSelectedRoute] = useState<string>("")

  // URL 업데이트
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', selectedYear.toString())
    params.set('month', selectedMonth.toString())
    router.push(`/dashboard/${clinicId}/routes?${params.toString()}`)
  }, [selectedYear, selectedMonth, clinicId, router, searchParams])

  // 사용 가능한 내원경로가 변경되면 첫 번째 경로로 설정
  useEffect(() => {
    if (availableRoutes.length > 0) {
      if (!selectedRoute || !availableRoutes.includes(selectedRoute)) {
        setSelectedRoute(availableRoutes[0])
      }
    }
  }, [availableRoutes, selectedRoute])

  // 년도별 월간 추이 데이터 생성
  const createYearlyTrendData = () => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    const routes = [...new Set(yearlyData.map(d => d.routeName))]

    // 신환 수 기준 상위 5개 경로만 표시
    const routeTotals = new Map<string, number>()
    yearlyData.forEach(r => {
      routeTotals.set(r.routeName, (routeTotals.get(r.routeName) || 0) + (r.newPatients || 0))
    })
    const topRoutes = [...routeTotals.entries()]
      .filter(([name]) => !name.includes("평균")) // 평균 제외
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name)

    return months.map(month => {
      const monthData: any = { month: `${month}월` }

      topRoutes.forEach(routeName => {
        const data = yearlyData.find(d => d.month === month && d.routeName === routeName)
        monthData[`${routeName}_신환`] = data?.newPatients || 0
        monthData[`${routeName}_구환`] = data?.returningPatients || 0
        monthData[`${routeName}_총환자`] = (data?.newPatients || 0) + (data?.returningPatients || 0)
        monthData[`${routeName}_수익`] = data?.totalRevenue || 0
      })

      return monthData
    })
  }

  // 선택된 내원경로의 월별 데이터
  const selectedRouteData = selectedRoute ?
    yearlyData.filter(d => d.routeName === selectedRoute)
      .filter(d => (d.newPatients || 0) > 0 || (d.returningPatients || 0) > 0 || (d.totalRevenue || 0) > 0)
      .sort((a, b) => a.month - b.month)
      .map(d => ({
        month: `${d.month}월`,
        newPatients: d.newPatients || 0,
        returningPatients: d.returningPatients || 0,
        totalPatients: (d.newPatients || 0) + (d.returningPatients || 0),
        totalRevenue: d.totalRevenue || 0,
        avgRevenue: d.avgRevenue || 0
      })) : []

  // 선택된 월의 내원경로별 데이터 (평균 제외)
  const monthlyChartData = monthlyData
    .filter(item => {
      // "평균" 항목 제외
      return !(item.routeName === "평균" || item.routeName === "average" || item.routeName === "Average" || item.routeName.includes("평균"))
    })
    .sort((a, b) => (b.newPatients || 0) - (a.newPatients || 0)) // 신환 수 많은 순으로 정렬
    .map(item => ({
      name: item.routeName,
      newPatients: item.newPatients || 0,
      returningPatients: item.returningPatients || 0,
      totalPatients: (item.newPatients || 0) + (item.returningPatients || 0),
      totalRevenue: item.totalRevenue || 0
    }))

  // 통계 계산 (평균 제외)
  const filteredMonthlyData = monthlyData.filter(item =>
    !(item.routeName === "평균" || item.routeName === "average" || item.routeName === "Average" || item.routeName.includes("평균"))
  )

  const totalPatients = filteredMonthlyData.reduce((sum, item) => sum + ((item.newPatients || 0) + (item.returningPatients || 0)), 0)
  const totalNewPatients = filteredMonthlyData.reduce((sum, item) => sum + (item.newPatients || 0), 0)
  const totalReturningPatients = filteredMonthlyData.reduce((sum, item) => sum + (item.returningPatients || 0), 0)
  const totalRevenue = filteredMonthlyData.reduce((sum, item) => sum + (item.totalRevenue || 0), 0)

  const topRoute = filteredMonthlyData.sort((a, b) => (b.newPatients || 0) - (a.newPatients || 0))[0]

  // 신환률 계산
  const newPatientRate = totalPatients > 0 ? (totalNewPatients / totalPatients * 100) : 0

  const yearlyTrendData = createYearlyTrendData()

  // 선택된 내원경로의 현재/이전 월 데이터
  const selectedRouteCurrentMonth = yearlyData.find(d => d.routeName === selectedRoute && d.month === selectedMonth)
  const selectedRoutePrevMonth = yearlyData.find(d => d.routeName === selectedRoute && d.month === (selectedMonth === 1 ? 12 : selectedMonth - 1))

  // 월대월 변화율 계산
  const routeMoM = selectedRouteCurrentMonth && selectedRoutePrevMonth ? {
    patientsChange: selectedRoutePrevMonth.newPatients ?
      ((selectedRouteCurrentMonth.newPatients || 0) - (selectedRoutePrevMonth.newPatients || 0)) / (selectedRoutePrevMonth.newPatients || 1) * 100 : 0,
    revenueChange: selectedRoutePrevMonth.totalRevenue ?
      ((selectedRouteCurrentMonth.totalRevenue || 0) - (selectedRoutePrevMonth.totalRevenue || 0)) / (selectedRoutePrevMonth.totalRevenue || 1) * 100 : 0
  } : { patientsChange: 0, revenueChange: 0 }

  // 내원경로별 통계 계산
  const calculateRouteStats = (routeName: string) => {
    const routeData = yearlyData.filter(d => d.routeName === routeName)
    const totalPatients = routeData.reduce((sum, d) => sum + ((d.newPatients || 0) + (d.returningPatients || 0)), 0)
    const totalNewPatients = routeData.reduce((sum, d) => sum + (d.newPatients || 0), 0)
    const totalReturningPatients = routeData.reduce((sum, d) => sum + (d.returningPatients || 0), 0)
    const totalRevenue = routeData.reduce((sum, d) => sum + (d.totalRevenue || 0), 0)
    const newPatientRate = totalPatients > 0 ? (totalNewPatients / totalPatients * 100) : 0

    return {
      totalPatients,
      totalNewPatients,
      totalReturningPatients,
      totalRevenue,
      newPatientRate
    }
  }

  return (
    <div className="space-y-6">
      {/* 년도 헤더 */}
      <div className="text-center border-b border-[#e5e8eb] pb-6">
        <h1 className="text-[32px] font-bold text-[#191f28] mb-2">{selectedYear}년</h1>
        <p className="text-[16px] text-[#6b7280]">내원경로별 환자 분석 리포트</p>
      </div>

      {/* 년도/월 필터 */}
      <YearMonthFilter
        initialYear={selectedYear}
        initialMonth={selectedMonth}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
      />

      {/* 월별 전체 요약 */}
      <SectionCard title={`${selectedYear}년 ${selectedMonth}월 내원경로별 현황`} description="전체 내원경로 요약">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <KpiCard
            label="총 환자"
            value={totalPatients.toLocaleString()}
            unit="명"
            icon={<Users className="w-4 h-4" />}
            color="blue"
          />
          <KpiCard
            label="신환"
            value={totalNewPatients.toLocaleString()}
            unit="명"
            icon={<TrendingUp className="w-4 h-4" />}
            color="green"
          />
          <KpiCard
            label="총 수익"
            value={(totalRevenue / 10000).toFixed(0)}
            unit="만원"
            icon={<DollarSign className="w-4 h-4" />}
            color="yellow"
          />
          <KpiCard
            label="신환 비율"
            value={newPatientRate.toFixed(1)}
            unit="%"
            icon={<TrendingUp className="w-4 h-4" />}
            color="red"
          />
        </div>

        {/* 월별 내원경로별 현황 차트 */}
        {monthlyChartData.length > 0 && (
          <div>
            <h3 className="text-[20px] font-semibold text-[#191f28] mb-6">내원경로별 신환 분포 (상위 10개)</h3>
            <div className="h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData.slice(0, 10)} margin={{ top: 20, right: 30, left: 20, bottom: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    stroke="#9ca3af"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    stroke="#9ca3af"
                    domain={[0, 'dataMax + 20']}
                  />
                  <Bar dataKey="newPatients" fill="#3182f6" name="신환" radius={[4, 4, 0, 0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 차트 하단 요약 정보 */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-[18px] font-bold text-[#3182f6]">{topRoute?.routeName || "—"}</div>
                <div className="text-[12px] text-[#6b7280]">최다 신환 경로</div>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="text-[18px] font-bold text-[#10b981]">{totalNewPatients.toLocaleString()}명</div>
                <div className="text-[12px] text-[#6b7280]">총 신환</div>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4">
                <div className="text-[18px] font-bold text-[#f59e0b]">{(totalRevenue / 10000).toFixed(0)}만원</div>
                <div className="text-[12px] text-[#6b7280]">총 수익</div>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* 내원경로별 상세 분석 */}
      {availableRoutes.length > 0 && (
        <SectionCard title="내원경로별 상세 분석" description="개별 경로 심화 분석">
          {/* 내원경로 선택 */}
          <div className="mb-8">
            <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">분석할 내원경로 선택</h3>

            {/* 상위 15개 내원경로 - 좌우 스크롤 사이드바 */}
            <div className="mb-4">
              <h4 className="text-[14px] font-medium text-[#6b7280] mb-3">상위 15개 경로</h4>
              <div className="relative">
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                  {availableRoutes.slice(0, 15).map((routeName, index) => (
                    <button
                      key={routeName}
                      onClick={() => setSelectedRoute(routeName)}
                      className={`flex-shrink-0 px-4 py-2.5 text-[14px] rounded-xl transition-all duration-200 font-medium ${
                        selectedRoute === routeName
                          ? "bg-[#3182f6] text-white shadow-lg shadow-blue-500/25"
                          : "bg-white text-[#495057] hover:bg-[#f8f9fa] border border-[#e5e8eb] hover:border-[#d1d5db] hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                          selectedRoute === routeName
                            ? "bg-white/20 text-white"
                            : "bg-[#3182f6] text-white"
                        }`}>
                          {index + 1}
                        </span>
                        <span className="max-w-[120px] truncate">{routeName}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* 스크롤 힌트 */}
                {availableRoutes.length > 5 && (
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#f9fafb] to-transparent pointer-events-none"></div>
                )}
              </div>
            </div>

            {/* 나머지 경로들 - 드롭다운 */}
            {availableRoutes.length > 15 && (
              <div>
                <h4 className="text-[14px] font-medium text-[#6b7280] mb-3">기타 경로 ({availableRoutes.length - 15}개)</h4>
                <div className="relative">
                  <select
                    value={availableRoutes.slice(0, 15).includes(selectedRoute) ? "" : selectedRoute}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedRoute(e.target.value)
                      }
                    }}
                    className="w-full max-w-xs px-4 py-2.5 text-[14px] bg-white border border-[#e5e8eb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3182f6] focus:border-transparent transition-all"
                  >
                    <option value="">기타 경로 선택...</option>
                    {availableRoutes.slice(15).map((routeName, index) => (
                      <option key={routeName} value={routeName}>
                        {index + 16}. {routeName}
                      </option>
                    ))}
                  </select>

                  {/* 현재 선택된 기타 경로 표시 */}
                  {selectedRoute && !availableRoutes.slice(0, 15).includes(selectedRoute) && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-[#3182f6] text-white text-[13px] rounded-lg">
                      <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] font-bold flex items-center justify-center">
                        {availableRoutes.indexOf(selectedRoute) + 1}
                      </span>
                      <span className="max-w-[150px] truncate">{selectedRoute}</span>
                      <button
                        onClick={() => setSelectedRoute(availableRoutes[0])}
                        className="ml-1 text-white/80 hover:text-white"
                        title="선택 해제"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedRoute && (
            <>
              {/* 선택된 내원경로 KPI */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                <KpiCard
                  label={`${selectedMonth}월 환자`}
                  value={((selectedRouteCurrentMonth?.newPatients || 0) + (selectedRouteCurrentMonth?.returningPatients || 0)).toLocaleString()}
                  unit="명"
                  changeLabel={`${routeMoM.patientsChange >= 0 ? '↗' : '↘'} ${Math.abs(routeMoM.patientsChange).toFixed(1)}% ${routeMoM.patientsChange >= 0 ? '증가' : '감소'}`}
                  icon={<Users className="w-4 h-4" />}
                  color="blue"
                />
                <KpiCard
                  label={`${selectedMonth}월 신환`}
                  value={(selectedRouteCurrentMonth?.newPatients || 0).toLocaleString()}
                  unit="명"
                  icon={<TrendingUp className="w-4 h-4" />}
                  color="green"
                />
                <KpiCard
                  label={`${selectedMonth}월 구환`}
                  value={(selectedRouteCurrentMonth?.returningPatients || 0).toLocaleString()}
                  unit="명"
                  icon={<MapPin className="w-4 h-4" />}
                  color="yellow"
                />
                <KpiCard
                  label={`${selectedMonth}월 수익`}
                  value={((selectedRouteCurrentMonth?.totalRevenue || 0) / 10000).toFixed(0)}
                  unit="만원"
                  changeLabel={`${routeMoM.revenueChange >= 0 ? '↗' : '↘'} ${Math.abs(routeMoM.revenueChange).toFixed(1)}% ${routeMoM.revenueChange >= 0 ? '증가' : '감소'}`}
                  icon={<DollarSign className="w-4 h-4" />}
                  color="red"
                />
              </div>

              {/* 연간 요약 통계 */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 mb-8 border border-gray-200">
                <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">{selectedYear}년 연간 요약 - {selectedRoute}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#3182f6] mb-1">
                      {calculateRouteStats(selectedRoute).totalPatients.toLocaleString()}명
                    </div>
                    <div className="text-[12px] text-[#6b7280]">연간 총 환자</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#10b981] mb-1">
                      {calculateRouteStats(selectedRoute).totalNewPatients.toLocaleString()}명
                    </div>
                    <div className="text-[12px] text-[#6b7280]">연간 신환</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#f59e0b] mb-1">
                      {calculateRouteStats(selectedRoute).newPatientRate.toFixed(1)}%
                    </div>
                    <div className="text-[12px] text-[#6b7280]">신환 비율</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#ef4444] mb-1">
                      {(calculateRouteStats(selectedRoute).totalRevenue / 10000).toFixed(0)}만원
                    </div>
                    <div className="text-[12px] text-[#6b7280]">연간 총 수익</div>
                  </div>
                </div>
              </div>

              {/* 선택된 내원경로 월별 추이 차트 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 환자 수 추이 */}
                <div>
                  <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">{selectedRoute} 월별 환자 수 추이</h3>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={selectedRouteData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12, fill: "#6b7280" }}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#6b7280" }}
                          stroke="#9ca3af"
                          domain={[0, 'dataMax + 10']}
                        />
                        <Legend />

                        {/* 총 환자 - 막대 차트 */}
                        <Bar
                          dataKey="totalPatients"
                          fill="#e2e8f0"
                          name="총 환자"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        />

                        {/* 신환 - 꺾은선 차트 */}
                        <Line
                          type="linear"
                          dataKey="newPatients"
                          stroke="#3182f6"
                          strokeWidth={3}
                          name="신환"
                          dot={{ r: 5, fill: "#3182f6", strokeWidth: 2, stroke: "#ffffff" }}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 월별 수익 추이 */}
                <div>
                  <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">{selectedRoute} 월별 수익 추이 (만원)</h3>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={selectedRouteData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12, fill: "#6b7280" }}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#6b7280" }}
                          stroke="#9ca3af"
                          domain={[0, 'dataMax + 50000']}
                          tickFormatter={(value) => `${(value/10000).toFixed(0)}`}
                        />
                        <Bar
                          dataKey="totalRevenue"
                          fill="#8b5cf6"
                          radius={[4, 4, 0, 0]}
                          name="총 수익"
                          isAnimationActive={false}
                        >
                          <LabelList
                            dataKey="totalRevenue"
                            position="top"
                            formatter={(value: any) => `${(value/10000).toFixed(0)}만`}
                            style={{ fontSize: '11px', fill: '#374151' }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}
        </SectionCard>
      )}

      {/* 년도별 월간 전체 내원경로 추이 */}
      {yearlyTrendData.length > 0 && (
        <SectionCard title={`${selectedYear}년 내원경로별 월간 추이`} description="상위 5개 경로 비교">
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yearlyTrendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  stroke="#9ca3af"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  stroke="#9ca3af"
                  domain={[0, 'dataMax + 5']}
                />
                <Legend />
                {[...new Set(yearlyData.map(d => d.routeName))]
                  .filter(routeName => !routeName.includes("평균"))
                  .filter(routeName => {
                    const total = yearlyData.filter(d => d.routeName === routeName).reduce((sum, d) => sum + (d.newPatients || 0), 0)
                    return total > 0
                  })
                  .sort((a, b) => {
                    const totalA = yearlyData.filter(d => d.routeName === a).reduce((sum, d) => sum + (d.newPatients || 0), 0)
                    const totalB = yearlyData.filter(d => d.routeName === b).reduce((sum, d) => sum + (d.newPatients || 0), 0)
                    return totalB - totalA
                  })
                  .slice(0, 5)
                  .map((routeName, index) => {
                    const colors = ['#3182f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                    return (
                      <Line
                        key={routeName}
                        type="linear"
                        dataKey={`${routeName}_신환`}
                        stroke={colors[index]}
                        strokeWidth={3}
                        name={routeName.length > 15 ? routeName.substring(0, 15) + '...' : routeName}
                        dot={{ r: 4, fill: colors[index] }}
                        isAnimationActive={false}
                      />
                    )
                  })
                }
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      {/* 월별 상세 데이터 테이블 */}
      <SectionCard title={`${selectedYear}년 ${selectedMonth}월 내원경로별 상세 데이터`}>
        {filteredMonthlyData.length === 0 ? (
          <div className="text-center py-12 text-[14px] text-[#8b95a1]">
            {selectedYear}년 {selectedMonth}월 내원경로별 데이터가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-[#e5e8eb] bg-[#f8f9fa]">
                  <th className="text-left p-4 font-semibold text-[#495057]">내원경로</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">신환</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">구환</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">총 환자</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">신환률</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">총 수익</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonthlyData
                  .sort((a, b) => (b.newPatients || 0) - (a.newPatients || 0))
                  .map((route, index) => {
                    const totalPatients = (route.newPatients || 0) + (route.returningPatients || 0)
                    const newPatientRate = totalPatients > 0 ?
                      ((route.newPatients || 0) / totalPatients * 100) : 0

                    return (
                      <tr key={route.routeName} className="border-b border-[#e5e8eb] hover:bg-[#f8f9fa]">
                        <td className="p-4 font-medium text-[#191f28]">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-[#3182f6] text-white rounded-full text-[12px] flex items-center justify-center font-bold">
                              {index + 1}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4 text-[#6b7280]" />
                              <span className="max-w-[150px] truncate" title={route.routeName}>
                                {route.routeName}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#3182f6] font-medium">
                          {(route.newPatients || 0).toLocaleString()}
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#10b981] font-medium">
                          {(route.returningPatients || 0).toLocaleString()}
                        </td>
                        <td className="text-center p-4 tabular-nums font-semibold text-[#191f28]">
                          {totalPatients.toLocaleString()}
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#6b7280]">
                          {newPatientRate.toFixed(1)}%
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#191f28] font-medium">
                          {((route.totalRevenue || 0) / 10000).toFixed(0)}만원
                        </td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* 데이터가 없는 경우 */}
      {availableRoutes.length === 0 && (
        <div className="text-center py-12 text-[14px] text-[#8b95a1]">
          선택된 년도에 내원경로별 데이터가 없습니다.
        </div>
      )}
    </div>
  )
}