"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  label: string
  value: string | number
  unit?: string
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  variant?: "primary" | "success" | "warning" | "danger" | "info"
  showProgress?: boolean
  progressValue?: number
  maxValue?: number
  subtitle?: string
}

const variantStyles = {
  primary: {
    card: "bg-white border-[#d1d1cc]",
    icon: "bg-[#191f28] text-white shadow-blue-500/25",
    value: "text-blue-900",
    progress: "bg-[#0062ff]"
  },
  success: {
    card: "bg-white border-[#d1d1cc]",
    icon: "bg-[#191f28] text-white shadow-emerald-500/25",
    value: "text-emerald-900",
    progress: "bg-emerald-500"
  },
  warning: {
    card: "bg-white border-amber-100",
    icon: "bg-[#191f28] text-white shadow-amber-500/25",
    value: "text-amber-900",
    progress: "bg-amber-500"
  },
  danger: {
    card: "bg-white border-red-100",
    icon: "bg-[#191f28] text-white shadow-red-500/25",
    value: "text-red-900",
    progress: "bg-red-500"
  },
  info: {
    card: "bg-white border-slate-100",
    icon: "bg-[#191f28] text-white shadow-slate-500/25",
    value: "text-slate-900",
    progress: "bg-slate-500"
  }
}

export default function EnhancedKpiCard({
  label,
  value,
  unit,
  change,
  changeLabel,
  icon,
  variant = "primary",
  showProgress = false,
  progressValue,
  maxValue = 100,
  subtitle,
}: Props) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0
  const styles = variantStyles[variant]
  const progressPercent = progressValue ? (progressValue / maxValue) * 100 : 0

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-4 border",
      " hover:-translate-y-1 ease-out",
      "before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/20 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity",
      styles.card
    )}>
      {/* Background Pattern */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
        <div className="w-full h-full hidden" />
      </div>

      {/* Header */}
      <div className="relative flex items-start justify-between mb-3">
        <div>
          <span className="text-sm font-medium text-slate-600 mb-1 block">{label}</span>
          {subtitle && (
            <span className="text-xs text-slate-500">{subtitle}</span>
          )}
        </div>
        {icon && (
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            "transform transition-transform duration-200",
            styles.icon
          )}>
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="relative flex items-end gap-2 mb-2.5">
        <span className={cn(
          "text-3xl font-bold leading-none tabular-nums tracking-tight",
          styles.value
        )}>
          {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
        </span>
        {unit && (
          <span className="text-lg font-medium text-slate-500 mb-1">{unit}</span>
        )}
      </div>

      {/* Progress Bar */}
      {showProgress && progressValue !== undefined && (
        <div className="mb-2.5">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>진행률</span>
            <span>{progressPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-1000 ease-out", styles.progress)}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Change Indicator */}
      {change !== undefined && (
        <div className="relative flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium",
            isPositive ? "bg-emerald-100 text-emerald-700" :
            isNegative ? "bg-red-100 text-red-700" :
            "bg-slate-100 text-slate-600"
          )}>
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : isNegative ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <Minus className="w-4 h-4" />
            )}
            <span>
              {isPositive ? "+" : ""}{change.toFixed(1)}%
            </span>
          </div>
          {changeLabel && (
            <span className="text-xs text-slate-500">{changeLabel}</span>
          )}
        </div>
      )}

      {/* Shine Effect */}
    </div>
  )
}