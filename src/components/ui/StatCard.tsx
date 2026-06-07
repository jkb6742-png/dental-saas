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

const variants = {
  default: {
    card: "bg-white border-slate-200 hover:border-slate-300",
    header: "text-slate-600",
    value: "text-slate-900",
    icon: "bg-slate-100 text-slate-600"
  },
  success: {
    card: "bg-gradient-to-br from-emerald-50/50 to-green-50/50 border-emerald-200 hover:border-emerald-300",
    header: "text-emerald-700",
    value: "text-emerald-900",
    icon: "bg-emerald-100 text-emerald-600"
  },
  warning: {
    card: "bg-gradient-to-br from-amber-50/50 to-orange-50/50 border-amber-200 hover:border-amber-300",
    header: "text-amber-700",
    value: "text-amber-900",
    icon: "bg-amber-100 text-amber-600"
  },
  danger: {
    card: "bg-gradient-to-br from-red-50/50 to-rose-50/50 border-red-200 hover:border-red-300",
    header: "text-red-700",
    value: "text-red-900",
    icon: "bg-red-100 text-red-600"
  },
  premium: {
    card: "bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 border-violet-200 hover:border-violet-300 shadow-lg shadow-violet-500/10",
    header: "text-violet-700",
    value: "text-violet-900",
    icon: "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25"
  },
  info: {
    card: "bg-gradient-to-br from-cyan-50/50 to-blue-50/50 border-cyan-200 hover:border-cyan-300",
    header: "text-cyan-700",
    value: "text-cyan-900",
    icon: "bg-cyan-100 text-cyan-600"
  }
}

const sizes = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8"
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
      "relative rounded-2xl border transition-all duration-300 hover:shadow-lg group overflow-hidden",
      sizeClass,
      variantStyles.card,
      className
    )}>
      {/* Background decoration */}
      {variant === "premium" && (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 via-purple-600/3 to-indigo-600/5" />
      )}

      {/* Header */}
      <div className="relative flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className={cn("text-sm font-medium mb-1", variantStyles.header)}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-3",
            "transition-all duration-200 group-hover:scale-110",
            variantStyles.icon
          )}>
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="relative mb-4">
        <div className="flex items-end gap-1">
          <span className={cn(
            "text-3xl font-bold leading-none tabular-nums",
            variantStyles.value
          )}>
            {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
          </span>
          {unit && (
            <span className="text-lg font-medium text-slate-500 mb-1">{unit}</span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="mb-4">
          <div className="flex justify-between items-center text-xs text-slate-600 mb-2">
            <span>{progress.label || "목표 달성률"}</span>
            <span className="font-medium">{progressPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out",
                variant === "success" ? "bg-gradient-to-r from-emerald-500 to-green-500" :
                variant === "warning" ? "bg-gradient-to-r from-amber-500 to-orange-500" :
                variant === "danger" ? "bg-gradient-to-r from-red-500 to-rose-500" :
                variant === "premium" ? "bg-gradient-to-r from-violet-500 to-purple-500" :
                "bg-gradient-to-r from-blue-500 to-indigo-500"
              )}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Mini Chart */}
      {chart && chart.data.length > 0 && (
        <div className="mb-4">
          <MiniChart
            data={chart.data}
            type={chart.type}
            color={chart.color || (
              variant === "success" ? "#10b981" :
              variant === "warning" ? "#f59e0b" :
              variant === "danger" ? "#ef4444" :
              variant === "premium" ? "#8b5cf6" :
              "#3b82f6"
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

      {/* Hover effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  )
}