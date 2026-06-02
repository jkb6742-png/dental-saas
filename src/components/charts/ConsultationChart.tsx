"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

type DataPoint = { name: string; 확정률: number; 확정금액: number; 계획수: number }

const fmt = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : String(v)

export default function ConsultationChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#8b95a1" }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} width={32} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={fmt} tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          formatter={(v, name) => name === "확정률" ? [`${Number(v).toFixed(1)}%`] : [`${Number(v).toLocaleString("ko-KR")}원`]}
          contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px 0 rgb(0 0 0 / 0.10)", fontSize: 13 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />
        <Bar yAxisId="left" dataKey="확정률" fill="#05c072" radius={[4, 4, 0, 0]} maxBarSize={36} unit="%" />
        <Bar yAxisId="right" dataKey="확정금액" fill="#3182f6" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}
