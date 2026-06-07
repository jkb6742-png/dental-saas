"use client"

import { cn } from "@/lib/utils"

type MiniChartProps = {
  data: number[]
  type?: "line" | "bar" | "area"
  color?: string
  height?: number
  showDots?: boolean
  animate?: boolean
}

export default function MiniChart({
  data,
  type = "line",
  color = "#3b82f6",
  height = 40,
  showDots = false,
  animate = true
}: MiniChartProps) {
  if (!data.length) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = ((max - value) / range) * height
    return { x, y, value }
  })

  const pathData = points.map((point, index) =>
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ')

  const areaPath = type === "area" ? `${pathData} L 100 ${height} L 0 ${height} Z` : ""

  return (
    <div className="w-full" style={{ height: height + 10 }}>
      <svg
        width="100%"
        height={height + 10}
        viewBox={`0 0 100 ${height + 10}`}
        className="overflow-visible"
      >
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="20" height="10" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.2" opacity="0.1"/>
          </pattern>

          {/* Gradient for area chart */}
          <linearGradient id={`gradient-${type}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Bar Chart */}
        {type === "bar" && points.map((point, index) => {
          const barHeight = height - point.y
          const barWidth = 100 / data.length * 0.6
          return (
            <rect
              key={index}
              x={point.x - barWidth / 2}
              y={point.y}
              width={barWidth}
              height={barHeight}
              fill={color}
              opacity="0.8"
              className={animate ? "animate-pulse" : ""}
              style={{
                animation: animate ? `grow-bar 0.8s ease-out ${index * 0.1}s both` : undefined
              }}
            />
          )
        })}

        {/* Area Chart */}
        {type === "area" && (
          <path
            d={areaPath}
            fill={`url(#gradient-${type})`}
            className={animate ? "animate-pulse" : ""}
            style={{
              animation: animate ? "fade-in 1s ease-out 0.3s both" : undefined
            }}
          />
        )}

        {/* Line Chart */}
        {(type === "line" || type === "area") && (
          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={animate ? "animate-pulse" : ""}
            style={{
              strokeDasharray: animate ? "200" : undefined,
              strokeDashoffset: animate ? "200" : undefined,
              animation: animate ? "draw-line 1.5s ease-out both" : undefined
            }}
          />
        )}

        {/* Dots */}
        {showDots && points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="3"
            fill={color}
            stroke="white"
            strokeWidth="2"
            className="hover:r-4 transition-all duration-200"
            style={{
              animation: animate ? `appear-dot 0.5s ease-out ${index * 0.1 + 1}s both` : undefined
            }}
          />
        ))}
      </svg>

      <style jsx>{`
        @keyframes draw-line {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes grow-bar {
          from {
            transform: scaleY(0);
            transform-origin: bottom;
          }
          to {
            transform: scaleY(1);
          }
        }

        @keyframes appear-dot {
          from {
            opacity: 0;
            transform: scale(0);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}