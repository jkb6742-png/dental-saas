"use client"

import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts"

export type TrendSeries = {
  key: string
  name: string
  type: "bar" | "line"
  color: string
  unit?: string
  yAxisId?: "left" | "right"
}

type Props = {
  data: Record<string, number | string>[]
  series: TrendSeries[]
  rightUnit?: string
  height?: number
}

const fmt = (v: number) =>
  v >= 100_000_000 ? `${(v / 100_000_000).toFixed(1)}억` :
  v >= 10_000_000  ? `${(v / 10_000_000).toFixed(0)}천만` :
  v >= 1_000_000   ? `${(v / 1_000_000).toFixed(0)}백만` :
  v >= 10_000      ? `${(v / 10_000).toFixed(0)}만` : String(v)

export default function TrendChart({ data, series, rightUnit, height = 280 }: Props) {
  const hasRight = series.some((s) => s.yAxisId === "right")

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: hasRight ? 16 : 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#8b95a1" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tickFormatter={fmt}
          tick={{ fontSize: 11, fill: "#8b95a1" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        {hasRight && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "#8b95a1" }}
            axisLine={false}
            tickLine={false}
            width={36}
            unit={rightUnit}
          />
        )}
        <Tooltip
          formatter={(v, name) => {
            const s = series.find((s) => s.name === name)
            const unit = s?.unit ?? ""
            const val = typeof v === "number"
              ? (unit === "원" ? `${v.toLocaleString("ko-KR")}원` : `${v.toFixed(1)}${unit}`)
              : String(v)
            return [val, name]
          }}
          contentStyle={{
            borderRadius: 12,
            border: "none",
            boxShadow: "0 4px 12px 0 rgb(0 0 0 / 0.10)",
            fontSize: 13,
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
        />
        {series.map((s) =>
          s.type === "bar" ? (
            <Bar
              key={s.key}
              yAxisId={s.yAxisId ?? "left"}
              dataKey={s.key}
              name={s.name}
              fill={s.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
          ) : (
            <Line
              key={s.key}
              yAxisId={s.yAxisId ?? "left"}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: s.color }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          )
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
