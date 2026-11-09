"use client"

import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "@/components/charts/recharts"

const COLORS = [
  "#0062ff", "#05c072", "#f59e0b", "#f04452",
  "#191f28", "#ec4899", "#14b8a6", "#f97316",
]

type Props = {
  data: Record<string, number | string>[]
  channels: string[]
  yLabel?: string
}

export default function RouteTrendChart({ data, channels }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 22, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#8b95a1" }}
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          padding={{ left: 14, right: 14 }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#8b95a1" }}
          axisLine={false}
          tickLine={false}
          width={52}
          tickMargin={8}
        />
        <Tooltip
          formatter={(v, name) => [`${Number(v)}명`, name]}
          contentStyle={{
            borderRadius: 4, border: '1px solid #d1d1cc',
            boxShadow: '0 4px 12px rgb(0 0 0 / 0.10)', fontSize: 13,
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
        />
        {channels.map((ch, i) => (
          <Line isAnimationActive={false}
            key={ch}
            type="monotone"
            dataKey={ch}
            name={ch}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS[i % COLORS.length] }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
