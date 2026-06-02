"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"

type Props = {
  label: string
  value: string | number
  unit?: string
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  color?: "blue" | "green" | "red" | "yellow"
}

const colorMap = {
  blue: "bg-[#ebf3fe] text-[#3182f6]",
  green: "bg-[#e5f9f0] text-[#05c072]",
  red: "bg-[#fff0f1] text-[#f04452]",
  yellow: "bg-amber-50 text-amber-500",
}

export default function KpiCard({
  label,
  value,
  unit,
  change,
  changeLabel,
  icon,
  color = "blue",
}: Props) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_0_rgb(0_0_0/0.06)] hover:shadow-[0_4px_12px_0_rgb(0_0_0/0.08)] transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <span className="text-[13px] font-medium text-[#6b7684]">{label}</span>
        {icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-end gap-1 mb-2">
        <span className="text-[28px] font-bold leading-none text-[#191f28] tabular-nums">
          {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
        </span>
        {unit && (
          <span className="text-[15px] font-medium text-[#8b95a1] mb-0.5">{unit}</span>
        )}
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-1">
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-[#05c072]" />
          ) : isNegative ? (
            <TrendingDown className="w-3.5 h-3.5 text-[#f04452]" />
          ) : (
            <Minus className="w-3.5 h-3.5 text-[#8b95a1]" />
          )}
          <span
            className={`text-[13px] font-medium ${
              isPositive
                ? "text-[#05c072]"
                : isNegative
                ? "text-[#f04452]"
                : "text-[#8b95a1]"
            }`}
          >
            {isPositive ? "+" : ""}
            {change.toFixed(1)}%
          </span>
          {changeLabel && (
            <span className="text-[13px] text-[#b0b8c1]">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
