"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"
import YearMonthFilter from "@/components/ui/YearMonthFilter"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, BarChart, Bar, LabelList, ComposedChart } from "recharts"
import { MapPin, TrendingUp, DollarSign, Users } from "lucide-react"

interface RegionData {
  id: string
  region: string
  year: number
  month: number
  totalPatients?: number | null
  newPatients?: number | null
  returningPatients?: number | null
  totalVisits?: number | null
  avgRevenue?: number | null
}

interface RegionsPageClientProps {
  clinicId: string
  initialYear: number
  initialMonth: number
  yearlyData: RegionData[]
  monthlyData: RegionData[]
  availableData: Array<{ year: number; month: number }>
}

export default function RegionsPageClient({
  clinicId,
  initialYear,
  initialMonth,
  yearlyData,
  monthlyData,
  availableData
}: RegionsPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 사용 가능한 지역 목록 (실제 데이터가 있는 것만, 평균 제외)
  const availableRegions = [...new Set(yearlyData.map(d => d.region))]
    .filter(region => {
      // "평균" 항목 제외
      if (region === "평균" || region === "average" || region === "Average" || region.includes("평균")) {
        return false
      }
      // 해당 지역에 실제 데이터가 있는지 확인
      return yearlyData.some(d =>
        d.region === region &&
        ((d.newPatients || 0) > 0 || (d.returningPatients || 0) > 0 || (d.avgRevenue || 0) > 0)
      )
    })
    .sort((a, b) => {
      const totalA = yearlyData.filter(d => d.region === a).reduce((sum, d) => sum + (d.totalPatients || 0), 0)
      const totalB = yearlyData.filter(d => d.region === b).reduce((sum, d) => sum + (d.totalPatients || 0), 0)
      return totalB - totalA // 총 환자 수 많은 순서로 정렬
    })

  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [selectedRegion, setSelectedRegion] = useState<string>("")

  // URL 업데이트
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', selectedYear.toString())
    params.set('month', selectedMonth.toString())
    router.push(`/dashboard/${clinicId}/regions?${params.toString()}`)
  }, [selectedYear, selectedMonth, clinicId, router, searchParams])

  // 사용 가능한 지역이 변경되면 첫 번째 지역으로 설정
  useEffect(() => {
    if (availableRegions.length > 0) {
      if (!selectedRegion || !availableRegions.includes(selectedRegion)) {
        setSelectedRegion(availableRegions[0])
      }
    }
  }, [availableRegions, selectedRegion])

  // 년도별 월간 추이 데이터 생성
  const createYearlyTrendData = () => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    const regions = [...new Set(yearlyData.map(d => d.region))]

    // 총 환자 수 기준 상위 5개 지역만 표시
    const regionTotals = new Map<string, number>()
    yearlyData.forEach(r => {
      regionTotals.set(r.region, (regionTotals.get(r.region) || 0) + (r.totalPatients || 0))
    })
    const topRegions = [...regionTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name)

    return months.map(month => {
      const monthData: any = { month: `${month}월` }

      topRegions.forEach(region => {
        const data = yearlyData.find(d => d.month === month && d.region === region)
        monthData[`${region}_신환`] = data?.newPatients || 0
        monthData[`${region}_구환`] = data?.returningPatients || 0
        monthData[`${region}_총환자`] = data?.totalPatients || 0
      })

      return monthData
    })
  }

  // 선택된 지역의 월별 데이터
  const selectedRegionData = selectedRegion ?
    yearlyData.filter(d => d.region === selectedRegion)
      .filter(d => (d.newPatients || 0) > 0 || (d.returningPatients || 0) > 0 || (d.avgRevenue || 0) > 0)
      .sort((a, b) => a.month - b.month)
      .map(d => ({
        month: `${d.month}월`,
        newPatients: d.newPatients || 0,
        returningPatients: d.returningPatients || 0,
        totalPatients: d.totalPatients || 0,
        avgRevenue: d.avgRevenue || 0
      })) : []

  // 선택된 월의 지역별 데이터 (평균 제외)
  const monthlyChartData = monthlyData
    .filter(item => {
      // "평균" 항목 제외
      return !(item.region === "평균" || item.region === "average" || item.region === "Average" || item.region.includes("평균"))
    })
    .sort((a, b) => (b.totalPatients || 0) - (a.totalPatients || 0)) // 환자 수 많은 순으로 정렬
    .map(item => ({
      name: item.region,
      newPatients: item.newPatients || 0,
      returningPatients: item.returningPatients || 0,
      totalPatients: item.totalPatients || 0,
      avgRevenue: item.avgRevenue || 0
    }))

  // 통계 계산
  const totalPatients = monthlyData.reduce((sum, item) => sum + (item.totalPatients || 0), 0)
  const totalNewPatients = monthlyData.reduce((sum, item) => sum + (item.newPatients || 0), 0)
  const totalReturningPatients = monthlyData.reduce((sum, item) => sum + (item.returningPatients || 0), 0)

  const topRegion = monthlyData.sort((a, b) => (b.totalPatients || 0) - (a.totalPatients || 0))[0]
  const highestAvgRevenueRegion = monthlyData.sort((a, b) => (b.avgRevenue || 0) - (a.avgRevenue || 0))[0]

  // 신환률 계산
  const newPatientRate = totalPatients > 0 ? (totalNewPatients / totalPatients * 100) : 0

  const yearlyTrendData = createYearlyTrendData()

  // 선택된 지역 통계 (월별)
  const regionMonthlyStats = selectedRegionData.length > 0 ? {
    totalPatients: selectedRegionData.reduce((sum, d) => sum + d.totalPatients, 0),
    newPatients: selectedRegionData.reduce((sum, d) => sum + d.newPatients, 0),
    returningPatients: selectedRegionData.reduce((sum, d) => sum + d.returningPatients, 0),
    avgRevenue: selectedRegionData.length > 0 ? selectedRegionData.reduce((sum, d) => sum + d.avgRevenue, 0) / selectedRegionData.length : 0
  } : { totalPatients: 0, newPatients: 0, returningPatients: 0, avgRevenue: 0 }

  // 선택된 지역의 월별 통계
  const selectedRegionCurrentMonth = yearlyData.find(d => d.region === selectedRegion && d.month === selectedMonth)
  const selectedRegionPrevMonth = yearlyData.find(d => d.region === selectedRegion && d.month === (selectedMonth === 1 ? 12 : selectedMonth - 1))

  // 월대월 변화율 계산
  const regionMoM = selectedRegionCurrentMonth && selectedRegionPrevMonth ? {
    patientsChange: selectedRegionPrevMonth.totalPatients ?
      ((selectedRegionCurrentMonth.totalPatients || 0) - (selectedRegionPrevMonth.totalPatients || 0)) / (selectedRegionPrevMonth.totalPatients || 1) * 100 : 0,
    revenueChange: selectedRegionPrevMonth.avgRevenue ?
      ((selectedRegionCurrentMonth.avgRevenue || 0) - (selectedRegionPrevMonth.avgRevenue || 0)) / (selectedRegionPrevMonth.avgRevenue || 1) * 100 : 0
  } : { patientsChange: 0, revenueChange: 0 }

  // 지역별 연간 데이터 생성 (데이터가 있는 월만)
  const createRegionYearlyData = (region: string) => {
    const monthsWithData = yearlyData
      .filter(d => d.region === region)
      .filter(d => (d.newPatients || 0) > 0 || (d.returningPatients || 0) > 0 || (d.avgRevenue || 0) > 0)
      .sort((a, b) => a.month - b.month)

    return monthsWithData.map(data => ({
      month: `${data.month}월`,
      newPatients: data.newPatients || 0,
      returningPatients: data.returningPatients || 0,
      totalPatients: data.totalPatients || 0,
      avgRevenue: data.avgRevenue || 0
    }))
  }

  // 지역별 통계 계산
  const calculateRegionStats = (region: string) => {
    const regionData = yearlyData.filter(d => d.region === region)
    const totalPatients = regionData.reduce((sum, d) => sum + (d.totalPatients || 0), 0)
    const totalNewPatients = regionData.reduce((sum, d) => sum + (d.newPatients || 0), 0)
    const totalReturningPatients = regionData.reduce((sum, d) => sum + (d.returningPatients || 0), 0)
    const avgRevenue = regionData.length > 0 ? regionData.reduce((sum, d) => sum + (d.avgRevenue || 0), 0) / regionData.length : 0
    const newPatientRate = totalPatients > 0 ? (totalNewPatients / totalPatients * 100) : 0

    return {
      totalPatients,
      totalNewPatients,
      totalReturningPatients,
      avgRevenue,
      newPatientRate
    }
  }

  return (
    <div className="space-y-6">
      {/* 년도 헤더 */}
      <div className="text-center border-b border-[#e5e8eb] pb-6">
        <h1 className="text-[32px] font-bold text-[#191f28] mb-2">{selectedYear}년</h1>
        <p className="text-[16px] text-[#6b7280]">지역별 환자 분석 리포트</p>
      </div>

      {/* 년도/월 필터 */}
      <YearMonthFilter
        initialYear={selectedYear}
        initialMonth={selectedMonth}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
      />

      {/* 월별 전체 요약 */}
      <SectionCard title={`${selectedYear}년 ${selectedMonth}월 지역별 현황`} description="전체 지역 요약">
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
            icon={<MapPin className="w-4 h-4" />}
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

        {/* 월별 지역별 환자 현황 차트 */}
        {monthlyChartData.length > 0 && (
          <div>
            <h3 className="text-[20px] font-semibold text-[#191f28] mb-6">지역별 환자 분포 (상위 10개)</h3>
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
                  <Bar dataKey="newPatients" stackId="a" fill="#3182f6" name="신환" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="returningPatients" stackId="a" fill="#10b981" name="구환" radius={[4, 4, 0, 0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 차트 하단 요약 정보 */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-[18px] font-bold text-[#3182f6]">{topRegion?.region || "—"}</div>
                <div className="text-[12px] text-[#6b7280]">최다 환자 지역</div>
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

      {/* 지역별 상세 분석 */}
      {availableRegions.length > 0 && (
        <SectionCard title="지역별 상세 분석" description="개별 지역 심화 분석">
          {/* 지역 선택 */}
          <div className="mb-8">
            <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">분석할 지역 선택</h3>

            {/* 상위 15개 지역 - 좌우 스크롤 사이드바 */}
            <div className="mb-4">
              <h4 className="text-[14px] font-medium text-[#6b7280] mb-3">상위 15개 지역</h4>
              <div className="relative">
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                  {availableRegions.slice(0, 15).map((region, index) => (
                    <button
                      key={region}
                      onClick={() => setSelectedRegion(region)}
                      className={`flex-shrink-0 px-4 py-2.5 text-[14px] rounded-xl transition-all duration-200 font-medium ${
                        selectedRegion === region
                          ? "bg-[#3182f6] text-white shadow-lg shadow-blue-500/25"
                          : "bg-white text-[#495057] hover:bg-[#f8f9fa] border border-[#e5e8eb] hover:border-[#d1d5db] hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                          selectedRegion === region
                            ? "bg-white/20 text-white"
                            : "bg-[#3182f6] text-white"
                        }`}>
                          {index + 1}
                        </span>
                        {region}
                      </div>
                    </button>
                  ))}
                </div>

                {/* 스크롤 힌트 */}
                {availableRegions.length > 5 && (
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#f9fafb] to-transparent pointer-events-none"></div>
                )}
              </div>
            </div>

            {/* 나머지 지역들 - 드롭다운 */}
            {availableRegions.length > 15 && (
              <div>
                <h4 className="text-[14px] font-medium text-[#6b7280] mb-3">기타 지역 ({availableRegions.length - 15}개)</h4>
                <div className="relative">
                  <select
                    value={availableRegions.slice(0, 15).includes(selectedRegion) ? "" : selectedRegion}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedRegion(e.target.value)
                      }
                    }}
                    className="w-full max-w-xs px-4 py-2.5 text-[14px] bg-white border border-[#e5e8eb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3182f6] focus:border-transparent transition-all"
                  >
                    <option value="">기타 지역 선택...</option>
                    {availableRegions.slice(15).map((region, index) => (
                      <option key={region} value={region}>
                        {index + 16}. {region}
                      </option>
                    ))}
                  </select>

                  {/* 현재 선택된 기타 지역 표시 */}
                  {selectedRegion && !availableRegions.slice(0, 15).includes(selectedRegion) && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-[#3182f6] text-white text-[13px] rounded-lg">
                      <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] font-bold flex items-center justify-center">
                        {availableRegions.indexOf(selectedRegion) + 1}
                      </span>
                      {selectedRegion}
                      <button
                        onClick={() => setSelectedRegion(availableRegions[0])}
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

          {selectedRegion && (
            <>
              {/* 선택된 지역 KPI */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-8">
                <KpiCard
                  label={`${selectedMonth}월 환자`}
                  value={(selectedRegionCurrentMonth?.totalPatients || 0).toLocaleString()}
                  unit="명"
                  changeLabel={`${regionMoM.patientsChange >= 0 ? '↗' : '↘'} ${Math.abs(regionMoM.patientsChange).toFixed(1)}% ${regionMoM.patientsChange >= 0 ? '증가' : '감소'}`}
                  icon={<Users className="w-4 h-4" />}
                  color="blue"
                />
                <KpiCard
                  label={`${selectedMonth}월 신환`}
                  value={(selectedRegionCurrentMonth?.newPatients || 0).toLocaleString()}
                  unit="명"
                  icon={<TrendingUp className="w-4 h-4" />}
                  color="green"
                />
                <KpiCard
                  label={`${selectedMonth}월 구환`}
                  value={(selectedRegionCurrentMonth?.returningPatients || 0).toLocaleString()}
                  unit="명"
                  icon={<MapPin className="w-4 h-4" />}
                  color="yellow"
                />
              </div>

              {/* 연간 요약 통계 */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 mb-8 border border-gray-200">
                <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">{selectedYear}년 연간 요약 - {selectedRegion}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#3182f6] mb-1">
                      {calculateRegionStats(selectedRegion).totalPatients.toLocaleString()}명
                    </div>
                    <div className="text-[12px] text-[#6b7280]">연간 총 환자</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#10b981] mb-1">
                      {calculateRegionStats(selectedRegion).totalNewPatients.toLocaleString()}명
                    </div>
                    <div className="text-[12px] text-[#6b7280]">연간 신환</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#f59e0b] mb-1">
                      {calculateRegionStats(selectedRegion).newPatientRate.toFixed(1)}%
                    </div>
                    <div className="text-[12px] text-[#6b7280]">신환 비율</div>
                  </div>
                </div>
              </div>

              {/* 선택된 지역 월별 추이 차트 */}
              <div className="grid grid-cols-1 gap-8">
                {/* 환자 수 추이 */}
                <div>
                  <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">{selectedRegion} 월별 환자 수 추이</h3>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={selectedRegionData}>
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

      {/* 년도별 월간 전체 지역 추이 */}
      {yearlyTrendData.length > 0 && (
        <SectionCard title={`${selectedYear}년 지역별 월간 추이`} description="상위 5개 지역 비교">
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
                {[...new Set(yearlyData.map(d => d.region))]
                  .filter(region => {
                    const total = yearlyData.filter(d => d.region === region).reduce((sum, d) => sum + (d.totalPatients || 0), 0)
                    return total > 0
                  })
                  .sort((a, b) => {
                    const totalA = yearlyData.filter(d => d.region === a).reduce((sum, d) => sum + (d.totalPatients || 0), 0)
                    const totalB = yearlyData.filter(d => d.region === b).reduce((sum, d) => sum + (d.totalPatients || 0), 0)
                    return totalB - totalA
                  })
                  .slice(0, 5)
                  .map((region, index) => {
                    const colors = ['#3182f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                    return (
                      <Line
                        key={region}
                        type="linear"
                        dataKey={`${region}_총환자`}
                        stroke={colors[index]}
                        strokeWidth={3}
                        name={region}
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
      <SectionCard title={`${selectedYear}년 ${selectedMonth}월 지역별 상세 데이터`}>
        {monthlyData.length === 0 ? (
          <div className="text-center py-12 text-[14px] text-[#8b95a1]">
            {selectedYear}년 {selectedMonth}월 지역별 데이터가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-[#e5e8eb] bg-[#f8f9fa]">
                  <th className="text-left p-4 font-semibold text-[#495057]">지역</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">총 환자</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">신환</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">구환</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">신환률</th>
                  <th className="text-center p-4 font-semibold text-[#495057]">총 방문</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData
                  .filter(item => {
                    // "평균" 항목 제외
                    return !(item.region === "평균" || item.region === "average" || item.region === "Average" || item.region.includes("평균"))
                  })
                  .sort((a, b) => (b.totalPatients || 0) - (a.totalPatients || 0))
                  .map((region, index) => {
                    const newPatientRate = (region.totalPatients || 0) > 0 ?
                      ((region.newPatients || 0) / (region.totalPatients || 0) * 100) : 0

                    return (
                      <tr key={region.region} className="border-b border-[#e5e8eb] hover:bg-[#f8f9fa]">
                        <td className="p-4 font-medium text-[#191f28]">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-[#3182f6] text-white rounded-full text-[12px] flex items-center justify-center font-bold">
                              {index + 1}
                            </span>
                            {region.region}
                          </div>
                        </td>
                        <td className="text-center p-4 tabular-nums font-semibold text-[#191f28]">
                          {(region.totalPatients || 0).toLocaleString()}
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#3182f6] font-medium">
                          {(region.newPatients || 0).toLocaleString()}
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#10b981] font-medium">
                          {(region.returningPatients || 0).toLocaleString()}
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#6b7280]">
                          {newPatientRate.toFixed(1)}%
                        </td>
                        <td className="text-center p-4 tabular-nums text-[#6b7280]">
                          {(region.totalVisits || 0).toLocaleString()}
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
      {availableRegions.length === 0 && (
        <div className="text-center py-12 text-[14px] text-[#8b95a1]">
          선택된 년도에 지역별 데이터가 없습니다.
        </div>
      )}
    </div>
  )
}