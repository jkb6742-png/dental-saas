"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, Tooltip, LabelList, Cell } from "recharts"
import { MapPin, TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react"

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

  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [selectedDataType, setSelectedDataType] = useState<'newPatients' | 'returningPatients' | 'totalPatients'>('totalPatients')

  // 내원경로 목록 (평균 제외, 실제 데이터만)
  const availableCategories = [...new Set(yearlyData.map(d => d.routeName))]
    .filter(routeName => {
      if (routeName === "평균" || routeName === "average" || routeName === "Average" || routeName.includes("평균")) {
        return false
      }
      return yearlyData.some(d =>
        d.routeName === routeName &&
        ((d.newPatients || 0) > 0 || (d.returningPatients || 0) > 0)
      )
    })
    .sort((a, b) => {
      const totalA = yearlyData.filter(d => d.routeName === a).reduce((sum, d) => sum + (d.newPatients || 0), 0)
      const totalB = yearlyData.filter(d => d.routeName === b).reduce((sum, d) => sum + (d.newPatients || 0), 0)
      return totalB - totalA
    })

  // URL 업데이트 (클라이언트에서만)
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    // 이미 같은 URL이면 재이동(전체 서버 재조회+재렌더) 하지 않음 → 마운트 시 불필요한 리로드 방지
    if (params.get('year') === String(selectedYear) && params.get('month') === String(selectedMonth)) return
    params.set('year', selectedYear.toString())
    params.set('month', selectedMonth.toString())
    router.push(`/dashboard/${clinicId}/routes?${params.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth])

  // 통계 계산
  const filteredMonthlyData = monthlyData.filter(item =>
    !(item.routeName === "평균" || item.routeName === "average" || item.routeName === "Average" || item.routeName.includes("평균"))
  )

  // 전월 데이터 계산
  const getPreviousMonth = (year: number, month: number) => {
    if (month === 1) {
      return { year: year - 1, month: 12 }
    }
    return { year, month: month - 1 }
  }

  const { year: prevYear, month: prevMonth } = getPreviousMonth(selectedYear, selectedMonth)

  const previousMonthData = yearlyData.filter(item =>
    item.year === prevYear &&
    item.month === prevMonth &&
    !(item.routeName === "평균" || item.routeName === "average" || item.routeName === "Average" || item.routeName.includes("평균"))
  )

  const calculateGrowthRate = (currentValue: number, previousValue: number) => {
    if (previousValue === 0) {
      return currentValue > 0 ? 100 : 0
    }
    return ((currentValue - previousValue) / previousValue) * 100
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="space-y-8 p-6">
        {/* 헤더 섹션 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">내원경로별 분석</h1>
              <p className="text-slate-600">내원경로별 신환, 구환 현황과 ROI를 분석하세요.</p>
            </div>

            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-slate-500" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-2 bg-white/90 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value={2025}>2025년</option>
                <option value={2026}>2026년</option>
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="px-4 py-2 bg-white/90 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                {Array.from({length: 12}, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}월</option>
                ))}
              </select>
              <span className="text-slate-600 font-medium bg-slate-100/50 px-3 py-2 rounded-lg">
                {selectedYear}년 {selectedMonth}월
              </span>
            </div>
          </div>
        </div>

        {/* 내원경로별 상세 분석 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-slate-900">내원경로별 상세 분석</h3>
            <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs px-3 py-1 rounded-full font-medium">
              {selectedYear}년 1~{selectedMonth}월
            </span>
          </div>

          {availableCategories.length === 0 ? (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg">📊</span>
                </div>
                <div>
                  <h3 className="font-semibold text-amber-800 mb-1">데이터가 없습니다</h3>
                  <p className="text-sm text-amber-700">
                    내원경로별 데이터가 없습니다. 데이터를 업로드해주세요.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {availableCategories.slice(0, 10).map((routeName, index) => {
                // 1월부터 현재월까지 데이터
                const categoryData = Array.from({ length: selectedMonth }, (_, i) => {
                  const month = i + 1
                  const data = yearlyData.find(d => d.routeName === routeName && d.month === month)
                  return {
                    month: `${month}월`,
                    newPatients: data?.newPatients || 0,
                    returningPatients: data?.returningPatients || 0,
                    totalPatients: (data?.newPatients || 0) + (data?.returningPatients || 0)
                  }
                })

                const totalCategoryPatients = categoryData.reduce((sum, d) => sum + d.totalPatients, 0)
                const totalCategoryNewPatients = categoryData.reduce((sum, d) => sum + d.newPatients, 0)
                const totalCategoryReturningPatients = categoryData.reduce((sum, d) => sum + d.returningPatients, 0)

                // 현재 월 데이터
                const currentMonthData = monthlyData.find(d => d.routeName === routeName)
                const currentMonthTotal = (currentMonthData?.newPatients || 0) + (currentMonthData?.returningPatients || 0)

                // 전월 데이터
                const previousCategoryData = previousMonthData.find(d => d.routeName === routeName)
                const previousMonthTotal = (previousCategoryData?.newPatients || 0) + (previousCategoryData?.returningPatients || 0)

                // 전월 대비 증감률
                const growthRate = calculateGrowthRate(currentMonthTotal, previousMonthTotal)

                if (totalCategoryPatients === 0) return null

                // 색상 배치
                const colors = [
                  { primary: "#3b82f6", light: "#dbeafe" },
                  { primary: "#10b981", light: "#d1fae5" },
                  { primary: "#f59e0b", light: "#fef3c7" },
                  { primary: "#ef4444", light: "#fee2e2" },
                  { primary: "#8b5cf6", light: "#ede9fe" },
                ]
                const color = colors[index % colors.length]
                const lineColor = selectedDataType === 'newPatients' ? '#3b82f6'
                  : selectedDataType === 'returningPatients' ? '#10b981' : '#8b5cf6'

                return (
                  <div key={routeName} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div
                        className="w-8 h-8 rounded-full text-white text-[14px] flex items-center justify-center font-bold"
                        style={{ backgroundColor: color.primary }}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-1">{routeName}</h3>
                      </div>
                    </div>

                    {/* 데이터 타입 선택 토글 */}
                    <div className="flex justify-end mb-4">
                      <div className="bg-white/90 backdrop-blur-sm rounded-lg border border-slate-200 p-1 flex items-center gap-1">
                        <button
                          onClick={() => setSelectedDataType('newPatients')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedDataType === 'newPatients'
                              ? 'bg-blue-500 text-white shadow-md'
                              : 'bg-transparent text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          신환
                        </button>
                        <button
                          onClick={() => setSelectedDataType('returningPatients')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedDataType === 'returningPatients'
                              ? 'bg-green-500 text-white shadow-md'
                              : 'bg-transparent text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          구환
                        </button>
                        <button
                          onClick={() => setSelectedDataType('totalPatients')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedDataType === 'totalPatients'
                              ? 'bg-purple-500 text-white shadow-md'
                              : 'bg-transparent text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          총환자
                        </button>
                      </div>
                    </div>

                    {/* 차트 */}
                    <div className="relative h-80 mb-8 w-full min-h-[320px] min-w-0">
                      <ResponsiveContainer width="100%" height={320} minHeight={320}>
                        <LineChart data={categoryData} margin={{ top: 24, right: 24, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 12, fill: "#64748b" }}
                            axisLine={false}
                            tickLine={false}
                            tickMargin={10}
                            padding={{ left: 16, right: 16 }}
                          />
                          <YAxis
                            tick={{ fontSize: 12, fill: "#64748b" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => `${value}명`}
                            width={60}
                            tickMargin={8}
                          />
                          <Tooltip
                            formatter={(value: any) => [
                              `${value}명`,
                              selectedDataType === 'newPatients' ? '신환' :
                              selectedDataType === 'returningPatients' ? '구환' : '총환자'
                            ]}
                            contentStyle={{
                              borderRadius: 12,
                              border: 'none',
                              boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.15)',
                              fontSize: 13
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey={selectedDataType}
                            stroke={lineColor}
                            strokeWidth={3}
                            dot={{ r: 5, fill: lineColor, strokeWidth: 2, stroke: '#ffffff' }}
                            activeDot={{ r: 8 }}
                          >
                            <LabelList
                              dataKey={selectedDataType}
                              position="top"
                              offset={12}
                              formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? String(v) : '')}
                              style={{ fontSize: 11, fontWeight: 700, fill: lineColor }}
                            />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* 통계 정보 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 rounded-lg" style={{ backgroundColor: color.light }}>
                        <div className="text-[16px] font-bold text-slate-900">{totalCategoryPatients.toLocaleString()}명</div>
                        <div className="text-[12px] text-slate-600">연간 총인원</div>
                      </div>
                      <div className="text-center p-3 rounded-lg" style={{ backgroundColor: color.light }}>
                        <div className="text-[16px] font-bold text-slate-900">{totalCategoryNewPatients.toLocaleString()}명</div>
                        <div className="text-[12px] text-slate-600">연간 신환</div>
                      </div>
                      <div className="text-center p-3 rounded-lg" style={{ backgroundColor: color.light }}>
                        <div className="text-[16px] font-bold text-slate-900">{totalCategoryReturningPatients.toLocaleString()}명</div>
                        <div className="text-[12px] text-slate-600">연간 구환</div>
                      </div>
                      <div className="text-center p-3 rounded-lg" style={{ backgroundColor: color.light }}>
                        <div className={`text-[16px] font-bold flex items-center justify-center gap-1 ${
                          growthRate > 0 ? 'text-green-600' : growthRate < 0 ? 'text-red-600' : 'text-slate-900'
                        }`}>
                          {growthRate > 0 ? <TrendingUp className="w-4 h-4" /> :
                           growthRate < 0 ? <TrendingDown className="w-4 h-4" /> :
                           <Minus className="w-4 h-4" />}
                          {Math.abs(growthRate).toFixed(1)}%
                        </div>
                        <div className="text-[12px] text-slate-600">전월 대비</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 월별 상세 데이터 테이블 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
            <h3 className="text-xl font-bold text-slate-900">
              {selectedYear}년 {selectedMonth}월 내원경로별 상세 데이터
            </h3>
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs px-3 py-1 rounded-full font-medium">
              월간통계
            </span>
          </div>

          {filteredMonthlyData.length === 0 ? (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg">📊</span>
                </div>
                <div>
                  <h3 className="font-semibold text-amber-800 mb-1">데이터가 없습니다</h3>
                  <p className="text-sm text-amber-700">
                    {selectedYear}년 {selectedMonth}월 내원경로별 데이터가 없습니다.
                  </p>
                </div>
              </div>
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
                        <tr key={`${route.routeName}-${index}`} className="border-b border-[#e5e8eb] hover:bg-[#f8f9fa]">
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
        </div>
      </div>
    </div>
  )
}