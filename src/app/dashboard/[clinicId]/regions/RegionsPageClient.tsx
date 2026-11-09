"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"
import YearMonthFilter from "@/components/ui/YearMonthFilter"
import MonthlyCompare, { type CompareRow } from "@/components/charts/MonthlyCompare"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, BarChart, Bar, LabelList, ComposedChart, Area, AreaChart, Tooltip } from "@/components/charts/recharts"
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
  compare: { rows: CompareRow[]; items: string[] }
}

export default function RegionsPageClient({
  clinicId,
  initialYear,
  initialMonth,
  yearlyData,
  monthlyData,
  availableData,
  compare
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
  const [chartViewMode, setChartViewMode] = useState<'combined' | 'separated'>('separated')
  const [detailViewMode, setDetailViewMode] = useState<'combined' | 'separated'>('combined')

  // URL 업데이트
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    // 이미 같은 URL이면 재이동(전체 서버 재조회+재렌더) 하지 않음 → 마운트 시 불필요한 리로드 방지
    if (params.get('year') === String(selectedYear) && params.get('month') === String(selectedMonth)) return
    params.set('year', selectedYear.toString())
    params.set('month', selectedMonth.toString())
    router.push(`/dashboard/${clinicId}/regions?${params.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth])

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
    <div className="space-y-3">
      {/* 년도 헤더 */}
      <div className="flex items-baseline gap-2">
        <h2 className="text-[16px] font-bold text-[#0a0a0a]">{selectedYear}년</h2>
        <p className="text-[12px] text-[#6f6f6a]">지역별 환자 분석 리포트</p>
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
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
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
          <div className="space-y-3">
            {/* 헤더와 토글 버튼 */}
            <div className="bg-white rounded border border-[#b9b9b3] overflow-hidden p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">지역별 환자 분포</h3>
                    <p className="text-slate-600 text-sm mt-1">
                      지역별 총환자, 신환, 구환 분포를 확인하세요 (상위 10개 지역)
                    </p>
                  </div>
                  <span className="bg-[#191f28] text-white text-xs px-3 py-1 rounded-full font-medium">
                    {selectedYear}년 {selectedMonth}월
                  </span>
                </div>

                {/* 토글 버튼 */}
                <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => setChartViewMode('combined')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      chartViewMode === 'combined'
                        ? 'bg-white text-slate-900'
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
                        ? 'bg-white text-slate-900'
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
              <div className="bg-white rounded border border-[#b9b9b3] overflow-hidden p-3">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">통합 환자 분포</h3>
                    <p className="text-sm text-slate-600">
                      지역별 총환자, 신환, 구환을 한번에 비교 (상위 10개 지역)
                    </p>
                  </div>
                </div>

                <div className="h-[330px] w-full min-h-[330px] min-w-0">
                  <ResponsiveContainer width="100%" height={330} minHeight={330}>
                    <BarChart data={monthlyChartData} margin={{ top: 20, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        angle={-30}
                        textAnchor="end"
                        height={72}
                        tickMargin={10}
                        padding={{ left: 12, right: 12 }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${value}명`}
                        width={46}
                        tickMargin={8}
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
                          borderRadius: 4, border: '1px solid #d1d1cc',
                          boxShadow: '0 4px 12px rgb(0 0 0 / 0.10)', fontSize: 13,
                          background: 'rgba(255, 255, 255, 0.95)'
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, paddingTop: 0 }}
                        formatter={(value) => {
                          const nameMap: Record<string, string> = {
                            'totalPatients': '총환자',
                            'newPatients': '신환',
                            'returningPatients': '구환'
                          }
                          return nameMap[value] || value
                        }}
                      />
                      <Bar isAnimationActive={false} dataKey="totalPatients" fill="#10b981" name="totalPatients" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="totalPatients" position="top" formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? v : '')} style={{ fontSize: 9, fontWeight: 700, fill: "#10b981" }} />
                      </Bar>
                      <Bar isAnimationActive={false} dataKey="newPatients" fill="#0062ff" name="newPatients" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="newPatients" position="top" formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? v : '')} style={{ fontSize: 9, fontWeight: 700, fill: "#0062ff" }} />
                      </Bar>
                      <Bar isAnimationActive={false} dataKey="returningPatients" fill="#f59e0b" name="returningPatients" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="returningPatients" position="top" formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? v : '')} style={{ fontSize: 9, fontWeight: 700, fill: "#f59e0b" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 분리해서 보기 모드 */}
            {chartViewMode === 'separated' && (
              <div className="space-y-3">
                {/* 총 환자 분포 */}
                <div className="bg-white rounded border border-[#b9b9b3] overflow-hidden p-3">
                  <div className="-mx-3 -mt-3 mb-2.5 px-3 py-2 bg-[#ecece9] border-b border-[#d1d1cc]">
                    <h4 className="text-[16px] font-bold text-[#0a0a0a]">총 환자</h4>
                    <p className="text-xs text-slate-600">지역별 전체 환자 수 (상위 10개)</p>
                  </div>

                  <div className="h-[270px] w-full min-h-[270px] min-w-0">
                    <ResponsiveContainer width="100%" height={270} minHeight={270}>
                      <AreaChart data={monthlyChartData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
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
                          angle={-30}
                          textAnchor="end"
                          height={68}
                          tickMargin={8}
                          padding={{ left: 10, right: 10 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          width={36}
                          tickMargin={6}
                        />
                        <Tooltip
                          formatter={(value: any) => [`${value}명`, '총환자']}
                          contentStyle={{
                            borderRadius: 8,
                            border: 'none',
                            boxShadow: '0 4px 12px rgb(0 0 0 / 0.10)', fontSize: 12
                          }}
                        />
                        <Area isAnimationActive={false}
                          type="monotone"
                          dataKey="totalPatients"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#gradient-total)"
                          dot={{ fill: '#10b981', strokeWidth: 1, r: 3 }}
                        >
                          <LabelList dataKey="totalPatients" position="top" offset={8} formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? v : '')} style={{ fontSize: 9, fontWeight: 700, fill: "#10b981" }} />
                        </Area>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 신환 분포 */}
                <div className="bg-white rounded border border-[#b9b9b3] overflow-hidden p-3">
                  <div className="-mx-3 -mt-3 mb-2.5 px-3 py-2 bg-[#ecece9] border-b border-[#d1d1cc]">
                    <h4 className="text-[16px] font-bold text-[#0a0a0a]">신환</h4>
                    <p className="text-xs text-slate-600">지역별 신규 환자 수 (상위 10개)</p>
                  </div>

                  <div className="h-[270px] w-full min-h-[270px] min-w-0">
                    <ResponsiveContainer width="100%" height={270} minHeight={270}>
                      <AreaChart data={monthlyChartData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradient-new" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0062ff" stopOpacity={0.3}/>
                            <stop offset="100%" stopColor="#0062ff" stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          angle={-30}
                          textAnchor="end"
                          height={68}
                          tickMargin={8}
                          padding={{ left: 10, right: 10 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          width={36}
                          tickMargin={6}
                        />
                        <Tooltip
                          formatter={(value: any) => [`${value}명`, '신환']}
                          contentStyle={{
                            borderRadius: 8,
                            border: 'none',
                            boxShadow: '0 4px 12px rgb(0 0 0 / 0.10)', fontSize: 12
                          }}
                        />
                        <Area isAnimationActive={false}
                          type="monotone"
                          dataKey="newPatients"
                          stroke="#0062ff"
                          strokeWidth={2}
                          fill="url(#gradient-new)"
                          dot={{ fill: '#0062ff', strokeWidth: 1, r: 3 }}
                        >
                          <LabelList dataKey="newPatients" position="top" offset={8} formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? v : '')} style={{ fontSize: 9, fontWeight: 700, fill: "#0062ff" }} />
                        </Area>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 구환 분포 */}
                <div className="bg-white rounded border border-[#b9b9b3] overflow-hidden p-3">
                  <div className="-mx-3 -mt-3 mb-2.5 px-3 py-2 bg-[#ecece9] border-b border-[#d1d1cc]">
                    <h4 className="text-[16px] font-bold text-[#0a0a0a]">구환</h4>
                    <p className="text-xs text-slate-600">지역별 기존 환자 수 (상위 10개)</p>
                  </div>

                  <div className="h-[270px] w-full min-h-[270px] min-w-0">
                    <ResponsiveContainer width="100%" height={270} minHeight={270}>
                      <AreaChart data={monthlyChartData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
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
                          angle={-30}
                          textAnchor="end"
                          height={68}
                          tickMargin={8}
                          padding={{ left: 10, right: 10 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          width={36}
                          tickMargin={6}
                        />
                        <Tooltip
                          formatter={(value: any) => [`${value}명`, '구환']}
                          contentStyle={{
                            borderRadius: 8,
                            border: 'none',
                            boxShadow: '0 4px 12px rgb(0 0 0 / 0.10)', fontSize: 12
                          }}
                        />
                        <Area isAnimationActive={false}
                          type="monotone"
                          dataKey="returningPatients"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          fill="url(#gradient-returning)"
                          dot={{ fill: '#f59e0b', strokeWidth: 1, r: 3 }}
                        >
                          <LabelList dataKey="returningPatients" position="top" offset={8} formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? v : '')} style={{ fontSize: 9, fontWeight: 700, fill: "#f59e0b" }} />
                        </Area>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      <MonthlyCompare rows={compare.rows} items={compare.items} itemLabel="지역" year={selectedYear} month={selectedMonth} />

      {/* 지역별 상세 분석 */}
      {availableRegions.length > 0 && (
        <SectionCard title="지역별 상세 분석" description="개별 지역 심화 분석">
          {/* 지역 선택 */}
          <div className="mb-3">
            <div className="bg-white rounded border border-[#b9b9b3] overflow-hidden p-3">
              <div className="flex items-center gap-3 mb-2.5">
                <h3 className="text-lg font-semibold text-slate-900">분석할 지역 선택</h3>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700">지역:</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="flex-1 max-w-xs px-4 py-3 bg-white border border-[#d1d1cc] rounded-xl text-sm font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  {availableRegions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>

                {selectedRegion && (
                  <span className="bg-[#191f28] text-white text-xs px-3 py-1.5 rounded-full font-medium">
                    선택됨
                  </span>
                )}
              </div>
            </div>
          </div>

          {selectedRegion && (
            <>
              {/* 선택된 지역 KPI */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-3">
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
              <div className="bg-white rounded-xl p-4 mb-3 border border-[#d1d1cc]">
                <h3 className="text-[16px] font-semibold text-[#191f28] mb-2.5">{selectedYear}년 연간 요약 - {selectedRegion}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-[24px] font-bold text-[#0062ff] mb-1">
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
              <div className="space-y-3">
                {/* 헤더와 토글 버튼 */}
                <div className="bg-white rounded border border-[#b9b9b3] overflow-hidden p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">
                          {selectedRegion} 월별 추이 분석
                        </h3>
                        <p className="text-slate-600 text-sm mt-1">
                          선택 지역의 월별 환자 수 변화 추이
                        </p>
                      </div>
                      <span className="bg-[#191f28] text-white text-xs px-3 py-1 rounded-full font-medium">
                        {selectedYear}년 연간
                      </span>
                    </div>

                    {/* 토글 버튼 */}
                    <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                      <button
                        onClick={() => setDetailViewMode('combined')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                          detailViewMode === 'combined'
                            ? 'bg-white text-slate-900'
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
                            ? 'bg-white text-slate-900'
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
                  <div className="bg-white rounded border border-[#b9b9b3] overflow-hidden p-3">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                          {selectedRegion} 통합 월별 추이
                        </h3>
                        <p className="text-sm text-slate-600">
                          총환자, 신환, 구환 추이를 한번에 비교
                        </p>
                      </div>
                    </div>

                    <div className="h-[330px] w-full min-h-[330px] min-w-0">
                      <ResponsiveContainer width="100%" height={330} minHeight={330}>
                        <LineChart data={selectedRegionData} margin={{ top: 22, right: 20, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: "#64748b" }}
                            axisLine={false}
                            tickLine={false}
                            tickMargin={10}
                            padding={{ left: 12, right: 12 }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#64748b" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => `${value}명`}
                            width={50}
                            tickMargin={8}
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
                              borderRadius: 4, border: '1px solid #d1d1cc',
                              boxShadow: '0 4px 12px rgb(0 0 0 / 0.10)', fontSize: 13,
                              background: 'rgba(255, 255, 255, 0.95)'
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
                          <Line isAnimationActive={false}
                            type="monotone"
                            dataKey="totalPatients"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={{ fill: '#10b981', strokeWidth: 1, stroke: '#ffffff', r: 3 }}
                            activeDot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                          >
                            <LabelList dataKey="totalPatients" position="top" offset={8} formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? v : '')} style={{ fontSize: 9, fontWeight: 700, fill: "#10b981" }} />
                          </Line>
                          <Line isAnimationActive={false}
                            type="monotone"
                            dataKey="newPatients"
                            stroke="#0062ff"
                            strokeWidth={2}
                            dot={{ fill: '#0062ff', strokeWidth: 1, stroke: '#ffffff', r: 3 }}
                            activeDot={{ r: 5, fill: '#0062ff', stroke: '#ffffff', strokeWidth: 2 }}
                          />
                          <Line isAnimationActive={false}
                            type="monotone"
                            dataKey="returningPatients"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={{ fill: '#f59e0b', strokeWidth: 1, stroke: '#ffffff', r: 3 }}
                            activeDot={{ r: 5, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* 분리해서 보기 모드 */}
                {detailViewMode === 'separated' && (
                  <div className="space-y-3">
                    {/* 총환자 추이 */}
                    <div className="bg-white rounded border border-[#b9b9b3] overflow-hidden p-3">
                      <div className="-mx-3 -mt-3 mb-2.5 px-3 py-2 bg-[#ecece9] border-b border-[#d1d1cc]">
                        <h4 className="text-[16px] font-bold text-[#0a0a0a]">총환자 추이</h4>
                        <p className="text-xs text-slate-600">월별 총 환자 수 변화</p>
                      </div>

                      <div className="h-[270px] w-full min-h-[270px] min-w-0">
                        <ResponsiveContainer width="100%" height={270} minHeight={270}>
                          <AreaChart data={selectedRegionData} margin={{ top: 16, right: 8, left: 0, bottom: 20 }}>
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
                              tickMargin={10}
                              padding={{ left: 12, right: 12 }}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: "#64748b" }}
                              axisLine={false}
                              tickLine={false}
                              width={40}
                              tickMargin={8}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value}명`, '총환자']}
                              contentStyle={{
                                borderRadius: 8,
                                border: 'none',
                                boxShadow: '0 4px 12px rgb(0 0 0 / 0.10)', fontSize: 12
                              }}
                            />
                            <Area isAnimationActive={false}
                              type="monotone"
                              dataKey="totalPatients"
                              stroke="#10b981"
                              strokeWidth={2}
                              fill="url(#gradient-detail-total)"
                              dot={{ fill: '#10b981', strokeWidth: 1, r: 3 }}
                            >
                              <LabelList dataKey="totalPatients" position="top" offset={8} formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? v : '')} style={{ fontSize: 9, fontWeight: 700, fill: "#10b981" }} />
                            </Area>
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* 신환 추이 */}
                    <div className="bg-white rounded border border-[#b9b9b3] overflow-hidden p-3">
                      <div className="-mx-3 -mt-3 mb-2.5 px-3 py-2 bg-[#ecece9] border-b border-[#d1d1cc]">
                        <h4 className="text-[16px] font-bold text-[#0a0a0a]">신환 추이</h4>
                        <p className="text-xs text-slate-600">월별 신환 수 변화</p>
                      </div>

                      <div className="h-[270px] w-full min-h-[270px] min-w-0">
                        <ResponsiveContainer width="100%" height={270} minHeight={270}>
                          <AreaChart data={selectedRegionData} margin={{ top: 16, right: 8, left: 0, bottom: 20 }}>
                            <defs>
                              <linearGradient id="gradient-detail-new" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#0062ff" stopOpacity={0.3}/>
                                <stop offset="100%" stopColor="#0062ff" stopOpacity={0.05}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                              dataKey="month"
                              tick={{ fontSize: 10, fill: "#64748b" }}
                              axisLine={false}
                              tickLine={false}
                              tickMargin={10}
                              padding={{ left: 12, right: 12 }}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: "#64748b" }}
                              axisLine={false}
                              tickLine={false}
                              width={40}
                              tickMargin={8}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value}명`, '신환']}
                              contentStyle={{
                                borderRadius: 8,
                                border: 'none',
                                boxShadow: '0 4px 12px rgb(0 0 0 / 0.10)', fontSize: 12
                              }}
                            />
                            <Area isAnimationActive={false}
                              type="monotone"
                              dataKey="newPatients"
                              stroke="#0062ff"
                              strokeWidth={2}
                              fill="url(#gradient-detail-new)"
                              dot={{ fill: '#0062ff', strokeWidth: 1, r: 3 }}
                            >
                              <LabelList dataKey="newPatients" position="top" offset={8} formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? v : '')} style={{ fontSize: 9, fontWeight: 700, fill: "#0062ff" }} />
                            </Area>
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* 구환 추이 */}
                    <div className="bg-white rounded border border-[#b9b9b3] overflow-hidden p-3">
                      <div className="-mx-3 -mt-3 mb-2.5 px-3 py-2 bg-[#ecece9] border-b border-[#d1d1cc]">
                        <h4 className="text-[16px] font-bold text-[#0a0a0a]">구환 추이</h4>
                        <p className="text-xs text-slate-600">월별 구환 수 변화</p>
                      </div>

                      <div className="h-[270px] w-full min-h-[270px] min-w-0">
                        <ResponsiveContainer width="100%" height={270} minHeight={270}>
                          <AreaChart data={selectedRegionData} margin={{ top: 16, right: 8, left: 0, bottom: 20 }}>
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
                              tickMargin={10}
                              padding={{ left: 12, right: 12 }}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: "#64748b" }}
                              axisLine={false}
                              tickLine={false}
                              width={40}
                              tickMargin={8}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value}명`, '구환']}
                              contentStyle={{
                                borderRadius: 8,
                                border: 'none',
                                boxShadow: '0 4px 12px rgb(0 0 0 / 0.10)', fontSize: 12
                              }}
                            />
                            <Area isAnimationActive={false}
                              type="monotone"
                              dataKey="returningPatients"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              fill="url(#gradient-detail-returning)"
                              dot={{ fill: '#f59e0b', strokeWidth: 1, r: 3 }}
                            >
                              <LabelList dataKey="returningPatients" position="top" offset={8} formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? v : '')} style={{ fontSize: 9, fontWeight: 700, fill: "#f59e0b" }} />
                            </Area>
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