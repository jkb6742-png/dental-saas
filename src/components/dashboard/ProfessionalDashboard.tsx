"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"

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
    newGrowth?: number
    returningGrowth?: number
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
  period: { year: number; month: number }
  monthSelector?: ReactNode
  children?: ReactNode
}

function formatKRW(v: number): string {
  if (v >= 1e8) {
    const eok = Math.floor(v / 1e8)
    const man = Math.round((v % 1e8) / 1e4)
    return man ? `${eok}억 ${man.toLocaleString()}만` : `${eok}억`
  }
  const man = Math.round(v / 1e4)
  return man ? `${man.toLocaleString()}만` : "0"
}

function KpiCard({
  title,
  value,
  unit,
  change,
  changeLabel,
}: {
  title: string
  value: string
  unit?: string
  change?: number
  changeLabel?: string
}) {
  const pos = typeof change === "number" && change > 0
  const neg = typeof change === "number" && change < 0
  return (
    <div className="bg-white rounded-2xl border border-[#e5e8eb] p-5">
      <div className="text-[13px] text-[#8b95a1] mb-2">{title}</div>
      <div className="flex items-end gap-1 mb-2.5">
        <span className="text-[26px] font-bold text-[#191f28] leading-none tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-[13px] text-[#adb5bd] mb-0.5">{unit}</span>
        )}
      </div>
      {typeof change === "number" && (
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold",
              pos
                ? "bg-[#e7f7ee] text-[#099268]"
                : neg
                ? "bg-[#fdecec] text-[#e03131]"
                : "bg-[#f2f4f6] text-[#6b7684]"
            )}
          >
            {pos ? (
              <TrendingUp className="w-3 h-3" />
            ) : neg ? (
              <TrendingDown className="w-3 h-3" />
            ) : null}
            {pos ? "+" : ""}
            {change.toFixed(1)}%
          </span>
          {changeLabel && (
            <span className="text-[11px] text-[#adb5bd]">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}

function MiniStat({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#e5e8eb] px-5 py-4">
      <div className="text-[12px] text-[#8b95a1] mb-1">{label}</div>
      <div className="text-[18px] font-bold text-[#191f28] tabular-nums">
        {value}
      </div>
      {sub && <div className="text-[11px] text-[#adb5bd] mt-0.5">{sub}</div>}
    </div>
  )
}

export default function ProfessionalDashboard({
  data,
  clinicName,
  period,
  monthSelector,
  children,
}: ProfessionalDashboardProps) {
  const revenueChange =
    data.revenue.previous > 0
      ? ((data.revenue.current - data.revenue.previous) / data.revenue.previous) * 100
      : 0

  const total = data.patients.total
  const newRatio = total > 0 ? (data.patients.new / total) * 100 : 0
  const returningRatio = total > 0 ? (data.patients.returning / total) * 100 : 0

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      {/* Header */}
      <div className="bg-white border-b border-[#e5e8eb] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-bold text-[#191f28]">
              {clinicName}
            </h1>
            <p className="text-[13px] text-[#8b95a1] mt-0.5">
              {period.year}년 {period.month}월 집계
            </p>
          </div>
          <div className="flex items-center gap-4">
            {monthSelector}
            {data.lastUpdateDate && (
              <div className="text-right hidden sm:block">
                <div className="text-[11px] text-[#adb5bd]">마지막 업데이트</div>
                <div className="text-[12px] font-medium text-[#4e5968]">
                  {data.lastUpdateDate}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* 핵심 지표 4개 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="총 매출"
            value={formatKRW(data.revenue.current)}
            unit="원"
            change={revenueChange}
            changeLabel="전월 대비"
          />
          <KpiCard
            title="총 환자수"
            value={total.toLocaleString("ko-KR")}
            unit="명"
            change={data.patients.growth}
            changeLabel="전월 대비"
          />
          <KpiCard
            title="신환수"
            value={data.patients.new.toLocaleString("ko-KR")}
            unit="명"
            change={data.patients.newGrowth}
            changeLabel="전월 대비"
          />
          <KpiCard
            title="구환수"
            value={data.patients.returning.toLocaleString("ko-KR")}
            unit="명"
            change={data.patients.returningGrowth}
            changeLabel="전월 대비"
          />
        </div>

        {/* 보조 지표 */}
        <div className="grid grid-cols-3 gap-4">
          <MiniStat
            label="신환 비율"
            value={total > 0 ? `${newRatio.toFixed(1)}%` : "—"}
            sub="전체 환자 중"
          />
          <MiniStat
            label="구환 비율"
            value={total > 0 ? `${returningRatio.toFixed(1)}%` : "—"}
            sub="전체 환자 중"
          />
          <MiniStat
            label="목표 달성률"
            value={
              data.performance.efficiency
                ? `${Math.round(data.performance.efficiency)}%`
                : "—"
            }
            sub="월 목표 대비"
          />
        </div>

        {/* 추가 콘텐츠 (매출 트렌드 / 리뷰 / 실행계획) */}
        {children}
      </div>
    </div>
  )
}
