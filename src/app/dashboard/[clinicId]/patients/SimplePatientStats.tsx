"use client"

import { useState, useEffect } from "react"
import { Users, UserPlus, UserCheck, TrendingUp, Calendar, BarChart3, Clock } from "lucide-react"
import SectionCard from "@/components/ui/SectionCard"
import StatCard from "@/components/ui/StatCard"
import MonthlyCompare, { type CompareRow } from "@/components/charts/MonthlyCompare"
import RevenuePerPatientChart from "@/components/charts/RevenuePerPatientChart"

interface PatientStatsData {
  year: number
  month: number
  period: string
  hasData?: boolean
  newPatientCount: number
  returningPatientCount: number
  totalPatientCount: number
  newPatientVisits: number
  returningPatientVisits: number
  totalVisits: number
  newPatientRevenue: number
  returningPatientRevenue: number
  totalRevenue: number
  weekdayWaitingStats?: {
    [key: string]: {
      avg: number
      max: number
      count: number
    }
  }
  newPatientWaitingStats?: {
    [key: string]: {
      avg: number
      max: number
      count: number
    }
  }
  returningPatientWaitingStats?: {
    [key: string]: {
      avg: number
      max: number
      count: number
    }
  }
  overallAvgWaitingTime: number
  overallMaxWaitingTime: number
}

interface SimplePatientStatsProps {
  clinicId: string
  initialYear?: number
  initialMonth?: number
  compareRows?: CompareRow[]
}

export default function SimplePatientStats({
  clinicId,
  initialYear = 2026,
  initialMonth = 5,
  compareRows = []
}: SimplePatientStatsProps) {
  const [data, setData] = useState<PatientStatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [error, setError] = useState<string | null>(null)
  const [availableMonths, setAvailableMonths] = useState<number[]>([])
  const [waitingTimeView, setWaitingTimeView] = useState<'total' | 'new' | 'returning'>('total')

  const fetchAvailableMonths = async () => {
    try {
      const response = await fetch(
        `/api/patients/available-months?clinicId=${clinicId}&year=${selectedYear}`
      )
      const result = await response.json()

      if (result.success) {
        setAvailableMonths(result.data.availableMonths)

        // 현재 선택된 월이 사용 가능한 월에 없다면 첫 번째 사용 가능한 월로 설정
        if (result.data.availableMonths.length > 0 &&
            !result.data.availableMonths.includes(selectedMonth)) {
          setSelectedMonth(result.data.availableMonths[result.data.availableMonths.length - 1]) // 최신 월 선택
        }
      }
    } catch (err) {
      console.error('사용 가능한 월 조회 오류:', err)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/patients/simple-stats?clinicId=${clinicId}&year=${selectedYear}&month=${selectedMonth}`
      )

      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || '데이터를 불러올 수 없습니다.')
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.')
      console.error('환자 통계 로딩 오류:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAvailableMonths()
  }, [clinicId, selectedYear])

  useEffect(() => {
    if (availableMonths.length > 0) {
      fetchData()
    }
  }, [clinicId, selectedYear, selectedMonth, availableMonths])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <SectionCard key={i} className="animate-pulse">
            <div className="h-20 bg-gray-200 rounded"></div>
          </SectionCard>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <SectionCard>
        <div className="text-center py-4">
          <div className="text-red-600 mb-2">⚠️ 오류</div>
          <div className="text-sm text-gray-600">{error}</div>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-[#0062ff] text-white rounded hover:bg-[#0052d6]"
          >
            다시 시도
          </button>
        </div>
      </SectionCard>
    )
  }

  // 데이터가 없어도 0으로 표시되도록 기본값 설정
  const displayData: PatientStatsData = data || {
    year: selectedYear,
    month: selectedMonth,
    period: `${selectedYear}년 ${selectedMonth}월`,
    hasData: false,
    newPatientCount: 0,
    returningPatientCount: 0,
    totalPatientCount: 0,
    newPatientVisits: 0,
    returningPatientVisits: 0,
    totalVisits: 0,
    newPatientRevenue: 0,
    returningPatientRevenue: 0,
    totalRevenue: 0,
    weekdayWaitingStats: {
      '일': { avg: 0, max: 0, count: 0 },
      '월': { avg: 0, max: 0, count: 0 },
      '화': { avg: 0, max: 0, count: 0 },
      '수': { avg: 0, max: 0, count: 0 },
      '목': { avg: 0, max: 0, count: 0 },
      '금': { avg: 0, max: 0, count: 0 },
      '토': { avg: 0, max: 0, count: 0 }
    },
    overallAvgWaitingTime: 0,
    overallMaxWaitingTime: 0
  }

  return (
    <div className="">
      <div className="space-y-3">
        {/* 헤더 섹션 */}
        <div className="bg-white rounded border border-[#d1d1cc] p-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">환자 통계 대시보드</h1>
              <p className="text-slate-600">당월 신환, 구환, 전체 환자 현황을 확인하세요.</p>
            </div>

            {/* 기간 선택 */}
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-slate-500" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-2 bg-white border border-[#d1d1cc] rounded-xl text-sm font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value={2025}>2025년</option>
                <option value={2026}>2026년</option>
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="px-4 py-2 bg-white border border-[#d1d1cc] rounded-xl text-sm font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                {availableMonths.map(month => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
              <span className="text-slate-600 font-medium bg-slate-100/50 px-3 py-2 rounded-lg">
                {displayData.period} 통계
              </span>
              {availableMonths.length > 0 && (
                <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded">
                  {selectedYear}년 데이터: {Math.min(...availableMonths)}~{Math.max(...availableMonths)}월
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 메인 환자 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 신환 총인원 */}
          <StatCard
            title="당월 신환 총인원"
            value={displayData.newPatientCount}
            unit="명"
            variant="default"
            size="lg"
            icon={<UserPlus className="w-5 h-5" />}
          />

          {/* 구환 총인원 */}
          <StatCard
            title="당월 구환 총인원"
            value={displayData.returningPatientCount}
            unit="명"
            variant="success"
            size="lg"
            icon={<UserCheck className="w-5 h-5" />}
          />

          {/* 전체 총인원 */}
          <StatCard
            title="전체 총인원"
            value={displayData.totalPatientCount}
            unit="명"
            variant="premium"
            size="lg"
            icon={<Users className="w-5 h-5" />}
          />
        </div>

        {/* 데이터 없음 알림 */}
        {displayData.totalPatientCount === 0 && (
          <div className="bg-white border border-amber-200/60 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#191f28] rounded-xl flex items-center justify-center">
                <span className="text-white text-lg">📊</span>
              </div>
              <div>
                <h3 className="font-semibold text-amber-800 mb-1">데이터가 없습니다</h3>
                <p className="text-sm text-amber-700">
                  {displayData.period}에 대한 환자 데이터가 없습니다. "전체접수수납목록.xlsx" 파일을 업로드해주세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 상세 분석 */}
        <div className="bg-white rounded border border-[#d1d1cc] p-3">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-xl font-bold text-slate-900">상세 분석</h3>
            {displayData.totalPatientCount > 0 && (
              <span className="bg-[#191f28] text-white text-xs px-3 py-1 rounded-full font-medium">
                데이터 있음
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StatCard
              title="신환 비율"
              value={displayData.totalPatientCount > 0
                ? ((displayData.newPatientCount / displayData.totalPatientCount) * 100).toFixed(1)
                : 0}
              unit="%"
              variant="default"
              progress={{
                current: displayData.totalPatientCount > 0
                  ? (displayData.newPatientCount / displayData.totalPatientCount) * 100
                  : 0,
                target: 30,
                label: "목표 30%"
              }}
            />

            <StatCard
              title="구환 비율"
              value={displayData.totalPatientCount > 0
                ? ((displayData.returningPatientCount / displayData.totalPatientCount) * 100).toFixed(1)
                : 0}
              unit="%"
              variant="success"
              progress={{
                current: displayData.totalPatientCount > 0
                  ? (displayData.returningPatientCount / displayData.totalPatientCount) * 100
                  : 0,
                target: 70,
                label: "목표 70%"
              }}
            />

            <StatCard
              title="신환 1인 객단가"
              value={displayData.newPatientCount > 0
                ? Math.round(displayData.newPatientRevenue / displayData.newPatientCount).toLocaleString()
                : 0}
              unit="원"
              variant="info"
              subtitle="신환 총매출 ÷ 신환 총인원"
            />

            <StatCard
              title="구환 1인 객단가"
              value={displayData.returningPatientCount > 0
                ? Math.round(displayData.returningPatientRevenue / displayData.returningPatientCount).toLocaleString()
                : 0}
              unit="원"
              variant="warning"
              subtitle="구환 총매출 ÷ 구환 총인원"
            />

            <StatCard
              title="전체 평균 대기시간"
              value={displayData.overallAvgWaitingTime || 0}
              unit="분"
              variant="premium"
              subtitle="전체 환자 평균 (0분 제외)"
              progress={(displayData.overallAvgWaitingTime || 0) > 0 ? {
                current: Math.min(displayData.overallAvgWaitingTime || 0, 60),
                target: 30,
                label: "목표 30분 이하"
              } : undefined}
            />

            <StatCard
              title="전체 최대 대기시간"
              value={displayData.overallMaxWaitingTime || 0}
              unit="분"
              variant="danger"
              subtitle="당월 최장 대기시간"
              progress={(displayData.overallMaxWaitingTime || 0) > 0 ? {
                current: Math.min(displayData.overallMaxWaitingTime || 0, 120),
                target: 60,
                label: "목표 60분 이하"
              } : undefined}
            />
          </div>
        </div>

        {/* 요일별 대기시간 분석 */}
        <div className="bg-white rounded border border-[#d1d1cc] p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-slate-900">요일별 대기시간 분석</h3>
              <span className="bg-[#191f28] text-white text-xs px-3 py-1 rounded-full font-medium">
                {waitingTimeView === 'total' && '전체통계'}
                {waitingTimeView === 'new' && '신환통계'}
                {waitingTimeView === 'returning' && '구환통계'}
              </span>
            </div>

            {/* 토글 버튼들 */}
            <div className="flex bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setWaitingTimeView('total')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  waitingTimeView === 'total'
                    ? 'bg-white text-emerald-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setWaitingTimeView('new')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  waitingTimeView === 'new'
                    ? 'bg-white text-[#0062ff]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                신환
              </button>
              <button
                onClick={() => setWaitingTimeView('returning')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  waitingTimeView === 'returning'
                    ? 'bg-white text-orange-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                구환
              </button>
            </div>
          </div>

          <p className="text-slate-600 mb-3">
            {waitingTimeView === 'total' && '일요일부터 토요일까지 전체 요일별 평균 및 최대 대기시간'}
            {waitingTimeView === 'new' && '일요일부터 토요일까지 신환 요일별 평균 및 최대 대기시간'}
            {waitingTimeView === 'returning' && '일요일부터 토요일까지 구환 요일별 평균 및 최대 대기시간'}
            <span className="text-sm text-slate-500 ml-2">(0분은 제외하고 계산, 데이터 없으면 0으로 표시)</span>
          </p>

          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            {(() => {
              const currentStats = waitingTimeView === 'new'
                ? displayData.newPatientWaitingStats
                : waitingTimeView === 'returning'
                ? displayData.returningPatientWaitingStats
                : displayData.weekdayWaitingStats;

              return currentStats && Object.entries(currentStats).map(([day, stats]) => (
              <div key={day} className="bg-white border border-[#d1d1cc] rounded-xl p-4">
                <div className="text-center">
                  <h4 className="text-lg font-bold text-slate-700 mb-2">{day}요일</h4>

                  <div className="space-y-3">
                    <div>
                      <div className={`text-2xl font-bold ${
                        waitingTimeView === 'new' ? 'text-[#0062ff]' :
                        waitingTimeView === 'returning' ? 'text-orange-600' :
                        'text-emerald-600'
                      }`}>
                        {stats.avg || 0}
                      </div>
                      <div className="text-xs text-slate-500">평균 대기시간 (분)</div>
                    </div>

                    <div>
                      <div className={`text-lg font-semibold ${
                        waitingTimeView === 'new' ? 'text-[#0062ff]' :
                        waitingTimeView === 'returning' ? 'text-orange-500' :
                        'text-emerald-500'
                      }`}>
                        {stats.max || 0}
                      </div>
                      <div className="text-xs text-slate-500">최대 대기시간 (분)</div>
                    </div>

                    <div className="text-xs text-slate-400 border-t border-[#d1d1cc] pt-2">
                      {stats.count}건의 데이터
                    </div>
                  </div>

                  {stats.count === 0 && (
                    <div className="mt-2 text-xs text-gray-400 bg-gray-50 rounded px-2 py-1">
                      데이터 없음
                    </div>
                  )}
                </div>
              </div>
              ))
            })()}
          </div>
        </div>

        {/* 총환자·신환·구환 월별 비교 */}
        <MonthlyCompare rows={compareRows} year={selectedYear} month={selectedMonth} />


        {/* 1인 객단가 분석 섹션 */}
        <div className="space-y-3">
          <div className="bg-white rounded border border-[#d1d1cc] p-3">
            <div className="flex items-center gap-3 mb-2.5">
              <h3 className="text-xl font-bold text-slate-900">1인 객단가 분석</h3>
              <span className="bg-[#191f28] text-white text-xs px-3 py-1 rounded-full font-medium">
                {selectedYear}년
              </span>
            </div>
            <p className="text-slate-600">
              환자 유형별 1인 객단가 월별 추이를 확인하여 수익성을 분석하세요
            </p>
          </div>

          <div className="space-y-3">
          {/* 전체 환자 1인 객단가 */}
          <RevenuePerPatientChart
            clinicId={clinicId}
            year={selectedYear}
            chartType="total"
            title="전체 환자"
            color="#191f28"
            variant="area"
            selectedMonth={selectedMonth}
          />

          {/* 신환 1인 객단가 */}
          <RevenuePerPatientChart
            clinicId={clinicId}
            year={selectedYear}
            chartType="new"
            title="신환"
            color="#0062ff"
            variant="area"
            selectedMonth={selectedMonth}
          />

          {/* 구환 1인 객단가 */}
          <RevenuePerPatientChart
            clinicId={clinicId}
            year={selectedYear}
            chartType="returning"
            title="구환"
            color="#10b981"
            variant="area"
            selectedMonth={selectedMonth}
          />
          </div>
        </div>


      </div>
    </div>
  )
}