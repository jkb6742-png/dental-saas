"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "@/components/charts/recharts"

type Day = { day: string; label: string; done: number; due: number }

// 내 최근 7일: 완료 수(초록) vs 그날 마감이던 업무 수(회색)
export default function WeekBars({ data }: { data: Day[] }) {
  const total = data.reduce((s, d) => s + d.done + d.due, 0)
  if (total < 2) return <p className="px-4 py-8 text-center text-[13px] text-[#8a8a84]">데이터 모으는 중입니다. 업무를 완료하면 여기에 쌓입니다.</p>
  const done = data.reduce((s, d) => s + d.done, 0)
  const due = data.reduce((s, d) => s + d.due, 0)
  return (
    <div className="px-2 pt-2 pb-3">
      <div className="px-2 mb-1 flex items-center gap-3 text-[12px] text-[#6f6f6a]">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-[#1a7f37]" /> 완료 <b className="tabular-nums">{done}</b>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-[#c4c4be]" /> 마감 예정 <b className="tabular-nums">{due}</b>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={180} minHeight={180}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="#ecece9" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#d1d1cc" }} tick={{ fontSize: 11, fill: "#6f6f6a" }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8a8a84" }} />
          <Tooltip cursor={{ fill: "#f2f2ef" }} contentStyle={{ fontSize: 12, borderColor: "#d1d1cc", borderRadius: 4 }} />
          <Bar dataKey="done" name="완료" fill="#1a7f37" radius={[2, 2, 0, 0]} maxBarSize={14} isAnimationActive={false} />
          <Bar dataKey="due" name="마감 예정" fill="#c4c4be" radius={[2, 2, 0, 0]} maxBarSize={14} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
