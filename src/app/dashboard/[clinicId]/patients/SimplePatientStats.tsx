"use client"

import { useState, useEffect } from "react"
import { Users, UserPlus, UserCheck, TrendingUp, Calendar, BarChart3, Clock } from "lucide-react"
import SectionCard from "@/components/ui/SectionCard"
import StatCard from "@/components/ui/StatCard"
import PatientMonthlyChart from "@/components/charts/PatientMonthlyChart"
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
  overallAvgWaitingTime: number
  overallMaxWaitingTime: number
}

interface SimplePatientStatsProps {
  clinicId: string
  initialYear?: number
  initialMonth?: number
}

export default function SimplePatientStats({
  clinicId,
  initialYear = 2026,
  initialMonth = 5
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        <div className="text-center py-8">
          <div className="text-red-600 mb-2">⚠️ 오류</div>
          <div className="text-sm text-gray-600">{error}</div>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="space-y-8 p-6">
        {/* 헤더 섹션 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">환자 통계 대시보드</h1>
              <p className="text-slate-600">당월 신환, 구환, 전체 환자 현황을 확인하세요.</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
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
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-slate-900">상세 분석</h3>
            {displayData.totalPatientCount > 0 && (
              <span className="bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                데이터 있음
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-emerald-600" />
              <h3 className="text-xl font-bold text-slate-900">요일별 대기시간 분석</h3>
              <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs px-3 py-1 rounded-full font-medium">
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
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setWaitingTimeView('new')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  waitingTimeView === 'new'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                신환
              </button>
              <button
                onClick={() => setWaitingTimeView('returning')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  waitingTimeView === 'returning'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                구환
              </button>
            </div>
          </div>

          <p className="text-slate-600 mb-6">
            {waitingTimeView === 'total' && '일요일부터 토요일까지 전체 요일별 평균 및 최대 대기시간'}
            {waitingTimeView === 'new' && '일요일부터 토요일까지 신환 요일별 평균 및 최대 대기시간'}
            {waitingTimeView === 'returning' && '일요일부터 토요일까지 구환 요일별 평균 및 최대 대기시간'}
            <span className="text-sm text-slate-500 ml-2">(0분은 제외하고 계산, 데이터 없으면 0으로 표시)</span>
          </p>

          <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
            {(() => {
              const currentStats = waitingTimeView === 'new'
                ? displayData.newPatientWaitingStats
                : waitingTimeView === 'returning'
                ? displayData.returningPatientWaitingStats
                : displayData.weekdayWaitingStats;

              return currentStats && Object.entries(currentStats).map(([day, stats]) => (
              <div key={day} className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 rounded-xl p-4">
                <div className="text-center">
                  <h4 className="text-lg font-bold text-slate-700 mb-2">{day}요일</h4>

                  <div className="space-y-3">
                    <div>
                      <div className={`text-2xl font-bold ${
                        waitingTimeView === 'new' ? 'text-blue-600' :
                        waitingTimeView === 'returning' ? 'text-orange-600' :
                        'text-emerald-600'
                      }`}>
                        {stats.avg || 0}
                      </div>
                      <div className="text-xs text-slate-500">평균 대기시간 (분)</div>
                    </div>

                    <div>
                      <div className={`text-lg font-semibold ${
                        waitingTimeView === 'new' ? 'text-blue-500' :
                        waitingTimeView === 'returning' ? 'text-orange-500' :
                        'text-emerald-500'
                      }`}>
                        {stats.max || 0}
                      </div>
                      <div className="text-xs text-slate-500">최대 대기시간 (분)</div>
                    </div>

                    <div className="text-xs text-slate-400 border-t border-slate-200 pt-2">
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

          {/* 요일별 분석 혜택 설명 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="flex items-center gap-2 text-sm text-slate-700 bg-emerald-50 p-3 rounded-lg">
              <span className="text-emerald-600">👥</span>
              <span>요일별 직원 배치 최적화</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-700 bg-emerald-50 p-3 rounded-lg">
              <span className="text-emerald-600">⏰</span>
              <span>바쁜 요일 예약 간격 조정</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-700 bg-emerald-50 p-3 rounded-lg">
              <span className="text-emerald-600">📈</span>
              <span>환자 만족도 향상</span>
            </div>
          </div>
        </div>

        {/* 월별 그래프 섹션 */}
        <div className="space-y-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-bold text-slate-900">월별 추이 분석</h3>
              <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                {selectedYear}년
              </span>
            </div>
            <p className="text-slate-600">
              각 환자 유형별 월별 추이를 분리하여 확인하세요
            </p>
          </div>

          {/* 신환 월별 그래프 */}
          <PatientMonthlyChart
            clinicId={clinicId}
            year={selectedYear}
            chartType="new"
            title="신환 총인원"
            color="#3b82f6"
            variant="area"
            selectedMonth={selectedMonth}
          />

          {/* 구환 월별 그래프 */}
          <PatientMonthlyChart
            clinicId={clinicId}
            year={selectedYear}
            chartType="returning"
            title="구환 총인원"
            color="#10b981"
            variant="area"
            selectedMonth={selectedMonth}
          />

          {/* 전체 환자 월별 그래프 */}
          <PatientMonthlyChart
            clinicId={clinicId}
            year={selectedYear}
            chartType="total"
            title="전체 총인원"
            color="#8b5cf6"
            variant="area"
            selectedMonth={selectedMonth}
          />
        </div>

        {/* 1인 객단가 분석 섹션 */}
        <div className="space-y-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">₩</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">1인 객단가 분석</h3>
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                {selectedYear}년
              </span>
            </div>
            <p className="text-slate-600">
              환자 유형별 1인 객단가 월별 추이를 확인하여 수익성을 분석하세요
            </p>
          </div>

          {/* 전체 환자 1인 객단가 */}
          <RevenuePerPatientChart
            clinicId={clinicId}
            year={selectedYear}
            chartType="total"
            title="전체 환자"
            color="#8b5cf6"
            variant="area"
            selectedMonth={selectedMonth}
          />

          {/* 신환 1인 객단가 */}
          <RevenuePerPatientChart
            clinicId={clinicId}
            year={selectedYear}
            chartType="new"
            title="신환"
            color="#3b82f6"
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
  )
}