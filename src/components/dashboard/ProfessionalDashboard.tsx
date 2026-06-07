"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"
import StatCard from "@/components/ui/StatCard"
import {
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  Activity,
  Target,
  Clock,
  Star,
  UserPlus,
  UserCheck,
  BarChart3,
  Calendar as CalendarIcon
} from "lucide-react"

type DashboardData = {
  revenue: {
    current: number
    previous: number
    target?: number
    monthlyData: number[]
  }
  patients: {
    total: number
    new: number
    returning: number
    growth: number
    monthlyData: number[]
  }
  performance: {
    satisfaction: number
    efficiency: number
    growth: number
  }
  revenueHistory?: number[]
  newPatientHistory?: number[]
  returningPatientHistory?: number[]
  lastUpdateDate?: string
}

type ProfessionalDashboardProps = {
  data: DashboardData
  clinicName: string
  period: {
    year: number
    month: number
  }
  monthSelector?: ReactNode
  children?: ReactNode
}

export default function ProfessionalDashboard({
  data,
  clinicName,
  period,
  monthSelector,
  children
}: ProfessionalDashboardProps) {
  const revenueChange = data.revenue.previous > 0
    ? ((data.revenue.current - data.revenue.previous) / data.revenue.previous) * 100
    : 0
  const patientGrowth = data.patients.growth

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      {/* Header Section */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                {clinicName} 대시보드
              </h1>
              <p className="text-slate-600 text-sm">
                {period.year}년 {period.month}월 월별 집계 현황
              </p>
            </div>

            {/* 월별 필터를 헤더로 이동 */}
            <div className="flex items-center gap-4">
              {monthSelector}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-slate-500">마지막 업데이트</div>
                  <div className="text-sm font-medium text-slate-700">
                    {data.lastUpdateDate || new Date().toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
                <div className="w-3 h-3 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Key Metrics Grid - 월별 집계 핵심 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="총 매출"
            value={data.revenue.current}
            unit="원"
            variant="premium"
            size="lg"
            icon={<DollarSign className="w-5 h-5" />}
            change={{
              value: revenueChange,
              label: "전월 대비",
              timeframe: `${period.year}년 ${period.month}월`
            }}
            progress={data.revenue.target ? {
              current: data.revenue.current,
              target: data.revenue.target,
              label: "월 목표"
            } : undefined}
            chart={{
              data: data.revenueHistory || data.revenue.monthlyData,
              type: "line",
              color: "#8b5cf6"
            }}
          />

          <StatCard
            title="총 환자수"
            value={data.patients.total}
            unit="명"
            variant="success"
            icon={<Users className="w-5 h-5" />}
            change={{
              value: patientGrowth,
              label: "전월 대비",
              timeframe: "환자수 변화"
            }}
            chart={{
              data: data.patients.monthlyData,
              type: "line",
              color: "#10b981"
            }}
          />

          <StatCard
            title="신환수"
            value={data.patients.new}
            unit="명"
            variant="default"
            icon={<UserPlus className="w-5 h-5" />}
            subtitle={`${period.month}월 신규 환자`}
            chart={data.newPatientHistory && data.newPatientHistory.length > 1 ? {
              data: data.newPatientHistory,
              type: "line",
              color: "#3b82f6"
            } : undefined}
          />

          <StatCard
            title="구환수"
            value={data.patients.returning}
            unit="명"
            variant="info"
            icon={<UserCheck className="w-5 h-5" />}
            subtitle={`${period.month}월 기존 환자`}
            chart={data.returningPatientHistory && data.returningPatientHistory.length > 1 ? {
              data: data.returningPatientHistory,
              type: "line",
              color: "#06b6d4"
            } : undefined}
          />
        </div>

        {/* Monthly Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="신환 비율"
            value={data.patients.total > 0 ?
              ((data.patients.new / data.patients.total) * 100).toFixed(1) : 0}
            unit="%"
            icon={<BarChart3 className="w-5 h-5" />}
            subtitle="전체 환자 중 신환 비율"
            progress={{
              current: data.patients.total > 0 ?
                (data.patients.new / data.patients.total) * 100 : 0,
              target: 30,
              label: "목표 30%"
            }}
            chart={data.newPatientHistory && data.patients.monthlyData ? {
              data: data.newPatientHistory.map((newPatients, i) =>
                data.patients.monthlyData[i] > 0 ?
                  (newPatients / data.patients.monthlyData[i]) * 100 : 0
              ),
              type: "line",
              color: "#f59e0b"
            } : undefined}
          />

          <StatCard
            title="구환 비율"
            value={data.patients.total > 0 ?
              ((data.patients.returning / data.patients.total) * 100).toFixed(1) : 0}
            unit="%"
            icon={<UserCheck className="w-5 h-5" />}
            subtitle="전체 환자 중 기존 환자 비율"
            variant="success"
            chart={data.returningPatientHistory && data.patients.monthlyData ? {
              data: data.returningPatientHistory.map((returningPatients, i) =>
                data.patients.monthlyData[i] > 0 ?
                  (returningPatients / data.patients.monthlyData[i]) * 100 : 0
              ),
              type: "line",
              color: "#10b981"
            } : undefined}
          />

          <StatCard
            title="월별 성과"
            value={data.performance.efficiency}
            unit="%"
            variant="warning"
            icon={<Target className="w-5 h-5" />}
            subtitle="목표 대비 달성률"
            progress={{
              current: data.performance.efficiency,
              target: 100,
              label: "목표 달성률"
            }}
            chart={data.revenueHistory && data.revenue.target ? {
              data: data.revenueHistory.map(revenue =>
                data.revenue.target ? (revenue / data.revenue.target) * 100 : 0
              ),
              type: "line",
              color: "#f59e0b"
            } : undefined}
          />
        </div>

        {/* Performance Indicators */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
            <Target className="w-6 h-6 text-blue-600" />
            {period.year}년 {period.month}월 성과 지표
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Revenue Growth */}
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    strokeDasharray={`${Math.min(Math.max(revenueChange + 50, 0), 100)}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-slate-900">
                    {revenueChange > 0 ? '+' : ''}{revenueChange.toFixed(1)}%
                  </span>
                </div>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">매출 성장률</h3>
              <p className="text-sm text-slate-600">전월 대비 매출 변화</p>
            </div>

            {/* Patient Growth */}
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeDasharray={`${Math.min(Math.max(patientGrowth + 50, 0), 100)}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-slate-900">
                    {patientGrowth > 0 ? '+' : ''}{patientGrowth.toFixed(1)}%
                  </span>
                </div>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">환자수 변화</h3>
              <p className="text-sm text-slate-600">전월 대비 환자수 증감</p>
            </div>

            {/* Target Achievement */}
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray={`${data.performance.efficiency}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-slate-900">
                    {data.performance.efficiency}%
                  </span>
                </div>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">목표 달성률</h3>
              <p className="text-sm text-slate-600">월 목표 대비 달성도</p>
            </div>
          </div>
        </div>

        {/* Additional Content */}
        {children}
      </div>
    </div>
  )
}