"use client"

import { ReactNode } from "react"
import { Delta } from "@/components/dashboard/ui"

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
  lastUpdateDate?: string
}

/** 전년 동월 대비. 전년 같은 달 자료가 없으면 null(비교 불가) */
export type KpiYoy = { revenue: number | null; total: number | null; new: number | null }

type ProfessionalDashboardProps = {
  data: DashboardData
  clinicName: string
  period: { year: number; month: number }
  yoy: KpiYoy
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

function Kpi({
  label,
  value,
  unit,
  yoy,
  mom,
  extra,
}: {
  label: string
  value: string
  unit?: string
  yoy?: number | null
  mom?: number | null
  extra?: string
}) {
  return (
    <div className="min-w-0 px-4 py-3 border-b border-r border-[#e0e0db]">
      <div className="text-[13px] font-medium text-[#555555] truncate">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1 whitespace-nowrap">
        <span className="text-[28px] font-bold leading-none tabular-nums text-[#0a0a0a]">{value}</span>
        {unit && <span className="text-[13px] text-[#6f6f6a]">{unit}</span>}
      </div>
      {yoy !== undefined && (
        <div className="mt-2 text-[12px] text-[#555555] whitespace-nowrap tabular-nums">
          전년 동월 <Delta value={yoy} />
          {mom !== undefined && (
            <>
              <span className="mx-1.5 text-[#b9b9b3]">|</span>전월 <Delta value={mom} />
            </>
          )}
        </div>
      )}
      {extra && <div className="mt-1 text-[12px] text-[#6f6f6a] truncate">{extra}</div>}
    </div>
  )
}

export default function ProfessionalDashboard({ data, period, yoy, monthSelector, children }: ProfessionalDashboardProps) {
  const revenueMom =
    data.revenue.previous > 0 ? ((data.revenue.current - data.revenue.previous) / data.revenue.previous) * 100 : null
  const total = data.patients.total
  const newRatio = total > 0 ? (data.patients.new / total) * 100 : null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-bold text-[#0a0a0a]">
          {period.year}년 {period.month}월 집계
        </h2>
        <div className="flex items-center gap-3">
          {data.lastUpdateDate && (
            <span className="hidden sm:inline text-[12px] text-[#6f6f6a]">{data.lastUpdateDate}</span>
          )}
          {monthSelector}
        </div>
      </div>

      <div className="overflow-hidden bg-white border border-[#d1d1cc] rounded">
        <div className="grid grid-cols-2 lg:grid-cols-4 -mb-px -mr-px">
          <Kpi label="월 매출" value={formatKRW(data.revenue.current)} unit="원" yoy={yoy.revenue} mom={revenueMom} />
          <Kpi
            label="총 환자"
            value={total.toLocaleString("ko-KR")}
            unit="명"
            yoy={yoy.total}
            mom={data.patients.growth}
            extra={`구환 ${data.patients.returning.toLocaleString("ko-KR")}명`}
          />
          <Kpi
            label="신환"
            value={data.patients.new.toLocaleString("ko-KR")}
            unit="명"
            yoy={yoy.new}
            mom={data.patients.newGrowth ?? null}
            extra={newRatio != null ? `총 환자의 ${newRatio.toFixed(1)}%` : undefined}
          />
          <Kpi
            label="목표 달성률"
            value={data.performance.efficiency ? `${Math.round(data.performance.efficiency)}%` : "—"}
            extra={data.performance.efficiency ? "월 목표 대비" : "월 목표 미설정"}
          />
        </div>
      </div>

      {children}
    </div>
  )
}
