"use client"

import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts"

const COLORS = [
  "#3182f6", "#05c072", "#f59e0b", "#f04452",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
]

type Props = {
  data: Record<string, number | string>[]
  channels: string[]
  yLabel?: string
}

export default function RouteTrendChart({ data, channels }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#8b95a1" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#8b95a1" }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          formatter={(v, name) => [`${Number(v)}명`, name]}
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
        {channels.map((ch, i) => (
          <Line
            key={ch}
            type="monotone"
            dataKey={ch}
            name={ch}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: COLORS[i % COLORS.length] }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
