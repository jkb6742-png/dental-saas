"use client"

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

type DataPoint = { name: string; 신환: number; 구환: number; 평균진료비: number }

const fmt = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : String(v)

export default function AgeChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} width={28} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={fmt} tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          formatter={(v, name) => name === "평균진료비" ? [`${Number(v).toLocaleString("ko-KR")}원`] : [`${Number(v)}명`]}
          contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px 0 rgb(0 0 0 / 0.10)", fontSize: 13 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />
        <Bar yAxisId="left" dataKey="신환" fill="#05c072" radius={[4, 4, 0, 0]} maxBarSize={32} stackId="a" />
        <Bar yAxisId="left" dataKey="구환" fill="#ebf3fe" radius={[4, 4, 0, 0]} maxBarSize={32} stackId="a" />
        <Line yAxisId="right" type="monotone" dataKey="평균진료비" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
