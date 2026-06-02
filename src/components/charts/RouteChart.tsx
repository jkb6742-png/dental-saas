"use client"

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"

const COLORS = ["#3182f6", "#05c072", "#f59e0b", "#f04452", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"]

export default function RouteChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => [`${Number(v)}명`]}
          contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px 0 rgb(0 0 0 / 0.10)", fontSize: 13 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
