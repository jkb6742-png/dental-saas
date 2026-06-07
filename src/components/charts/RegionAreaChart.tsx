"use client"

import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts"
import { ChartDataPoint, ChartType } from "@/types/regionTypes"

interface RegionAreaChartProps {
  data: ChartDataPoint[]
  type: ChartType
  title: string
  description: string
  height?: number
}

const chartConfigs = {
  total: {
    dataKey: "totalPatients",
    label: "총 환자",
    color: "#10b981",
    gradientId: "gradient-total"
  },
  new: {
    dataKey: "newPatients",
    label: "신환",
    color: "#3b82f6",
    gradientId: "gradient-new"
  },
  returning: {
    dataKey: "returningPatients",
    label: "구환",
    color: "#f59e0b",
    gradientId: "gradient-returning"
  }
} as const

export default function RegionAreaChart({
  data,
  type,
  title,
  description,
  height = 256
}: RegionAreaChartProps) {
  const config = chartConfigs[type]

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
      </div>

      <div className={`h-64 mb-4 w-full min-h-[${height}px] min-w-0`}>
        <ResponsiveContainer width="100%" height={height} minHeight={height}>
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id={config.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.color} stopOpacity={0.3}/>
                <stop offset="100%" stopColor={config.color} stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}명`}
              width={50}
            />
            <Tooltip
              formatter={(value: any) => [`${value}명`, config.label]}
              contentStyle={{
                borderRadius: 12,
                border: 'none',
                boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)',
                fontSize: 13,
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)'
              }}
            />
            <Area
              type="monotone"
              dataKey={config.dataKey}
              stroke={config.color}
              strokeWidth={3}
              fill={`url(#${config.gradientId})`}
              dot={{ fill: config.color, strokeWidth: 2, stroke: '#ffffff', r: 4 }}
              activeDot={{ r: 6, fill: config.color, stroke: '#ffffff', strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}