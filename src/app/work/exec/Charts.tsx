"use client"

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import type { ExecData } from "./data"
import { man } from "./format"

const C = { revenue: "#9fb8e8", received: "#0062ff", outstanding: "#b54708", grid: "#ecece9", axis: "#8a8a84" }

export function TrendChart({ data }: { data: ExecData["trend"] }) {
  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#d1d1cc" }} tick={{ fontSize: 12, fill: C.axis }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 11, fill: C.axis }}
            tickFormatter={(v: number) => (v === 0 ? "0" : man(v))}
          />
          <Tooltip
            formatter={(v, name) => [`${Number(v).toLocaleString("ko-KR")}원`, String(name)]}
            contentStyle={{ fontSize: 12, borderRadius: 4, border: "1px solid #d1d1cc" }}
            cursor={{ fill: "#f2f2ef" }}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 12, color: "#6f6f6a" }} />
          <Bar dataKey="revenue" name="매출(부가세 제외)" fill={C.revenue} barSize={22} radius={[2, 2, 0, 0]} />
          <Line dataKey="received" name="입금" stroke={C.received} strokeWidth={2} dot={{ r: 2.5 }} type="monotone" />
          <Line dataKey="outstanding" name="미수금(월말)" stroke={C.outstanding} strokeWidth={1.5} strokeDasharray="4 3" dot={false} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

const AGING_COLOR: Record<string, string> = { d30: "#8a8a84", d60: "#b54708", d61: "#d92d20" }

/** 미수금 경과 기간: 3줄 막대 + 전체 비중 띠 */
export function AgingBars({ data }: { data: ExecData["aging"] }) {
  const total = data.reduce((s, b) => s + b.amount, 0)
  const max = Math.max(1, ...data.map((b) => b.amount))
  return (
    <div className="space-y-4">
      <div className="flex h-2 w-full overflow-hidden rounded-sm bg-[#ecece9]">
        {total > 0 &&
          data.map((b) => (b.amount > 0 ? <div key={b.key} style={{ width: `${(b.amount / total) * 100}%`, background: AGING_COLOR[b.key] }} /> : null))}
      </div>
      <div className="space-y-3">
        {data.map((b) => (
          <div key={b.key} className="grid grid-cols-[72px_1fr_96px] items-center gap-3 text-[13px]">
            <span className="text-[#6f6f6a]">{b.label}</span>
            <div className="h-3 bg-[#f2f2ef] rounded-sm">
              <div className="h-3 rounded-sm" style={{ width: `${(b.amount / max) * 100}%`, background: AGING_COLOR[b.key] }} />
            </div>
            <span className="text-right tabular-nums">
              <span className={b.key === "d61" && b.amount > 0 ? "text-[#d92d20] font-medium" : ""}>{man(b.amount)}</span>
              <span className="ml-1 text-[12px] text-[#8a8a84]">{b.count}건</span>
            </span>
          </div>
        ))}
      </div>
      {total === 0 && <p className="text-[13px] text-[#6f6f6a]">받지 못한 청구가 없습니다.</p>}
    </div>
  )
}
