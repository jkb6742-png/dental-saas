"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

type DataPoint = { name: string; 신환: number; 구환: number }

export default function AgeBarChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#4e5968" }} axisLine={false} tickLine={false} width={60} />
        <Tooltip formatter={(v) => [`${Number(v)}명`]} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px 0 rgb(0 0 0 / 0.10)", fontSize: 13 }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="신환" fill="#05c072" radius={[0, 3, 3, 0]} maxBarSize={14} stackId="a" />
        <Bar dataKey="구환" fill="#ebf3fe" radius={[0, 3, 3, 0]} maxBarSize={14} stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  )
}
