"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"
import YearMonthFilter from "@/components/ui/YearMonthFilter"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, BarChart, Bar, LabelList, ComposedChart } from "recharts"
import { Stethoscope, TrendingUp, DollarSign, Activity } from "lucide-react"

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
  const [selectedTreatment, setSelectedTreatment] = useState<string>("")

  // URL 업데이트
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', selectedYear.toString())
    params.set('month', selectedMonth.toString())
    router.push(`/dashboard/${clinicId}/treatments?${params.toString()}`)
  }, [selectedYear, selectedMonth, clinicId, router, searchParams])

  // 사용 가능한 진료항목이 변경되면 첫 번째 항목으로 설정
  useEffect(() => {
    if (availableTreatments.length > 0) {
      if (!selectedTreatment || !availableTreatments.includes(selectedTreatment)) {
        setSelectedTreatment(availableTreatments[0])
      }
    }
  }, [availableTreatments, selectedTreatment])

  // 년도별 월간 추이 데이터 생성
  const createYearlyTrendData = () => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    const treatments = [...new Set(yearlyData.map(d => d.itemName))]

    // 수익 기준 상위 5개 진료항목만 표시
    const treatmentTotals = new Map<string, number>()
    yearlyData.forEach(r => {
      treatmentTotals.set(r.itemName, (treatmentTotals.get(r.itemName) || 0) + (r.revenue || 0))
    })
    const topTreatments = [...treatmentTotals.entries()]
      .filter(([name]) => !name.includes("평균")) // 평균 제외
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name)

    return months.map(month => {
      const monthData: any = { month: `${month}월` }

      topTreatments.forEach(itemName => {
        const data = yearlyData.find(d => d.month === month && d.itemName === itemName)
        monthData[`${itemName}_환자수`] = data?.patientCount || 0
        monthData[`${itemName}_수익`] = data?.revenue || 0
      })

      return monthData
    })
  }

  // 선택된 진료항목의 월별 데이터
  const selectedTreatmentData = selectedTreatment ?
    yearlyData.filter(d => d.itemName === selectedTreatment)
      .filter(d => (d.patientCount || 0) > 0 || (d.visitCount || 0) > 0 || (d.revenue || 0) > 0)
      .sort((a, b) => a.month - b.month)
      .map(d => ({
        month: `${d.month}월`,
        patientCount: d.patientCount || 0,
        visitCount: d.visitCount || 0,
        revenue: d.revenue || 0,
        category: d.category
      })) : []

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

  const yearlyTrendData = createYearlyTrendData()

  // 선택된 진료항목의 현재/이전 월 데이터
  const selectedTreatmentCurrentMonth = yearlyData.find(d => d.itemName === selectedTreatment && d.month === selectedMonth)
  const selectedTreatmentPrevMonth = yearlyData.find(d => d.itemName === selectedTreatment && d.month === (selectedMonth === 1 ? 12 : selectedMonth - 1))

  // 월대월 변화율 계산
  const treatmentMoM = selectedTreatmentCurrentMonth && selectedTreatmentPrevMonth ? {
    revenueChange: selectedTreatmentPrevMonth.revenue ?
      ((selectedTreatmentCurrentMonth.revenue || 0) - (selectedTreatmentPrevMonth.revenue || 0)) / (selectedTreatmentPrevMonth.revenue || 1) * 100 : 0,
    patientChange: selectedTreatmentPrevMonth.patientCount ?
      ((selectedTreatmentCurrentMonth.patientCount || 0) - (selectedTreatmentPrevMonth.patientCount || 0)) / (selectedTreatmentPrevMonth.patientCount || 1) * 100 : 0
  } : { revenueChange: 0, patientChange: 0 }

  // 진료항목별 통계 계산
  const calculateTreatmentStats = (itemName: string) => {
    const treatmentData = yearlyData.filter(d => d.itemName === itemName)
    const totalRevenue = treatmentData.reduce((sum, d) => sum + (d.revenue || 0), 0)
    const totalPatientCount = treatmentData.reduce((sum, d) => sum + (d.patientCount || 0), 0)
    const totalVisitCount = treatmentData.reduce((sum, d) => sum + (d.visitCount || 0), 0)
    const avgRevenuePerPatient = totalPatientCount > 0 ? totalRevenue / totalPatientCount : 0

    return {
      totalRevenue,
      totalPatientCount,
      totalVisitCount,
      avgRevenuePerPatient
    }
  }

  return (
    <div className="space-y-6">
      {/* 년도 헤더 */}
      <div className="text-center border-b border-[#e5e8eb] pb-6">
        <h1 className="text-[32px] font-bold text-[#191f28] mb-2">{selectedYear}년</h1>
        <p className="text-[16px] text-[#6b7280]">진료항목별 수익 분석 리포트</p>
      </div>

      {/* 년도/월 필터 */}
      <YearMonthFilter
        initialYear={selectedYear}
        initialMonth={selectedMonth}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
      />

      {/* 월별 전체 요약 */}
      <SectionCard title={`${selectedYear}년 ${selectedMonth}월 진료항목별 현황`} description="전체 진료항목 요약">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <KpiCard
            label="총 수익"
            value={formatAmount(totalRevenue)}
            unit=""
            icon={<DollarSign className="w-4 h-4" />}
            color="blue"
          />
          <KpiCard
            label="총 환자 수"
            value={totalPatientCount.toLocaleString()}
            unit="명"
            icon={<Activity className="w-4 h-4" />}
            color="green"
          />
          <KpiCard
            label="총 진료 횟수"
            value={totalVisitCount.toLocaleString()}
            unit="회"
            icon={<Stethoscope className="w-4 h-4" />}
            color="yellow"
          />
          <KpiCard
            label="비급여 비율"
            value={nonInsuranceRatio.toFixed(1)}
            unit="%"
            icon={<TrendingUp className="w-4 h-4" />}
            color="red"
          />
        </div>

        {/* 보험/비급여 구성 탭 */}
        <div className="mb-8">
          <h3 className="text-[18px] font-semibold text-[#191f28] mb-4">보험/비급여 수익 구성</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-blue-600 font-medium">보험 수익</div>
                  <div className="text-[24px] font-bold text-blue-700 mt-1">{formatAmount(insuranceRevenue)}</div>
                  <div className="text-[12px] text-blue-600 mt-1">전체의 {((insuranceRevenue / totalRevenue) * 100).toFixed(1)}%</div>
                </div>
                <div className="text-[32px] text-blue-500">🏥</div>
              </div>
            </div>
            <div className="bg-yellow-50 rounded-xl p-6 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-yellow-600 font-medium">비급여 수익</div>
                  <div className="text-[24px] font-bold text-yellow-700 mt-1">{formatAmount(nonInsuranceRevenue)}</div>
                  <div className="text-[12px] text-yellow-600 mt-1">전체의 {((nonInsuranceRevenue / totalRevenue) * 100).toFixed(1)}%</div>
                </div>
                <div className="text-[32px] text-yellow-500">💎</div>
              </div>
            </div>
          </div>
        </div>

        {/* 진료항목별 수익 분포 - 전체 폭 */}
        {monthlyChartData.length > 0 && (
          <div>
            <h3 className="text-[20px] font-semibold text-[#191f28] mb-6">진료항목별 수익 분포 (상위 10개)</h3>
            <div className="h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData.slice(0, 10)} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    stroke="#9ca3af"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    stroke="#9ca3af"
                    domain={[0, 'dataMax + 50000']}
                    tickFormatter={(value) => formatAmount(value)}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#8b5cf6"
                    name="수익"
                    radius={[4, 4, 0, 0]}
                    animationDuration={600}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 차트 하단 요약 정보 */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-purple-50 rounded-xl p-4">
                <div className="text-[18px] font-bold text-[#8b5cf6]">{topTreatment?.itemName || "—"}</div>
                <div className="text-[12px] text-[#6b7280]">최고 수익 진료항목</div>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="text-[18px] font-bold text-[#10b981]">{formatAmount(topTreatment?.revenue || 0)}</div>
                <div className="text-[12px] text-[#6b7280]">최고 수익 금액</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-[18px] font-bold text-[#3182f6]">{monthlyChartData.length}개</div>
                <div className="text-[12px] text-[#6b7280]">총 진료항목</div>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* 진료항목별 상세 분석 */}
      {availableTreatments.length > 0 && (
        <SectionCard title="진료항목별 상세 분석" description="개별 항목 심화 분석">
          {/* 진료항목 선택 */}
          <div className="mb-8">
            <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">분석할 진료항목 선택</h3>

            {/* 상위 15개 진료항목 - 좌우 스크롤 사이드바 */}
            <div className="mb-4">
              <h4 className="text-[14px] font-medium text-[#6b7280] mb-3">상위 15개 항목</h4>
              <div className="relative">
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                  {availableTreatments.slice(0, 15).map((itemName, index) => (
                    <button
                      key={itemName}
                      onClick={() => setSelectedTreatment(itemName)}
                      className={`flex-shrink-0 px-4 py-2.5 text-[14px] rounded-xl transition-all duration-200 font-medium ${
                        selectedTreatment === itemName
                          ? "bg-[#3182f6] text-white shadow-lg shadow-blue-500/25"
                          : "bg-white text-[#495057] hover:bg-[#f8f9fa] border border-[#e5e8eb] hover:border-[#d1d5db] hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                          selectedTreatment === itemName
                            ? "bg-white/20 text-white"
                            : "bg-[#3182f6] text-white"
                        }`}>
                          {index + 1}
                        </span>
                        <span className="max-w-[120px] truncate">{itemName}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* 스크롤 힌트 */}
                {availableTreatments.length > 5 && (
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#f9fafb] to-transparent pointer-events-none"></div>
                )}
              </div>
            </div>

            {/* 나머지 진료항목들 - 드롭다운 */}
            {availableTreatments.length > 15 && (
              <div>
                <h4 className="text-[14px] font-medium text-[#6b7280] mb-3">기타 항목 ({availableTreatments.length - 15}개)</h4>
                <div className="relative">
                  <select
                    value={availableTreatments.slice(0, 15).includes(selectedTreatment) ? "" : selectedTreatment}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedTreatment(e.target.value)
                      }
                    }}
                    className="w-full max-w-xs px-4 py-2.5 text-[14px] bg-white border border-[#e5e8eb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3182f6] focus:border-transparent transition-all"
                  >
                    <option value="">기타 항목 선택...</option>
                    {availableTreatments.slice(15).map((itemName, index) => (
                      <option key={itemName} value={itemName}>
                        {index + 16}. {itemName}
                      </option>
                    ))}
                  </select>

                  {/* 현재 선택된 기타 항목 표시 */}
                  {selectedTreatment && !availableTreatments.slice(0, 15).includes(selectedTreatment) && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-[#3182f6] text-white text-[13px] rounded-lg">
                      <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] font-bold flex items-center justify-center">
                        {availableTreatments.indexOf(selectedTreatment) + 1}
                      </span>
                      <span className="max-w-[150px] truncate">{selectedTreatment}</span>
                      <button
                        onClick={() => setSelectedTreatment(availableTreatments[0])}
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

          {selectedTreatment && (
            <>
              {/* 선택된 진료항목 KPI */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                <KpiCard
                  label={`${selectedMonth}월 수익`}
                  value={formatAmount(selectedTreatmentCurrentMonth?.revenue || 0)}
                  unit=""
                  changeLabel={`${treatmentMoM.revenueChange >= 0 ? '↗' : '↘'} ${Math.abs(treatmentMoM.revenueChange).toFixed(1)}% ${treatmentMoM.revenueChange >= 0 ? '증가' : '감소'}`}
                  icon={<DollarSign className="w-4 h-4" />}
                  color="blue"
                />
                <KpiCard
                  label={`${selectedMonth}월 환자 수`}
                  value={(selectedTreatmentCurrentMonth?.patientCount || 0).toLocaleString()}
                  unit="명"
                  changeLabel={`${treatmentMoM.patientChange >= 0 ? '↗' : '↘'} ${Math.abs(treatmentMoM.patientChange).toFixed(1)}% ${treatmentMoM.patientChange >= 0 ? '증가' : '감소'}`}
                  icon={<Activity className="w-4 h-4" />}
                  color="green"
                />
                <KpiCard
                  label={`${selectedMonth}월 진료 횟수`}
                  value={(selectedTreatmentCurrentMonth?.visitCount || 0).toLocaleString()}
                  unit="회"
                  icon={<Stethoscope className="w-4 h-4" />}
                  color="yellow"
                />
                <KpiCard
                  label="구분"
                  value={selectedTreatmentCurrentMonth?.category === "NON_INSURANCE" ? "비급여" : "보험"}
                  unit=""
                  icon={<TrendingUp className="w-4 h-4" />}
                  color={selectedTreatmentCurrentMonth?.category === "NON_INSURANCE" ? "red" : "blue"}
                />
              </div>

              {/* 연간 요약 통계 */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 mb-8 border border-gray-200">
                <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">{selectedYear}년 연간 요약 - {selectedTreatment}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#3182f6] mb-1">
                      {formatAmount(calculateTreatmentStats(selectedTreatment).totalRevenue)}
                    </div>
                    <div className="text-[12px] text-[#6b7280]">연간 총 수익</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#10b981] mb-1">
                      {calculateTreatmentStats(selectedTreatment).totalPatientCount.toLocaleString()}명
                    </div>
                    <div className="text-[12px] text-[#6b7280]">연간 환자 수</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#f59e0b] mb-1">
                      {calculateTreatmentStats(selectedTreatment).totalVisitCount.toLocaleString()}회
                    </div>
                    <div className="text-[12px] text-[#6b7280]">연간 진료 횟수</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#ef4444] mb-1">
                      {formatAmount(calculateTreatmentStats(selectedTreatment).avgRevenuePerPatient)}
                    </div>
                    <div className="text-[12px] text-[#6b7280]">환자당 평균 수익</div>
                  </div>
                </div>
              </div>

              {/* 선택된 진료항목 월별 추이 차트 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 수익/환자 수 추이 */}
                <div>
                  <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">{selectedTreatment} 월별 수익/환자 추이</h3>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={selectedTreatmentData}>
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

                        {/* 수익 - 막대 차트 */}
                        <Bar
                          dataKey="revenue"
                          fill="#8b5cf6"
                          name="수익"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        />

                        {/* 환자 수 - 꺾은선 차트 */}
                        <Line
                          type="linear"
                          dataKey="patientCount"
                          stroke="#3182f6"
                          strokeWidth={3}
                          name="환자 수"
                          dot={{ r: 5, fill: "#3182f6", strokeWidth: 2, stroke: "#ffffff" }}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 월별 진료 횟수 추이 */}
                <div>
                  <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">{selectedTreatment} 월별 진료 횟수 추이</h3>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={selectedTreatmentData}>
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
                        <Bar
                          dataKey="visitCount"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                          name="진료 횟수"
                          isAnimationActive={false}
                        >
                          <LabelList
                            dataKey="visitCount"
                            position="top"
                            formatter={(value: any) => `${value}회`}
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

      {/* 년도별 월간 전체 진료항목 추이 */}
      {yearlyTrendData.length > 0 && (
        <SectionCard title={`${selectedYear}년 진료항목별 월간 추이`} description="상위 5개 항목 비교">
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
                  domain={[0, 'dataMax + 50000']}
                  tickFormatter={(value) => `${(value/10000).toFixed(0)}만`}
                />
                <Legend />
                {[...new Set(yearlyData.map(d => d.itemName))]
                  .filter(itemName => !itemName.includes("평균"))
                  .filter(itemName => {
                    const total = yearlyData.filter(d => d.itemName === itemName).reduce((sum, d) => sum + (d.revenue || 0), 0)
                    return total > 0
                  })
                  .sort((a, b) => {
                    const totalA = yearlyData.filter(d => d.itemName === a).reduce((sum, d) => sum + (d.revenue || 0), 0)
                    const totalB = yearlyData.filter(d => d.itemName === b).reduce((sum, d) => sum + (d.revenue || 0), 0)
                    return totalB - totalA
                  })
                  .slice(0, 5)
                  .map((itemName, index) => {
                    const colors = ['#3182f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                    return (
                      <Line
                        key={itemName}
                        type="linear"
                        dataKey={`${itemName}_수익`}
                        stroke={colors[index]}
                        strokeWidth={3}
                        name={itemName.length > 12 ? itemName.substring(0, 12) + '...' : itemName}
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
      <SectionCard title={`${selectedYear}년 ${selectedMonth}월 진료항목별 상세 데이터`}>
        {filteredMonthlyData.length === 0 ? (
          <div className="text-center py-12 text-[14px] text-[#8b95a1]">
            {selectedYear}년 {selectedMonth}월 진료항목별 데이터가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-[#e5e8eb] bg-[#f8f9fa]">
                  <th className="text-left p-4 font-semibold text-[#495057]">진료항목</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">구분</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">환자 수</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">진료 횟수</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">수익</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">수익 비율</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonthlyData
                  .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                  .map((treatment, index) => {
                    return (
                      <tr key={treatment.id} className="border-b border-[#e5e8eb] hover:bg-[#f8f9fa]">
                        <td className="p-4 font-medium text-[#191f28]">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-[#3182f6] text-white rounded-full text-[12px] flex items-center justify-center font-bold">
                              {index + 1}
                            </span>
                            <span className="flex items-center gap-1">
                              <Stethoscope className="w-4 h-4 text-[#6b7280]" />
                              <span className="max-w-[200px] truncate" title={treatment.itemName}>
                                {treatment.itemName}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="text-center p-4">
                          <span className={`px-2 py-1 rounded text-[12px] font-medium ${
                            treatment.category === "NON_INSURANCE"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {treatment.category === "NON_INSURANCE" ? "비급여" : "보험"}
                          </span>
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#3182f6] font-medium">
                          {(treatment.patientCount || 0).toLocaleString()}명
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#10b981] font-medium">
                          {(treatment.visitCount || 0).toLocaleString()}회
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#191f28] font-semibold">
                          {formatAmount(treatment.revenue || 0)}
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#6b7280]">
                          {treatment.revenueRatio?.toFixed(1) || "—"}%
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
      {availableTreatments.length === 0 && (
        <div className="text-center py-12 text-[14px] text-[#8b95a1]">
          선택된 년도에 진료항목별 데이터가 없습니다.
        </div>
      )}
    </div>
  )
}