"use client"

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
  blue: "text-[#0062ff]",
  green: "text-[#0f9f55]",
  red: "text-[#e0383b]",
  yellow: "text-[#b97300]",
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
    <div className="min-w-0 bg-white rounded border border-[#d1d1cc] px-3.5 py-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-[12px] text-[#555555] truncate">{label}</span>
        {icon && (
          <span className={`shrink-0 [&_svg]:w-4 [&_svg]:h-4 ${colorMap[color]}`}>{icon}</span>
        )}
      </div>

      <div className="flex items-baseline gap-1 whitespace-nowrap">
        <span className="text-[22px] font-bold leading-none text-[#0a0a0a] tabular-nums">
          {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
        </span>
        {unit && <span className="text-[12px] text-[#6f6f6a]">{unit}</span>}
      </div>

      {change !== undefined && (
        <div className="mt-1.5 text-[11px] text-[#6f6f6a] whitespace-nowrap">
          <span
            className={`font-semibold tabular-nums ${
              isPositive ? "text-[#0f9f55]" : isNegative ? "text-[#e0383b]" : "text-[#555555]"
            }`}
          >
            {isPositive ? "+" : ""}
            {change.toFixed(1)}%
          </span>
          {changeLabel && <span> {changeLabel}</span>}
        </div>
      )}
    </div>
  )
}
