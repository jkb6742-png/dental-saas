"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"
import YearMonthFilter from "@/components/ui/YearMonthFilter"
import { XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, AreaChart, Area, Tooltip } from "recharts"
import { Calendar, Activity } from "lucide-react"

interface TreatmentData {
  id: string
  itemName: string
  year: number
  month: number
  category: "INSURANCE" | "NON_INSURANCE"
  patientCount?: number | null
  visitCount?: number | null
  revenue?: number | null
  visitRatio?: number | null
  revenueRatio?: number | null
}

interface TreatmentsPageClientProps {
  clinicId: string
  initialYear: number
  initialMonth: number
  yearlyData: TreatmentData[]
  monthlyData: TreatmentData[]
  availableData: Array<{ year: number; month: number }>
}

// 금액 포맷팅 함수 (억 단위 자동 환산)
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

export default function TreatmentsPageClient({
  clinicId,
  initialYear,
  initialMonth,
  yearlyData,
  monthlyData,
  availableData
}: TreatmentsPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 사용 가능한 진료항목 목록 (실제 데이터가 있는 것만, 평균 제외, 수익 기준 정렬)
  const availableTreatments = [...new Set(yearlyData.map(d => d.itemName))]
    .filter(itemName => {
      // "평균" 항목 제외
      if (itemName === "평균" || itemName === "average" || itemName === "Average" || itemName.includes("평균")) {
        return false
      }
      // 해당 진료항목에 실제 데이터가 있는지 확인
      return yearlyData.some(d =>
        d.itemName === itemName &&
        ((d.patientCount || 0) > 0 || (d.visitCount || 0) > 0 || (d.revenue || 0) > 0)
      )
    })
    .sort((a, b) => {
      const totalA = yearlyData.filter(d => d.itemName === a).reduce((sum, d) => sum + (d.revenue || 0), 0)
      const totalB = yearlyData.filter(d => d.itemName === b).reduce((sum, d) => sum + (d.revenue || 0), 0)
      return totalB - totalA // 수익 많은 순서로 정렬
    })

  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)

  // URL 업데이트
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', selectedYear.toString())
    params.set('month', selectedMonth.toString())
    router.push(`/dashboard/${clinicId}/treatments?${params.toString()}`)
  }, [selectedYear, selectedMonth, clinicId, router, searchParams])




  // 선택된 월의 진료항목별 데이터 (평균 제외)
  const monthlyChartData = monthlyData
    .filter(item => {
      // "평균" 항목 제외
      return !(item.itemName === "평균" || item.itemName === "average" || item.itemName === "Average" || item.itemName.includes("평균"))
    })
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0)) // 수익 많은 순으로 정렬
    .map(item => ({
      name: item.itemName,
      patientCount: item.patientCount || 0,
      visitCount: item.visitCount || 0,
      revenue: item.revenue || 0,
      category: item.category === "NON_INSURANCE" ? "비급여" : "보험"
    }))

  // 통계 계산 (평균 제외)
  const filteredMonthlyData = monthlyData.filter(item =>
    !(item.itemName === "평균" || item.itemName === "average" || item.itemName === "Average" || item.itemName.includes("평균"))
  )

  const totalRevenue = filteredMonthlyData.reduce((sum, item) => sum + (item.revenue || 0), 0)
  const totalPatientCount = filteredMonthlyData.reduce((sum, item) => sum + (item.patientCount || 0), 0)
  const totalVisitCount = filteredMonthlyData.reduce((sum, item) => sum + (item.visitCount || 0), 0)
  const insuranceRevenue = filteredMonthlyData.filter(item => item.category === "INSURANCE").reduce((sum, item) => sum + (item.revenue || 0), 0)
  const nonInsuranceRevenue = filteredMonthlyData.filter(item => item.category === "NON_INSURANCE").reduce((sum, item) => sum + (item.revenue || 0), 0)

  const topTreatment = filteredMonthlyData.sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0]

  // 비급여 비율 계산
  const nonInsuranceRatio = totalRevenue > 0 ? (nonInsuranceRevenue / totalRevenue * 100) : 0

  // 보험/비급여 파이차트 데이터
  const categoryData = [
    { name: "보험", value: insuranceRevenue, color: "#3182f6" },
    { name: "비급여", value: nonInsuranceRevenue, color: "#f59e0b" }
  ].filter(item => item.value > 0)



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="space-y-8 p-6">
        {/* 헤더 섹션 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">진료항목별 분석</h1>
              <p className="text-slate-600">진료항목별 수익 현황과 보험/비급여 비율을 분석하세요.</p>
            </div>

            {/* 기간 선택 */}
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


        {/* 데이터 없음 알림 */}
        {totalRevenue === 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                <span className="text-white text-lg">📊</span>
              </div>
              <div>
                <h3 className="font-semibold text-amber-800 mb-1">데이터가 없습니다</h3>
                <p className="text-sm text-amber-700">
                  {selectedYear}년 {selectedMonth}월에 대한 진료항목 데이터가 없습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 진료항목별 상세 분석 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-slate-900">진료항목별 상세 분석</h3>
            <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs px-3 py-1 rounded-full font-medium">
              {selectedYear}년 1~{selectedMonth}월
            </span>
          </div>

          {availableTreatments.length === 0 ? (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg">📊</span>
                </div>
                <div>
                  <h3 className="font-semibold text-amber-800 mb-1">데이터가 없습니다</h3>
                  <p className="text-sm text-amber-700">
                    진료항목별 데이터가 없습니다. 데이터를 업로드해주세요.
                  </p>
                </div>
              </div>
            </div>
          ) : (
          <div className="space-y-6">
            {availableTreatments.slice(0, 10).map((itemName, index) => {
              // 1월부터 현재월까지 데이터
              const itemData = Array.from({ length: selectedMonth }, (_, i) => {
                const month = i + 1
                const data = yearlyData.find(d => d.itemName === itemName && d.month === month)
                return {
                  month: `${month}월`,
                  revenue: data?.revenue || 0
                }
              })

              const totalItemRevenue = itemData.reduce((sum, d) => sum + d.revenue, 0)
              const percentage = totalRevenue > 0 ? (totalItemRevenue / totalRevenue * 100) : 0
              const isNonInsurance = yearlyData.find(d => d.itemName === itemName)?.category === "NON_INSURANCE"

              if (totalItemRevenue === 0) return null

              // 색상 배치 (순서대로 다른 색상)
              const colors = [
                { primary: "#3b82f6", gradient: "#3b82f6", light: "#dbeafe" }, // blue
                { primary: "#10b981", gradient: "#10b981", light: "#d1fae5" }, // emerald
                { primary: "#f59e0b", gradient: "#f59e0b", light: "#fef3c7" }, // amber
                { primary: "#ef4444", gradient: "#ef4444", light: "#fee2e2" }, // red
                { primary: "#8b5cf6", gradient: "#8b5cf6", light: "#ede9fe" }, // violet
                { primary: "#06b6d4", gradient: "#06b6d4", light: "#cffafe" }, // cyan
                { primary: "#84cc16", gradient: "#84cc16", light: "#ecfccb" }, // lime
                { primary: "#f97316", gradient: "#f97316", light: "#fed7aa" }, // orange
                { primary: "#ec4899", gradient: "#ec4899", light: "#fce7f3" }, // pink
                { primary: "#6366f1", gradient: "#6366f1", light: "#e0e7ff" }, // indigo
              ]
              const color = colors[index % colors.length]

              return (
                <div key={itemName} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="w-8 h-8 rounded-full text-white text-[14px] flex items-center justify-center font-bold"
                      style={{ backgroundColor: color.primary }}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1">{itemName}</h3>
                      <span className={`px-3 py-1 rounded-full text-[12px] font-medium ${
                        isNonInsurance
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {isNonInsurance ? "비급여" : "보험"}
                      </span>
                    </div>
                  </div>

                  <div className="h-40 mb-6 w-full min-h-[160px] min-w-0">
                    <ResponsiveContainer width="100%" height={160} minHeight={160}>
                      <AreaChart data={itemData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color.primary} stopOpacity={0.3}/>
                            <stop offset="100%" stopColor={color.primary} stopOpacity={0.05}/>
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
                          tickFormatter={(value) => `${(value/10000).toFixed(0)}만`}
                          width={50}
                        />
                        <Tooltip
                          formatter={(value: any) => [`${formatAmount(value)}`, '수익']}
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
                          dataKey="revenue"
                          stroke={color.primary}
                          strokeWidth={3}
                          fill={`url(#gradient-${index})`}
                          dot={{ fill: color.primary, strokeWidth: 2, stroke: '#ffffff', r: 4 }}
                          activeDot={{ r: 6, fill: color.primary, stroke: '#ffffff', strokeWidth: 3 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 그래프 하단 정보 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: color.light }}>
                      <div className="text-[16px] font-bold text-slate-900">{formatAmount(totalItemRevenue)}</div>
                      <div className="text-[12px] text-slate-600">연간 총 수익</div>
                    </div>
                    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: color.light }}>
                      <div className="text-[16px] font-bold" style={{ color: color.primary }}>{percentage.toFixed(1)}%</div>
                      <div className="text-[12px] text-slate-600">전체 비율</div>
                    </div>
                    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: color.light }}>
                      <div className="text-[16px] font-bold text-slate-900">
                        {formatAmount(yearlyData.find(d => d.itemName === itemName && d.month === selectedMonth)?.revenue || 0)}
                      </div>
                      <div className="text-[12px] text-slate-600">{selectedMonth}월 수익</div>
                    </div>
                    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: color.light }}>
                      <div className="text-[16px] font-bold" style={{ color: color.primary }}>
                        {(() => {
                          const monthRevenue = yearlyData.find(d => d.itemName === itemName && d.month === selectedMonth)?.revenue || 0
                          const monthTotal = monthlyData.reduce((sum, item) => sum + (item.revenue || 0), 0)
                          const monthPercentage = monthTotal > 0 ? (monthRevenue / monthTotal * 100) : 0
                          return monthPercentage.toFixed(1)
                        })()}%
                      </div>
                      <div className="text-[12px] text-slate-600">{selectedMonth}월 비율</div>
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
            <Activity className="w-6 h-6 text-emerald-600" />
            <h3 className="text-xl font-bold text-slate-900">{selectedYear}년 {selectedMonth}월 상세 데이터</h3>
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs px-3 py-1 rounded-full font-medium">
              진료항목별
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
                    {selectedYear}년 {selectedMonth}월 진료항목별 데이터가 없습니다.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left p-4 font-semibold text-slate-700">진료항목</th>
                    <th className="text-center p-4 font-semibold text-slate-700">구분</th>
                    <th className="text-center p-4 font-semibold text-slate-700">환자 수</th>
                    <th className="text-center p-4 font-semibold text-slate-700">진료 횟수</th>
                    <th className="text-center p-4 font-semibold text-slate-700">수익</th>
                    <th className="text-center p-4 font-semibold text-slate-700">수익 비율</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMonthlyData
                    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                    .map((treatment, index) => {
                      return (
                        <tr key={treatment.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-[12px] flex items-center justify-center font-bold">
                                {index + 1}
                              </span>
                              <span className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-slate-500" />
                                <span className="max-w-[200px] truncate" title={treatment.itemName}>
                                  {treatment.itemName}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="text-center p-4">
                            <span className={`px-3 py-1 rounded-full text-[12px] font-medium ${
                              treatment.category === "NON_INSURANCE"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {treatment.category === "NON_INSURANCE" ? "비급여" : "보험"}
                            </span>
                          </td>
                          <td className="text-center p-4 tabular-nums text-slate-900 font-medium">
                            {(treatment.patientCount || 0).toLocaleString()}명
                          </td>
                          <td className="text-center p-4 tabular-nums text-slate-600">
                            {(treatment.visitCount || 0).toLocaleString()}회
                          </td>
                          <td className="text-center p-4 tabular-nums font-semibold text-slate-900">
                            {formatAmount(treatment.revenue || 0)}
                          </td>
                          <td className="text-center p-4 tabular-nums text-slate-600">
                            {totalRevenue > 0 ? ((treatment.revenue || 0) / totalRevenue * 100).toFixed(1) : 0}%
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