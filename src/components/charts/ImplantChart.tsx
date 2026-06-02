"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

type Props = {
  data: { name: string; value: number }[]
  type?: "bar" | "horizontal"
}

export default function ImplantChart({ data, type = "horizontal" }: Props) {
  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip formatter={(v) => [`${Number(v)}건`]} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px 0 rgb(0 0 0 / 0.10)", fontSize: 13 }} />
          <Bar dataKey="value" name="수술횟수" fill="#3182f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#4e5968" }} axisLine={false} tickLine={false} width={130} />
        <Tooltip formatter={(v) => [`${Number(v)}건`]} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px 0 rgb(0 0 0 / 0.10)", fontSize: 13 }} />
        <Bar dataKey="value" name="수술횟수" fill="#3182f6" radius={[0, 4, 4, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}
