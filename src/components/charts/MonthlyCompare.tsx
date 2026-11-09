"use client"

import { useMemo, useState } from "react"
import YearCompareChart from "@/components/charts/YearCompareChart"

export type CompareRow = {
  year: number
  month: number
  name: string
  total: number
  new: number
  returning: number
}

type Props = {
  rows: CompareRow[]
  year: number
  month: number
  /** 연령대·지역·내원경로. 비우면 항목 선택 없이 전체만 보여 준다 */
  itemLabel?: string
  items?: string[]
}

const METRICS = [
  { key: "total", name: "총환자" },
  { key: "new", name: "신환" },
  { key: "returning", name: "구환" },
] as const

function Rate({ value }: { value: number | null }) {
  if (value == null) return <b className="font-semibold text-[#6f6f6a]">비교 불가</b>
  const tone = value > 0 ? "text-[#0f9f55]" : value < 0 ? "text-[#e0383b]" : "text-[#555555]"
  return (
    <b className={`font-semibold ${tone}`}>
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}%
    </b>
  )
}

export default function MonthlyCompare({ rows, year, month, itemLabel, items = [] }: Props) {
  const [selected, setSelected] = useState("전체")
  const item = selected === "전체" || items.includes(selected) ? selected : "전체"

  const charts = useMemo(() => {
    const valueOf = (y: number, m: number, key: (typeof METRICS)[number]["key"]) => {
      const hit = rows.filter((r) => r.name === item && r.year === y && r.month === m)
      return hit.length ? hit.reduce((a, r) => a + r[key], 0) : null
    }
    return METRICS.map((metric) => {
      const data = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        const cur = m <= month ? valueOf(year, m, metric.key) : null
        const prev = valueOf(year - 1, m, metric.key)
        return {
          label: `${m}`,
          cur,
          prev,
          yoy: cur != null && prev != null && prev > 0 ? ((cur - prev) / prev) * 100 : null,
        }
      })
      const samePeriod = data.slice(0, month)
      const curSum = samePeriod.reduce((a, d) => a + (d.cur ?? 0), 0)
      // 전년 누적은 올해 값이 있는 달끼리만 더한다
      const comparable = samePeriod.filter((d) => d.cur != null && d.prev != null)
      const prevSum = comparable.reduce((a, d) => a + (d.prev ?? 0), 0)
      const curComparable = comparable.reduce((a, d) => a + (d.cur ?? 0), 0)
      // 전월 대비: 1월이면 전년 12월과 비교한다
      const thisMonth = data[month - 1]?.cur ?? null
      const lastMonth = month > 1 ? data[month - 2]?.cur ?? null : valueOf(year - 1, 12, metric.key)
      const mom = thisMonth != null && lastMonth != null && lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null
      return {
        ...metric,
        data,
        curSum,
        prevSum: comparable.length ? prevSum : null,
        yoy: comparable.length && prevSum > 0 ? ((curComparable - prevSum) / prevSum) * 100 : null,
        mom,
      }
    })
  }, [rows, item, year, month])

  const hasPrev = rows.some((r) => r.name === item && r.year === year - 1)
  const series = [
    { key: "cur", name: `${year}년`, color: "#0062ff" },
    ...(hasPrev ? [{ key: "prev", name: `${year - 1}년`, color: "#a3a39d" }] : []),
  ]

  return (
    <section className="space-y-2">
      <header className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <h3 className="text-[16px] font-bold text-[#0a0a0a]">총환자·신환·구환 월별 비교</h3>
          <span className="text-[12px] text-[#6f6f6a]">
            {year}년 1~{month}월{hasPrev ? ` · ${year - 1}년과 비교` : ""}
          </span>
        </div>
        {items.length > 0 && (
          <label className="flex items-center gap-2 text-[12px] text-[#555555]">
            {itemLabel}
            <select
              value={item}
              onChange={(e) => setSelected(e.target.value)}
              className="max-w-[220px] h-7 px-2 bg-white border border-[#d1d1cc] rounded text-[12px] text-[#0a0a0a]"
            >
              <option value="전체">전체</option>
              {items.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <div className="space-y-3">
        {charts.map((c) => (
          <div key={c.key} className="min-w-0 bg-white rounded border border-[#b9b9b3] overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2 bg-[#ecece9] border-b border-[#d1d1cc]">
              <h4 className="text-[16px] font-bold text-[#0a0a0a]">{c.name}</h4>
              <div className="text-[13px] text-[#555555] whitespace-nowrap tabular-nums">
                누적 <b className="text-[15px] text-[#0a0a0a]">{Math.round(c.curSum).toLocaleString("ko-KR")}</b>명
                <span className="ml-2 text-[#b9b9b3]" aria-hidden="true">|</span>
                <span className="ml-2">전년 동기 <Rate value={c.yoy} /></span>
                <span className="ml-2 text-[#b9b9b3]" aria-hidden="true">|</span>
                <span className="ml-2">전월 <Rate value={c.mom} /></span>
              </div>
            </div>
            <div className="px-2.5 py-2">
              <YearCompareChart data={c.data} series={series} unit="명" height={290} showValues />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
