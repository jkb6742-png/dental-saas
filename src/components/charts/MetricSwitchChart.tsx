"use client"

import { useEffect, useMemo, useState } from "react"
import { ComposedChart, Bar, Line, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

// 내원경로 분석 화면과 같은 형태: 버튼으로 지표 하나를 고르면 그 지표만 선 하나로 그린다.
// 지표마다 색·단위·축 눈금이 다르고, 아래에 합계·평균·최고·최저 요약 박스를 붙인다.

export type SwitchMetric = {
  key: string
  name: string
  color: string
  light: string // 요약 박스 배경
  unit?: "원" | "%" | "회" | ""
  decimals?: number
  type?: "bar" | "line"
  summary?: "sum" | "avg" // 합계 박스에 합계를 쓸지(노출·클릭·광고비) 평균을 쓸지(CTR·CPC)
}

type Props = {
  data: Record<string, number | string | null>[]
  metrics: SwitchMetric[]
  storageKey?: string
  height?: number
  periodLabel?: string // 요약 박스 설명(예: "이번 달")
  background?: SwitchMetric // 항상 뒤에 연한 막대로 깔아 두는 지표(광고비). 이 지표를 고르면 막대가 주인공이 된다
}

const compact = (v: number) =>
  v >= 100_000_000 ? `${(v / 100_000_000).toFixed(1)}억` :
  v >= 10_000_000 ? `${(v / 10_000_000).toFixed(0)}천만` :
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}백만` :
  v >= 10_000 ? `${(v / 10_000).toFixed(0)}만` :
  v >= 1_000 ? `${(v / 1_000).toFixed(1)}천` : String(Math.round(v * 100) / 100)

export const fmtMetric = (v: number, m: Pick<SwitchMetric, "unit" | "decimals">) => {
  if (m.unit === "원") return `${Math.round(v).toLocaleString("ko-KR")}원`
  if (m.unit === "%") return `${v.toFixed(m.decimals ?? 2)}%`
  return `${v.toLocaleString("ko-KR", { maximumFractionDigits: m.decimals ?? 0 })}${m.unit ?? ""}`
}
const fmtTick = (v: number, m: SwitchMetric) => (m.unit === "%" ? `${v}%` : m.unit === "원" ? compact(v) : compact(v))
const fmtLabel = (v: number, m: SwitchMetric) => {
  if (v === null || v === undefined || v <= 0) return ""
  if (m.unit === "%") return `${v.toFixed(m.decimals ?? 2)}%`
  if (m.unit === "원") return compact(v)
  return v.toLocaleString("ko-KR")
}

export default function MetricSwitchChart({ data, metrics, storageKey, height = 300, periodLabel, background }: Props) {
  const [key, setKey] = useState(metrics.find((x) => x.key === "clicks")?.key ?? metrics[0]?.key)

  useEffect(() => {
    if (!storageKey) return
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved && metrics.some((m) => m.key === saved)) setKey(saved)
    } catch {}
  }, [storageKey, metrics])

  const choose = (k: string) => {
    setKey(k)
    if (storageKey) { try { localStorage.setItem(storageKey, k) } catch {} }
  }

  const m = metrics.find((x) => x.key === key) ?? metrics[0]
  const vals = useMemo(() => data.map((d) => d[m.key]).filter((v): v is number => typeof v === "number"), [data, m.key])
  const stats = useMemo(() => {
    if (!vals.length) return null
    const sum = vals.reduce((a, b) => a + b, 0)
    const avg = sum / vals.length
    let maxI = 0, minI = 0
    vals.forEach((v, i) => { if (v > vals[maxI]) maxI = i; if (v < vals[minI]) minI = i })
    const labelOf = (i: number) => { const row = data.filter((d) => typeof d[m.key] === "number")[i]; return String(row?.label ?? "") }
    return { sum, avg, max: vals[maxI], maxLabel: labelOf(maxI), min: vals[minI], minLabel: labelOf(minI) }
  }, [vals, data, m.key])
  const showLabels = data.length <= 40
  const bg = background && background.key !== m.key ? background : undefined

  return (
    <div>
      {metrics.length > 1 && <div className="flex justify-end mb-2">
        <div className="inline-flex items-center gap-1 bg-[#f2f4f6] rounded-[10px] p-1 flex-wrap">
          {metrics.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => choose(x.key)}
              className={`px-3.5 py-1.5 rounded-[8px] text-[13px] font-semibold transition ${x.key === m.key ? "text-white shadow-sm" : "text-[#6b7684] hover:text-[#191f28]"}`}
              style={x.key === m.key ? { background: x.color } : undefined}
            >
              {x.name}
            </button>
          ))}
        </div>
      </div>}

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 28, right: 24, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} tickMargin={10} padding={{ left: 16, right: 16 }} />
          <YAxis yAxisId="main" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtTick(v, m)} width={64} tickMargin={8} domain={[0, "auto"]} allowDecimals={m.unit === "%"} />
          {bg && (
            <YAxis yAxisId="bg" orientation="right" tick={{ fontSize: 11, fill: "#9aa5b1" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtTick(v, bg)} width={52} tickMargin={6} domain={[0, (max: number) => max * 1.6]} />
          )}
          <Tooltip
            formatter={(v: unknown, name: unknown) => {
              const def = bg && name === bg.name ? bg : m
              return [typeof v === "number" ? fmtMetric(v, def) : String(v), String(name)]
            }}
            contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px 0 rgba(0,0,0,0.15)", fontSize: 13 }}
          />
          {bg && (
            <Bar key={`bg-${bg.key}`} yAxisId="bg" dataKey={bg.key} name={bg.name} fill="#e3ecfb" radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false}>
              {showLabels && <LabelList dataKey={bg.key} position="insideBottom" offset={6} formatter={(v: unknown) => (typeof v === "number" ? fmtLabel(v, bg) : "")} style={{ fontSize: 10, fontWeight: 600, fill: "#7b93b8" }} />}
            </Bar>
          )}
          {(m.type ?? "line") === "bar" ? (
            <Bar key={m.key} yAxisId="main" dataKey={m.key} name={m.name} fill={m.color} radius={[6, 6, 0, 0]} maxBarSize={40}>
              {showLabels && <LabelList dataKey={m.key} position="top" offset={10} formatter={(v: unknown) => (typeof v === "number" ? fmtLabel(v, m) : "")} style={{ fontSize: 11, fontWeight: 700, fill: m.color }} />}
            </Bar>
          ) : (
            <Line key={m.key} yAxisId="main" type="monotone" dataKey={m.key} name={m.name} stroke={m.color} strokeWidth={3} dot={{ r: 5, fill: m.color, strokeWidth: 2, stroke: "#ffffff" }} activeDot={{ r: 8 }} connectNulls>
              {showLabels && <LabelList dataKey={m.key} position="top" offset={12} formatter={(v: unknown) => (typeof v === "number" ? fmtLabel(v, m) : "")} style={{ fontSize: 11, fontWeight: 700, fill: m.color }} />}
            </Line>
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {bg && (
        <div className="flex items-center gap-4 text-[12px] text-[#8b95a1] mt-1 px-1">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "#e3ecfb" }} /> {bg.name} (오른쪽 눈금)</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-1 rounded" style={{ background: m.color }} /> {m.name} (왼쪽 눈금)</span>
        </div>
      )}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: m.light }}>
            <div className="text-[16px] font-bold text-slate-900">{fmtMetric((m.summary ?? "sum") === "sum" ? stats.sum : stats.avg, m)}</div>
            <div className="text-[12px] text-slate-600">{periodLabel ? `${periodLabel} ` : ""}{(m.summary ?? "sum") === "sum" ? "합계" : "평균"}</div>
          </div>
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: m.light }}>
            <div className="text-[16px] font-bold text-slate-900">{fmtMetric(stats.avg, m)}</div>
            <div className="text-[12px] text-slate-600">구간 평균</div>
          </div>
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: m.light }}>
            <div className="text-[16px] font-bold text-slate-900">{fmtMetric(stats.max, m)}</div>
            <div className="text-[12px] text-slate-600">최고 · {stats.maxLabel}</div>
          </div>
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: m.light }}>
            <div className="text-[16px] font-bold text-slate-900">{fmtMetric(stats.min, m)}</div>
            <div className="text-[12px] text-slate-600">최저 · {stats.minLabel}</div>
          </div>
        </div>
      )}
    </div>
  )
}
