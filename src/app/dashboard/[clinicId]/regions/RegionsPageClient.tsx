"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"
import YearMonthFilter from "@/components/ui/YearMonthFilter"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, BarChart, Bar, LabelList, ComposedChart, Area, AreaChart, Tooltip } from "recharts"
import { Users, TrendingUp, Calendar, MapPin, BarChart3, Grid3X3 } from "lucide-react"

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
  const [chartViewMode, setChartViewMode] = useState<'combined' | 'separated'>('combined')
  const [detailViewMode, setDetailViewMode] = useState<'combined' | 'separated'>('combined')

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

  // 선택된 월의 지역별 데이터 (평균 제외, 상위 10개만)
  const monthlyChartData = monthlyData
    .filter(item => {
      // "평균" 항목 제외
      return !(item.region === "평균" || item.region === "average" || item.region === "Average" || item.region.includes("평균"))
    })
    .sort((a, b) => (b.totalPatients || 0) - (a.totalPatients || 0)) // 환자 수 많은 순으로 정렬
    .slice(0, 10) // 상위 10개만 표시
    .map(item => ({
      name: item.region,
      newPatients: item.newPatients || 0,
      returningPatients: item.returningPatients || 0,
      totalPatients: item.totalPatients || 0,
      avgRevenue: item.avgRevenue || 0
    }))

  // 통계 계산 (평균 제외)
  const filteredMonthlyData = monthlyData.filter(item =>
    !(item.region === "평균" || item.region === "average" || item.region === "Average" || item.region.includes("평균"))
  )

  const totalPatients = filteredMonthlyData.reduce((sum, item) => sum + (item.totalPatients || 0), 0)
  const totalNewPatients = filteredMonthlyData.reduce((sum, item) => sum + (item.newPatients || 0), 0)
  const totalReturningPatients = filteredMonthlyData.reduce((sum, item) => sum + (item.returningPatients || 0), 0)

  const topRegion = filteredMonthlyData.sort((a, b) => (b.totalPatients || 0) - (a.totalPatients || 0))[0]

  // 신환률 계산
  const newPatientRate = totalPatients > 0 ? (totalNewPatients / totalPatients * 100) : 0

  // 선택된 지역의 현재/이전 월 데이터
  const selectedRegionCurrentMonth = yearlyData.find(d => d.region === selectedRegion && d.month === selectedMonth)
  const selectedRegionPrevMonth = yearlyData.find(d => d.region === selectedRegion && d.month === (selectedMonth === 1 ? 12 : selectedMonth - 1))

  // 월대월 변화율 계산
  const regionMoM = selectedRegionCurrentMonth && selectedRegionPrevMonth ? {
    patientsChange: selectedRegionPrevMonth.totalPatients ?
      ((selectedRegionCurrentMonth.totalPatients || 0) - (selectedRegionPrevMonth.totalPatients || 0)) / (selectedRegionPrevMonth.totalPatients || 1) * 100 : 0,
    newPatientsChange: selectedRegionPrevMonth.newPatients ?
      ((selectedRegionCurrentMonth.newPatients || 0) - (selectedRegionPrevMonth.newPatients || 0)) / (selectedRegionPrevMonth.newPatients || 1) * 100 : 0
  } : { patientsChange: 0, newPatientsChange: 0 }

  // 지역별 통계 계산
  const calculateRegionStats = (region: string) => {
    const regionData = yearlyData.filter(d => d.region === region)
    const totalPatients = regionData.reduce((sum, d) => sum + (d.totalPatients || 0), 0)
    const totalNewPatients = regionData.reduce((sum, d) => sum + (d.newPatients || 0), 0)
    const totalReturningPatients = regionData.reduce((sum, d) => sum + (d.returningPatients || 0), 0)
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

        {/* 지역별 환자 분포 차트 */}
        {monthlyChartData.length > 0 && (
          <div className="space-y-6">
            {/* 헤더와 토글 버튼 */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-6 h-6 text-emerald-600" />
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">지역별 환자 분포</h3>
                    <p className="text-slate-600 text-sm mt-1">
                      지역별 총환자, 신환, 구환 분포를 확인하세요 (상위 10개 지역)
                    </p>
                  </div>
                  <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                    {selectedYear}년 {selectedMonth}월
                  </span>
                </div>

                {/* 토글 버튼 */}
                <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => setChartViewMode('combined')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      chartViewMode === 'combined'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    합쳐서 보기
                  </button>
                  <button
                    onClick={() => setChartViewMode('separated')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      chartViewMode === 'separated'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                    분리해서 보기
                  </button>
                </div>
              </div>
            </div>

            {/* 합쳐서 보기 모드 */}
            {chartViewMode === 'combined' && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8 hover:shadow-lg transition-all duration-300">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">통합 환자 분포</h3>
                    <p className="text-sm text-slate-600">
                      지역별 총환자, 신환, 구환을 한번에 비교 (상위 10개 지역)
                    </p>
                  </div>
                </div>

                <div className="h-80 mb-4 w-full min-h-[320px] min-w-0">
                  <ResponsiveContainer width="100%" height={320} minHeight={320}>
                    <BarChart data={monthlyChartData} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${value}명`}
                        width={50}
                      />
                      <Tooltip
                        formatter={(value: any, name: string) => {
                          const nameMap: Record<string, string> = {
                            'totalPatients': '총환자',
                            'newPatients': '신환',
                            'returningPatients': '구환'
                          }
                          return [`${value}명`, nameMap[name] || name]
                        }}
                        contentStyle={{
                          borderRadius: 12,
                          border: 'none',
                          boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)',
                          fontSize: 13,
                          background: 'rgba(255, 255, 255, 0.95)',
                          backdropFilter: 'blur(8px)'
                        }}
                      />
                      <Legend
                        formatter={(value) => {
                          const nameMap: Record<string, string> = {
                            'totalPatients': '총환자',
                            'newPatients': '신환',
                            'returningPatients': '구환'
                          }
                          return nameMap[value] || value
                        }}
                      />
                      <Bar
                        dataKey="totalPatients"
                        fill="#10b981"
                        name="totalPatients"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="newPatients"
                        fill="#3b82f6"
                        name="newPatients"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="returningPatients"
                        fill="#f59e0b"
                        name="returningPatients"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 분리해서 보기 모드 */}
            {chartViewMode === 'separated' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 총 환자 분포 */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 hover:shadow-lg transition-all duration-300">
                  <div className="mb-4">
                    <h4 className="text-lg font-bold text-slate-900 mb-1">총 환자</h4>
                    <p className="text-xs text-slate-600">지역별 전체 환자 수 (상위 10개)</p>
                  </div>

                  <div className="h-64 w-full min-h-[256px] min-w-0">
                    <ResponsiveContainer width="100%" height={256} minHeight={256}>
                      <AreaChart data={monthlyChartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                        <defs>
                          <linearGradient id="gradient-total" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                        />
                        <Tooltip
                          formatter={(value: any) => [`${value}명`, '총환자']}
                          contentStyle={{
                            borderRadius: 8,
                            border: 'none',
                            boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)',
                            fontSize: 12
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="totalPatients"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#gradient-total)"
                          dot={{ fill: '#10b981', strokeWidth: 1, r: 3 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 신환 분포 */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 hover:shadow-lg transition-all duration-300">
                  <div className="mb-4">
                    <h4 className="text-lg font-bold text-slate-900 mb-1">신환</h4>
                    <p className="text-xs text-slate-600">지역별 신규 환자 수 (상위 10개)</p>
                  </div>

                  <div className="h-64 w-full min-h-[256px] min-w-0">
                    <ResponsiveContainer width="100%" height={256} minHeight={256}>
                      <AreaChart data={monthlyChartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                        <defs>
                          <linearGradient id="gradient-new" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                        />
                        <Tooltip
                          formatter={(value: any) => [`${value}명`, '신환']}
                          contentStyle={{
                            borderRadius: 8,
                            border: 'none',
                            boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)',
                            fontSize: 12
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="newPatients"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fill="url(#gradient-new)"
                          dot={{ fill: '#3b82f6', strokeWidth: 1, r: 3 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 구환 분포 */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 hover:shadow-lg transition-all duration-300">
                  <div className="mb-4">
                    <h4 className="text-lg font-bold text-slate-900 mb-1">구환</h4>
                    <p className="text-xs text-slate-600">지역별 기존 환자 수 (상위 10개)</p>
                  </div>

                  <div className="h-64 w-full min-h-[256px] min-w-0">
                    <ResponsiveContainer width="100%" height={256} minHeight={256}>
                      <AreaChart data={monthlyChartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                        <defs>
                          <linearGradient id="gradient-returning" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3}/>
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                        />
                        <Tooltip
                          formatter={(value: any) => [`${value}명`, '구환']}
                          contentStyle={{
                            borderRadius: 8,
                            border: 'none',
                            boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)',
                            fontSize: 12
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="returningPatients"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          fill="url(#gradient-returning)"
                          dot={{ fill: '#f59e0b', strokeWidth: 1, r: 3 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* 지역별 상세 분석 */}
      {availableRegions.length > 0 && (
        <SectionCard title="지역별 상세 분석" description="개별 지역 심화 분석">
          {/* 지역 선택 */}
          <div className="mb-8">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-semibold text-slate-900">분석할 지역 선택</h3>
              </div>

              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-slate-700">지역:</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="flex-1 max-w-xs px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                >
                  {availableRegions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>

                {selectedRegion && (
                  <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs px-3 py-1.5 rounded-full font-medium">
                    선택됨
                  </span>
                )}
              </div>
            </div>
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
                  changeLabel={`${regionMoM.newPatientsChange >= 0 ? '↗' : '↘'} ${Math.abs(regionMoM.newPatientsChange).toFixed(1)}% ${regionMoM.newPatientsChange >= 0 ? '증가' : '감소'}`}
                  icon={<TrendingUp className="w-4 h-4" />}
                  color="green"
                />
                <KpiCard
                  label={`${selectedMonth}월 구환`}
                  value={(selectedRegionCurrentMonth?.returningPatients || 0).toLocaleString()}
                  unit="명"
                  icon={<Calendar className="w-4 h-4" />}
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
              <div className="space-y-6">
                {/* 헤더와 토글 버튼 */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-6 h-6 text-emerald-600" />
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">
                          {selectedRegion} 월별 추이 분석
                        </h3>
                        <p className="text-slate-600 text-sm mt-1">
                          선택 지역의 월별 환자 수 변화 추이
                        </p>
                      </div>
                      <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                        {selectedYear}년 연간
                      </span>
                    </div>

                    {/* 토글 버튼 */}
                    <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                      <button
                        onClick={() => setDetailViewMode('combined')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                          detailViewMode === 'combined'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <BarChart3 className="w-4 h-4" />
                        합쳐서 보기
                      </button>
                      <button
                        onClick={() => setDetailViewMode('separated')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                          detailViewMode === 'separated'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Grid3X3 className="w-4 h-4" />
                        분리해서 보기
                      </button>
                    </div>
                  </div>
                </div>

                {/* 합쳐서 보기 모드 */}
                {detailViewMode === 'combined' && (
                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                          {selectedRegion} 통합 월별 추이
                        </h3>
                        <p className="text-sm text-slate-600">
                          총환자, 신환, 구환 추이를 한번에 비교
                        </p>
                      </div>
                    </div>

                    <div className="h-80 mb-4 w-full min-h-[320px] min-w-0">
                      <ResponsiveContainer width="100%" height={320} minHeight={320}>
                        <LineChart data={selectedRegionData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
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
                            tickFormatter={(value) => `${value}명`}
                            width={50}
                          />
                          <Tooltip
                            formatter={(value: any, name: string) => {
                              const nameMap: Record<string, string> = {
                                'totalPatients': '총환자',
                                'newPatients': '신환',
                                'returningPatients': '구환'
                              }
                              return [`${value}명`, nameMap[name] || name]
                            }}
                            contentStyle={{
                              borderRadius: 12,
                              border: 'none',
                              boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)',
                              fontSize: 13,
                              background: 'rgba(255, 255, 255, 0.95)',
                              backdropFilter: 'blur(8px)'
                            }}
                          />
                          <Legend
                            formatter={(value) => {
                              const nameMap: Record<string, string> = {
                                'totalPatients': '총환자',
                                'newPatients': '신환',
                                'returningPatients': '구환'
                              }
                              return nameMap[value] || value
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="totalPatients"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ fill: '#10b981', strokeWidth: 2, stroke: '#ffffff', r: 4 }}
                            activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="newPatients"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, stroke: '#ffffff', r: 4 }}
                            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="returningPatients"
                            stroke="#f59e0b"
                            strokeWidth={3}
                            dot={{ fill: '#f59e0b', strokeWidth: 2, stroke: '#ffffff', r: 4 }}
                            activeDot={{ r: 6, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* 분리해서 보기 모드 */}
                {detailViewMode === 'separated' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 총환자 추이 */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 hover:shadow-lg transition-all duration-300">
                      <div className="mb-4">
                        <h4 className="text-lg font-bold text-slate-900 mb-1">총환자 추이</h4>
                        <p className="text-xs text-slate-600">월별 총 환자 수 변화</p>
                      </div>

                      <div className="h-64 w-full min-h-[256px] min-w-0">
                        <ResponsiveContainer width="100%" height={256} minHeight={256}>
                          <AreaChart data={selectedRegionData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                            <defs>
                              <linearGradient id="gradient-detail-total" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="100%" stopColor="#10b981" stopOpacity={0.05}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                              dataKey="month"
                              tick={{ fontSize: 10, fill: "#64748b" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: "#64748b" }}
                              axisLine={false}
                              tickLine={false}
                              width={40}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value}명`, '총환자']}
                              contentStyle={{
                                borderRadius: 8,
                                border: 'none',
                                boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)',
                                fontSize: 12
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="totalPatients"
                              stroke="#10b981"
                              strokeWidth={2}
                              fill="url(#gradient-detail-total)"
                              dot={{ fill: '#10b981', strokeWidth: 1, r: 3 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* 신환 추이 */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 hover:shadow-lg transition-all duration-300">
                      <div className="mb-4">
                        <h4 className="text-lg font-bold text-slate-900 mb-1">신환 추이</h4>
                        <p className="text-xs text-slate-600">월별 신환 수 변화</p>
                      </div>

                      <div className="h-64 w-full min-h-[256px] min-w-0">
                        <ResponsiveContainer width="100%" height={256} minHeight={256}>
                          <AreaChart data={selectedRegionData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                            <defs>
                              <linearGradient id="gradient-detail-new" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                              dataKey="month"
                              tick={{ fontSize: 10, fill: "#64748b" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: "#64748b" }}
                              axisLine={false}
                              tickLine={false}
                              width={40}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value}명`, '신환']}
                              contentStyle={{
                                borderRadius: 8,
                                border: 'none',
                                boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)',
                                fontSize: 12
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="newPatients"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              fill="url(#gradient-detail-new)"
                              dot={{ fill: '#3b82f6', strokeWidth: 1, r: 3 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* 구환 추이 */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 hover:shadow-lg transition-all duration-300">
                      <div className="mb-4">
                        <h4 className="text-lg font-bold text-slate-900 mb-1">구환 추이</h4>
                        <p className="text-xs text-slate-600">월별 구환 수 변화</p>
                      </div>

                      <div className="h-64 w-full min-h-[256px] min-w-0">
                        <ResponsiveContainer width="100%" height={256} minHeight={256}>
                          <AreaChart data={selectedRegionData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                            <defs>
                              <linearGradient id="gradient-detail-returning" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                              dataKey="month"
                              tick={{ fontSize: 10, fill: "#64748b" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: "#64748b" }}
                              axisLine={false}
                              tickLine={false}
                              width={40}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value}명`, '구환']}
                              contentStyle={{
                                borderRadius: 8,
                                border: 'none',
                                boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)',
                                fontSize: 12
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="returningPatients"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              fill="url(#gradient-detail-returning)"
                              dot={{ fill: '#f59e0b', strokeWidth: 1, r: 3 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SectionCard>
      )}

      {/* 데이터가 없는 경우 */}
      {availableRegions.length === 0 && (
        <div className="text-center py-12 text-[14px] text-[#8b95a1]">
          선택된 년도에 지역별 데이터가 없습니다.
        </div>
      )}
    </div>
  )
}