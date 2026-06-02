"use client"

import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts"

type DataPoint = { label: string; revenue: number; net: number }

const fmt = (v: number) =>
  v >= 100_000_000 ? `${(v / 100_000_000).toFixed(1)}억` :
  v >= 10_000_000  ? `${(v / 10_000_000).toFixed(0)}천만` :
  v >= 1_000_000   ? `${(v / 1_000_000).toFixed(0)}백만` :
  v >= 10_000      ? `${(v / 10_000).toFixed(0)}만` : String(v)

export default function RevenueChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} width={52} />
        <Tooltip
          formatter={(v, name) => [`${Number(v).toLocaleString("ko-KR")}원`, name]}
          contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px 0 rgb(0 0 0 / 0.10)", fontSize: 13 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
        <Bar dataKey="revenue" name="총 매출" fill="#3182f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Line type="monotone" dataKey="net" name="순이익" stroke="#05c072" strokeWidth={2.5} dot={{ r: 3.5, fill: "#05c072" }} activeDot={{ r: 5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
