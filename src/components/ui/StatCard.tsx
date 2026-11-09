"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import MiniChart from "./MiniChart"

type StatCardProps = {
  title: string
  value: string | number
  unit?: string
  change?: {
    value: number
    label?: string
    timeframe?: string
  }
  icon?: ReactNode
  variant?: "default" | "success" | "warning" | "danger" | "premium" | "info"
  size?: "sm" | "md" | "lg"
  chart?: {
    data: number[]
    type?: "line" | "bar" | "area"
    color?: string
  }
  progress?: {
    current: number
    target: number
    label?: string
  }
  subtitle?: string
  className?: string
  children?: ReactNode
}

// 색은 숫자의 의미(진행 막대)에만 쓰고, 카드 자체는 모두 흰 면 + 1px 선으로 둔다.
const variants = {
  default: { card: "", icon: "text-[#6f6f6a]", bar: "bg-[#0062ff]" },
  success: { card: "", icon: "text-[#0f9f55]", bar: "bg-[#0f9f55]" },
  warning: { card: "", icon: "text-[#b97300]", bar: "bg-[#b97300]" },
  danger: { card: "", icon: "text-[#e0383b]", bar: "bg-[#e0383b]" },
  premium: { card: "", icon: "text-[#0a0a0a]", bar: "bg-[#191f28]" },
  info: { card: "", icon: "text-[#0062ff]", bar: "bg-[#0062ff]" },
}

const sizes = {
  sm: "px-3.5 py-3",
  md: "px-3.5 py-3",
  lg: "px-3.5 py-3"
}

export default function StatCard({
  title,
  value,
  unit,
  change,
  icon,
  variant = "default",
  size = "md",
  chart,
  progress,
  subtitle,
  className,
  children
}: StatCardProps) {
  const variantStyles = variants[variant]
  const sizeClass = sizes[size]

  const isPositive = change && change.value > 0
  const isNegative = change && change.value < 0

  const progressPercent = progress ? (progress.current / progress.target) * 100 : 0

  return (
    <div className={cn(
      "relative bg-white rounded border border-[#d1d1cc] overflow-hidden",
      sizeClass,
      variantStyles.card,
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1">
          <h3 className="text-[12px] font-normal text-[#555555]">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-[#6f6f6a]">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div className={cn(
            "flex items-center justify-center shrink-0 ml-3",
            variantStyles.icon
          )}>
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div>
        <div className="flex items-end gap-1">
          <span className={cn(
            "text-[22px] font-bold leading-none tabular-nums text-[#0a0a0a]"
          )}>
            {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
          </span>
          {unit && (
            <span className="text-[12px] text-[#6f6f6a]">{unit}</span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="mt-2">
          <div className="flex justify-between items-center text-[11px] text-[#555555] mb-1">
            <span>{progress.label || "목표 달성률"}</span>
            <span className="font-medium">{progressPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-[#ecece9] rounded-[1px] h-1 overflow-hidden">
            <div
              className={cn(
                "h-full",
                variantStyles.bar
              )}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Mini Chart */}
      {chart && chart.data.length > 0 && (
        <div className="mb-2.5">
          <MiniChart
            data={chart.data}
            type={chart.type}
            color={chart.color || (
              variant === "success" ? "#10b981" :
              variant === "warning" ? "#f59e0b" :
              variant === "danger" ? "#ef4444" :
              variant === "premium" ? "#191f28" :
              "#0062ff"
            )}
            height={32}
            animate={true}
          />
        </div>
      )}

      {/* Change Indicator */}
      {change && (
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium",
            isPositive ? "bg-emerald-100 text-emerald-700" :
            isNegative ? "bg-red-100 text-red-700" :
            "bg-slate-100 text-slate-600"
          )}>
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : isNegative ? (
              <TrendingDown className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
            <span>
              {isPositive ? "+" : ""}{change.value.toFixed(1)}%
            </span>
          </div>
          {change.label && (
            <span className="text-xs text-slate-500">{change.label}</span>
          )}
          {change.timeframe && (
            <span className="text-xs text-slate-400">({change.timeframe})</span>
          )}
        </div>
      )}

      {/* Custom Content */}
      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  )
}