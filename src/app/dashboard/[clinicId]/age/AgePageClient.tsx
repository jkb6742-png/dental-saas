"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"
import YearMonthFilter from "@/components/ui/YearMonthFilter"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, BarChart, Bar, LabelList, ComposedChart } from "recharts"
import { Users, TrendingUp, Calendar, Cake } from "lucide-react"

interface AgeData {
  id: string
  ageGroup: string
  year: number
  month: number
  totalPatients?: number | null
  returningPatients?: number | null
  newPatients?: number | null
  avgRevenue?: number | null
}

interface AgePageClientProps {
  clinicId: string
  initialYear: number
  initialMonth: number
  yearlyData: AgeData[]
  monthlyData: AgeData[]
  availableData: Array<{ year: number; month: number }>
}

const AGE_ORDER = ["0~9세","10~19세","20~29세","30~39세","40~49세","50~59세","60~69세","70~79세","80세이상"]

export default function AgePageClient({
  clinicId,
  initialYear,
  initialMonth,
  yearlyData,
  monthlyData,
  availableData
}: AgePageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 사용 가능한 연령대 목록 (실제 데이터가 있는 것만, 평균 제외)
  const availableAgeGroups = [...new Set(yearlyData.map(d => d.ageGroup))]
    .filter(ageGroup => {
      // "평균" 항목 제외
      if (ageGroup === "평균" || ageGroup === "average" || ageGroup === "Average" || ageGroup.includes("평균")) {
        return false
      }
      // 해당 연령대에 실제 데이터가 있는지 확인
      return yearlyData.some(d =>
        d.ageGroup === ageGroup &&
        ((d.newPatients || 0) > 0 || (d.returningPatients || 0) > 0 || (d.avgRevenue || 0) > 0)
      )
    })
    .sort((a, b) => {
      const ai = AGE_ORDER.indexOf(a)
      const bi = AGE_ORDER.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>("")

  // URL 업데이트
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', selectedYear.toString())
    params.set('month', selectedMonth.toString())
    router.push(`/dashboard/${clinicId}/age?${params.toString()}`)
  }, [selectedYear, selectedMonth, clinicId, router, searchParams])

  // 사용 가능한 연령대가 변경되면 첫 번째 연령대로 설정
  useEffect(() => {
    if (availableAgeGroups.length > 0) {
      if (!selectedAgeGroup || !availableAgeGroups.includes(selectedAgeGroup)) {
        setSelectedAgeGroup(availableAgeGroups[0])
      }
    }
  }, [availableAgeGroups, selectedAgeGroup])

  // 년도별 월간 추이 데이터 생성
  const createYearlyTrendData = () => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    const ageGroups = [...new Set(yearlyData.map(d => d.ageGroup))]

    // 환자 수 기준 상위 5개 연령대만 표시
    const ageTotals = new Map<string, number>()
    yearlyData.forEach(r => {
      ageTotals.set(r.ageGroup, (ageTotals.get(r.ageGroup) || 0) + (r.totalPatients || 0))
    })
    const topAgeGroups = [...ageTotals.entries()]
      .filter(([name]) => !name.includes("평균")) // 평균 제외
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name)

    return months.map(month => {
      const monthData: any = { month: `${month}월` }

      topAgeGroups.forEach(ageGroup => {
        const data = yearlyData.find(d => d.month === month && d.ageGroup === ageGroup)
        monthData[`${ageGroup}_신환`] = data?.newPatients || 0
        monthData[`${ageGroup}_구환`] = data?.returningPatients || 0
        monthData[`${ageGroup}_총환자`] = data?.totalPatients || 0
      })

      return monthData
    })
  }

  // 선택된 연령대의 월별 데이터
  const selectedAgeGroupData = selectedAgeGroup ?
    yearlyData.filter(d => d.ageGroup === selectedAgeGroup)
      .filter(d => (d.newPatients || 0) > 0 || (d.returningPatients || 0) > 0 || (d.avgRevenue || 0) > 0)
      .sort((a, b) => a.month - b.month)
      .map(d => ({
        month: `${d.month}월`,
        newPatients: d.newPatients || 0,
        returningPatients: d.returningPatients || 0,
        totalPatients: d.totalPatients || 0,
        avgRevenue: d.avgRevenue || 0
      })) : []

  // 선택된 월의 연령대별 데이터 (평균 제외)
  const monthlyChartData = monthlyData
    .filter(item => {
      // "평균" 항목 제외
      return !(item.ageGroup === "평균" || item.ageGroup === "average" || item.ageGroup === "Average" || item.ageGroup.includes("평균"))
    })
    .sort((a, b) => {
      const ai = AGE_ORDER.indexOf(a.ageGroup)
      const bi = AGE_ORDER.indexOf(b.ageGroup)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    .map(item => ({
      name: item.ageGroup,
      newPatients: item.newPatients || 0,
      returningPatients: item.returningPatients || 0,
      totalPatients: item.totalPatients || 0,
      avgRevenue: item.avgRevenue || 0
    }))

  // 통계 계산 (평균 제외)
  const filteredMonthlyData = monthlyData.filter(item =>
    !(item.ageGroup === "평균" || item.ageGroup === "average" || item.ageGroup === "Average" || item.ageGroup.includes("평균"))
  )

  const totalPatients = filteredMonthlyData.reduce((sum, item) => sum + (item.totalPatients || 0), 0)
  const totalNewPatients = filteredMonthlyData.reduce((sum, item) => sum + (item.newPatients || 0), 0)
  const totalReturningPatients = filteredMonthlyData.reduce((sum, item) => sum + (item.returningPatients || 0), 0)

  const topAgeGroup = filteredMonthlyData.sort((a, b) => (b.totalPatients || 0) - (a.totalPatients || 0))[0]

  // 신환률 계산
  const newPatientRate = totalPatients > 0 ? (totalNewPatients / totalPatients * 100) : 0

  const yearlyTrendData = createYearlyTrendData()

  // 선택된 연령대의 현재/이전 월 데이터
  const selectedAgeGroupCurrentMonth = yearlyData.find(d => d.ageGroup === selectedAgeGroup && d.month === selectedMonth)
  const selectedAgeGroupPrevMonth = yearlyData.find(d => d.ageGroup === selectedAgeGroup && d.month === (selectedMonth === 1 ? 12 : selectedMonth - 1))

  // 월대월 변화율 계산
  const ageGroupMoM = selectedAgeGroupCurrentMonth && selectedAgeGroupPrevMonth ? {
    patientsChange: selectedAgeGroupPrevMonth.totalPatients ?
      ((selectedAgeGroupCurrentMonth.totalPatients || 0) - (selectedAgeGroupPrevMonth.totalPatients || 0)) / (selectedAgeGroupPrevMonth.totalPatients || 1) * 100 : 0,
    newPatientsChange: selectedAgeGroupPrevMonth.newPatients ?
      ((selectedAgeGroupCurrentMonth.newPatients || 0) - (selectedAgeGroupPrevMonth.newPatients || 0)) / (selectedAgeGroupPrevMonth.newPatients || 1) * 100 : 0
  } : { patientsChange: 0, newPatientsChange: 0 }

  // 연령대별 통계 계산
  const calculateAgeGroupStats = (ageGroup: string) => {
    const ageData = yearlyData.filter(d => d.ageGroup === ageGroup)
    const totalPatients = ageData.reduce((sum, d) => sum + (d.totalPatients || 0), 0)
    const totalNewPatients = ageData.reduce((sum, d) => sum + (d.newPatients || 0), 0)
    const totalReturningPatients = ageData.reduce((sum, d) => sum + (d.returningPatients || 0), 0)
    const newPatientRate = totalPatients > 0 ? (totalNewPatients / totalPatients * 100) : 0

    return {
      totalPatients,
      totalNewPatients,
      totalReturningPatients,
      newPatientRate
    }
  }

  return (
    <div className="space-y-6">
      {/* 년도 헤더 */}
      <div className="text-center border-b border-[#e5e8eb] pb-6">
        <h1 className="text-[32px] font-bold text-[#191f28] mb-2">{selectedYear}년</h1>
        <p className="text-[16px] text-[#6b7280]">연령대별 환자 분석 리포트</p>
      </div>

      {/* 년도/월 필터 */}
      <YearMonthFilter
        initialYear={selectedYear}
        initialMonth={selectedMonth}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
      />

      {/* 월별 전체 요약 */}
      <SectionCard title={`${selectedYear}년 ${selectedMonth}월 연령대별 현황`} description="전체 연령대 요약">
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
            label="구환"
            value={totalReturningPatients.toLocaleString()}
            unit="명"
            icon={<Calendar className="w-4 h-4" />}
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

        {/* 월별 연령대별 환자 현황 차트 */}
        {monthlyChartData.length > 0 && (
          <div>
            <h3 className="text-[20px] font-semibold text-[#191f28] mb-6">연령대별 환자 분포</h3>
            <div className="h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 120 }}>
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
                  <Bar dataKey="newPatients" stackId="a" fill="#3182f6" name="신환" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="returningPatients" stackId="a" fill="#10b981" name="구환" radius={[4, 4, 0, 0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 차트 하단 요약 정보 */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-[18px] font-bold text-[#3182f6]">{topAgeGroup?.ageGroup || "—"}</div>
                <div className="text-[12px] text-[#6b7280]">최다 환자 연령대</div>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="text-[18px] font-bold text-[#10b981]">{totalNewPatients.toLocaleString()}명</div>
                <div className="text-[12px] text-[#6b7280]">총 신환</div>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4">
                <div className="text-[18px] font-bold text-[#f59e0b]">{newPatientRate.toFixed(1)}%</div>
                <div className="text-[12px] text-[#6b7280]">전체 신환 비율</div>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* 연령대별 상세 분석 */}
      {availableAgeGroups.length > 0 && (
        <SectionCard title="연령대별 상세 분석" description="개별 연령대 심화 분석">
          {/* 연령대 선택 */}
          <div className="mb-8">
            <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">분석할 연령대 선택</h3>

            {/* 모든 연령대 - 좌우 스크롤 사이드바 (연령대는 보통 9개 정도라서 모두 표시) */}
            <div className="mb-4">
              <h4 className="text-[14px] font-medium text-[#6b7280] mb-3">연령대별</h4>
              <div className="relative">
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                  {availableAgeGroups.map((ageGroup, index) => (
                    <button
                      key={ageGroup}
                      onClick={() => setSelectedAgeGroup(ageGroup)}
                      className={`flex-shrink-0 px-4 py-2.5 text-[14px] rounded-xl transition-all duration-200 font-medium ${
                        selectedAgeGroup === ageGroup
                          ? "bg-[#3182f6] text-white shadow-lg shadow-blue-500/25"
                          : "bg-white text-[#495057] hover:bg-[#f8f9fa] border border-[#e5e8eb] hover:border-[#d1d5db] hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                          selectedAgeGroup === ageGroup
                            ? "bg-white/20 text-white"
                            : "bg-[#3182f6] text-white"
                        }`}>
                          {index + 1}
                        </span>
                        {ageGroup}
                      </div>
                    </button>
                  ))}
                </div>

                {/* 스크롤 힌트 */}
                {availableAgeGroups.length > 5 && (
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#f9fafb] to-transparent pointer-events-none"></div>
                )}
              </div>
            </div>
          </div>

          {selectedAgeGroup && (
            <>
              {/* 선택된 연령대 KPI */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-8">
                <KpiCard
                  label={`${selectedMonth}월 환자`}
                  value={(selectedAgeGroupCurrentMonth?.totalPatients || 0).toLocaleString()}
                  unit="명"
                  changeLabel={`${ageGroupMoM.patientsChange >= 0 ? '↗' : '↘'} ${Math.abs(ageGroupMoM.patientsChange).toFixed(1)}% ${ageGroupMoM.patientsChange >= 0 ? '증가' : '감소'}`}
                  icon={<Users className="w-4 h-4" />}
                  color="blue"
                />
                <KpiCard
                  label={`${selectedMonth}월 신환`}
                  value={(selectedAgeGroupCurrentMonth?.newPatients || 0).toLocaleString()}
                  unit="명"
                  changeLabel={`${ageGroupMoM.newPatientsChange >= 0 ? '↗' : '↘'} ${Math.abs(ageGroupMoM.newPatientsChange).toFixed(1)}% ${ageGroupMoM.newPatientsChange >= 0 ? '증가' : '감소'}`}
                  icon={<TrendingUp className="w-4 h-4" />}
                  color="green"
                />
                <KpiCard
                  label={`${selectedMonth}월 구환`}
                  value={(selectedAgeGroupCurrentMonth?.returningPatients || 0).toLocaleString()}
                  unit="명"
                  icon={<Calendar className="w-4 h-4" />}
                  color="yellow"
                />
              </div>

              {/* 연간 요약 통계 */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 mb-8 border border-gray-200">
                <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">{selectedYear}년 연간 요약 - {selectedAgeGroup}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#3182f6] mb-1">
                      {calculateAgeGroupStats(selectedAgeGroup).totalPatients.toLocaleString()}명
                    </div>
                    <div className="text-[12px] text-[#6b7280]">연간 총 환자</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#10b981] mb-1">
                      {calculateAgeGroupStats(selectedAgeGroup).totalNewPatients.toLocaleString()}명
                    </div>
                    <div className="text-[12px] text-[#6b7280]">연간 신환</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#f59e0b] mb-1">
                      {calculateAgeGroupStats(selectedAgeGroup).newPatientRate.toFixed(1)}%
                    </div>
                    <div className="text-[12px] text-[#6b7280]">신환 비율</div>
                  </div>
                </div>
              </div>

              {/* 선택된 연령대 월별 추이 차트 */}
              <div className="grid grid-cols-1 gap-8">
                {/* 환자 수 추이 */}
                <div>
                  <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">{selectedAgeGroup} 월별 환자 수 추이</h3>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={selectedAgeGroupData}>
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
                        >
                          <LabelList
                            dataKey="totalPatients"
                            position="top"
                            formatter={(value: any) => `${value}`}
                            style={{ fontSize: '12px', fill: '#374151', fontWeight: 'bold' }}
                          />
                        </Bar>

                        {/* 신환 - 꺾은선 차트 */}
                        <Line
                          type="linear"
                          dataKey="newPatients"
                          stroke="#3182f6"
                          strokeWidth={3}
                          name="신환"
                          dot={{ r: 6, fill: "#3182f6", strokeWidth: 2, stroke: "#ffffff" }}
                          isAnimationActive={false}
                        >
                          <LabelList
                            dataKey="newPatients"
                            position="top"
                            formatter={(value: any) => `${value}`}
                            style={{ fontSize: '10px', fill: '#3182f6', fontWeight: 'bold' }}
                          />
                        </Line>

                        {/* 구환 - 꺾은선 차트 */}
                        <Line
                          type="linear"
                          dataKey="returningPatients"
                          stroke="#10b981"
                          strokeWidth={3}
                          name="구환"
                          dot={{ r: 6, fill: "#10b981", strokeWidth: 2, stroke: "#ffffff" }}
                          isAnimationActive={false}
                        >
                          <LabelList
                            dataKey="returningPatients"
                            position="top"
                            formatter={(value: any) => `${value}`}
                            style={{ fontSize: '10px', fill: '#10b981', fontWeight: 'bold' }}
                          />
                        </Line>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}
        </SectionCard>
      )}

      {/* 년도별 월간 전체 연령대 추이 */}
      {yearlyTrendData.length > 0 && (
        <SectionCard title={`${selectedYear}년 연령대별 월간 추이`} description="상위 5개 연령대 비교">
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
                  domain={[0, 'dataMax + 10']}
                />
                <Legend />
                {[...new Set(yearlyData.map(d => d.ageGroup))]
                  .filter(ageGroup => !ageGroup.includes("평균"))
                  .filter(ageGroup => {
                    const total = yearlyData.filter(d => d.ageGroup === ageGroup).reduce((sum, d) => sum + (d.totalPatients || 0), 0)
                    return total > 0
                  })
                  .sort((a, b) => {
                    const totalA = yearlyData.filter(d => d.ageGroup === a).reduce((sum, d) => sum + (d.totalPatients || 0), 0)
                    const totalB = yearlyData.filter(d => d.ageGroup === b).reduce((sum, d) => sum + (d.totalPatients || 0), 0)
                    return totalB - totalA
                  })
                  .slice(0, 5)
                  .map((ageGroup, index) => {
                    const colors = ['#3182f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                    return (
                      <Line
                        key={ageGroup}
                        type="linear"
                        dataKey={`${ageGroup}_총환자`}
                        stroke={colors[index]}
                        strokeWidth={3}
                        name={ageGroup}
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
      <SectionCard title={`${selectedYear}년 ${selectedMonth}월 연령대별 상세 데이터`}>
        {filteredMonthlyData.length === 0 ? (
          <div className="text-center py-12 text-[14px] text-[#8b95a1]">
            {selectedYear}년 {selectedMonth}월 연령대별 데이터가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-[#e5e8eb] bg-[#f8f9fa]">
                  <th className="text-left p-4 font-semibold text-[#495057]">연령대</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">총 환자</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">신환</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">구환</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">신환률</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonthlyData
                  .sort((a, b) => {
                    const ai = AGE_ORDER.indexOf(a.ageGroup)
                    const bi = AGE_ORDER.indexOf(b.ageGroup)
                    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
                  })
                  .map((ageGroup, index) => {
                    const newPatientRate = (ageGroup.totalPatients || 0) > 0 ?
                      ((ageGroup.newPatients || 0) / (ageGroup.totalPatients || 0) * 100) : 0

                    return (
                      <tr key={ageGroup.ageGroup} className="border-b border-[#e5e8eb] hover:bg-[#f8f9fa]">
                        <td className="p-4 font-medium text-[#191f28]">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-[#3182f6] text-white rounded-full text-[12px] flex items-center justify-center font-bold">
                              {index + 1}
                            </span>
                            <span className="flex items-center gap-1">
                              <Cake className="w-4 h-4 text-[#6b7280]" />
                              {ageGroup.ageGroup}
                            </span>
                          </div>
                        </td>
                        <td className="text-center p-4 tabular-nums font-semibold text-[#191f28]">
                          {(ageGroup.totalPatients || 0).toLocaleString()}
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#3182f6] font-medium">
                          {(ageGroup.newPatients || 0).toLocaleString()}
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#10b981] font-medium">
                          {(ageGroup.returningPatients || 0).toLocaleString()}
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#6b7280]">
                          {newPatientRate.toFixed(1)}%
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
      {availableAgeGroups.length === 0 && (
        <div className="text-center py-12 text-[14px] text-[#8b95a1]">
          선택된 년도에 연령대별 데이터가 없습니다.
        </div>
      )}
    </div>
  )
}