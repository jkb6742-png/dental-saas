"use client"

import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from "recharts"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { TrendRow } from "./trend"

// 최근 6개월 치과별 계약 이행률. 선 그래프 ↔ 치과×월 히트맵. 진행 중인 달은 점선 기준선 + 속 빈 점.

const PALETTE = ["#0062ff", "#d92d20", "#1a7f37", "#b54708", "#7a5af8", "#0e9384", "#c11574", "#475467", "#2e90fa", "#854a0e"]
const mLabel = (m: string) => `${Number(m.slice(5))}월`

export default function TrendPanel({ months, rows, currentMonth }: { months: string[]; rows: TrendRow[]; currentMonth: string }) {
  const [open, setOpen] = useState(true)
  const [view, setView] = useState<"line" | "heat">("line")
  useEffect(() => {
    try {
      const v = localStorage.getItem("work.clinics.trend")
      if (v === "closed") setOpen(false)
      if (v === "heat") setView("heat")
    } catch {}
  }, [])
  const save = (v: string) => {
    try {
      localStorage.setItem("work.clinics.trend", v)
    } catch {}
  }
  const withData = rows.filter((r) => r.cells.some((c) => c.pct !== null))
  const data = months.map((m, i) => {
    const o: Record<string, string | number | null> = { month: m }
    for (const r of withData) o[r.clinicId] = r.cells[i].pct === null ? null : Math.round(r.cells[i].pct! * 100)
    return o
  })
  const curIdx = months.indexOf(currentMonth)

  return (
    <div className="bg-white rounded border border-[#d1d1cc]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#f2f2ef]">
        <button
          className="flex items-center gap-1 text-[15px] font-bold"
          onClick={() => {
            setOpen(!open)
            save(open ? "closed" : view)
          }}
          aria-expanded={open}
        >
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          최근 6개월 계약 이행률
        </button>
        {open && withData.length > 0 && (
          <div className="ml-auto flex rounded border border-[#d1d1cc] overflow-hidden text-[13px]">
            {(["line", "heat"] as const).map((v) => (
              <button
                key={v}
                className={`px-2.5 py-1 ${view === v ? "bg-[#191f28] text-white" : "bg-white hover:bg-[#ecece9]"}`}
                onClick={() => {
                  setView(v)
                  save(v)
                }}
              >
                {v === "line" ? "추이" : "히트맵"}
              </button>
            ))}
          </div>
        )}
      </div>
      {open &&
        (withData.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-[#6f6f6a]">계약 분량 데이터가 쌓이면 표시됩니다.</p>
        ) : view === "line" ? (
          <div className="px-2 py-3 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#ecece9" vertical={false} />
                <XAxis dataKey="month" tickFormatter={mLabel} tick={{ fontSize: 12, fill: "#6f6f6a" }} axisLine={{ stroke: "#d1d1cc" }} tickLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 50, 100]} unit="%" tick={{ fontSize: 12, fill: "#6f6f6a" }} axisLine={false} tickLine={false} width={44} />
                {curIdx >= 0 && <ReferenceLine x={currentMonth} stroke="#8a8a84" strokeDasharray="4 4" label={{ value: "진행 중", position: "insideTopRight", fontSize: 11, fill: "#8a8a84" }} />}
                <Tooltip
                  formatter={(v, name) => [`${v}%`, withData.find((r) => r.clinicId === name)?.name ?? String(name)]}
                  labelFormatter={(m) => `${String(m).slice(0, 4)}년 ${mLabel(String(m))}${m === currentMonth ? " (진행 중)" : ""}`}
                  contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: "#d1d1cc" }}
                />
                <Legend formatter={(v) => withData.find((r) => r.clinicId === v)?.name ?? v} wrapperStyle={{ fontSize: 12 }} />
                {withData.map((r, i) => {
                  const color = PALETTE[i % PALETTE.length]
                  return (
                    <Line
                      key={r.clinicId}
                      dataKey={r.clinicId}
                      stroke={color}
                      strokeWidth={1.75}
                      connectNulls
                      isAnimationActive={false}
                      dot={(p: { cx?: number; cy?: number; index?: number; value?: unknown }) =>
                        p.cx === undefined || p.cy === undefined || p.value === null || p.value === undefined ? (
                          <g key={`${r.clinicId}-${p.index}`} />
                        ) : (
                          <circle key={`${r.clinicId}-${p.index}`} cx={p.cx} cy={p.cy} r={3} stroke={color} strokeWidth={1.5} fill={p.index === curIdx ? "#ffffff" : color} />
                        )
                      }
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
            <p className="px-3 text-[12px] text-[#8a8a84]">속 빈 점 = 진행 중인 달(아직 확정 아님)</p>
          </div>
        ) : (
          <div className="p-4 overflow-x-auto">
            <div className="grid gap-px text-[12px] min-w-[560px]" style={{ gridTemplateColumns: `160px repeat(${months.length}, minmax(56px, 1fr))` }}>
              <div />
              {months.map((m) => (
                <div key={m} className="text-center text-[#6f6f6a] pb-1">
                  {mLabel(m)}
                  {m === currentMonth && " ·"}
                </div>
              ))}
              {withData.map((r) => (
                <HeatRow key={r.clinicId} row={r} currentMonth={currentMonth} />
              ))}
            </div>
            <p className="mt-2 text-[12px] text-[#8a8a84]">진할수록 이행률이 높습니다. 빈칸 = 그 달 계약 분량 없음. ‘·’ 표시는 진행 중인 달.</p>
          </div>
        ))}
    </div>
  )
}

function HeatRow({ row, currentMonth }: { row: TrendRow; currentMonth: string }) {
  return (
    <>
      <div className="truncate py-1.5 pr-2 text-[13px]">{row.name}</div>
      {row.cells.map((c) => {
        const p = c.pct
        const bg = p === null ? "#f7f7f5" : `rgba(0, 98, 255, ${0.08 + p * 0.82})`
        return (
          <div
            key={c.month}
            title={p === null ? "계약 분량 없음" : `${c.done}/${c.target}`}
            className={`flex items-center justify-center rounded-[2px] tabular-nums ${c.month === currentMonth ? "outline outline-1 outline-dashed outline-[#8a8a84]" : ""}`}
            style={{ background: bg, color: p !== null && p > 0.55 ? "#ffffff" : "#0a0a0a" }}
          >
            {p === null ? "" : `${Math.round(p * 100)}%`}
          </div>
        )
      })}
    </>
  )
}
