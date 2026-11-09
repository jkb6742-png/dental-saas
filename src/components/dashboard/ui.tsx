import { Suspense } from "react"
import MonthSelector from "@/components/ui/MonthSelector"

export const won = (v: number | null | undefined) => {
  if (v == null) return "—"
  const a = Math.abs(v)
  const sign = v < 0 ? "-" : ""
  if (a >= 100_000_000) {
    const eok = Math.floor(a / 100_000_000)
    const man = Math.round((a % 100_000_000) / 10_000)
    return `${sign}${eok}억${man ? ` ${man.toLocaleString("ko-KR")}만` : ""}`
  }
  if (a >= 10_000) return `${sign}${Math.round(a / 10_000).toLocaleString("ko-KR")}만`
  return `${sign}${Math.round(a).toLocaleString("ko-KR")}원`
}
export const num = (v: number | null | undefined, digits = 0) =>
  v == null ? "—" : v.toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits })
export const rate = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(1)}%`)

export function PageHead({
  title,
  note,
  year,
  month,
  availableMonths,
}: {
  title: string
  note?: string
  year: number
  month: number
  availableMonths: Array<{ year: number; month: number }>
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-baseline gap-2 min-w-0">
        <h2 className="text-[16px] font-bold text-[#0a0a0a]">{title}</h2>
        {note && <p className="text-[12px] text-[#6f6f6a]">{note}</p>}
      </div>
      <Suspense>
        <MonthSelector availableMonths={availableMonths} currentYear={year} currentMonth={month} />
      </Suspense>
    </div>
  )
}

/** 선으로 나눈 지표 한 줄 */
export function MetricRow({
  items,
}: {
  items: Array<{ label: string; value: string; unit?: string; note?: string; tone?: "good" | "bad" }>
}) {
  const cols = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5", 6: "md:grid-cols-6" }[items.length] ?? "md:grid-cols-4"
  return (
    <div className="overflow-hidden bg-white border border-[#d1d1cc] rounded">
      <div className={`grid grid-cols-2 ${cols} -mb-px -mr-px`}>
        {items.map((it) => (
          <div key={it.label} className="min-w-0 px-3.5 py-3 border-b border-r border-[#e0e0db]">
            <div className="text-[12px] text-[#555555] truncate">{it.label}</div>
            <div className="mt-1 flex items-baseline gap-1 whitespace-nowrap">
              <span
                className={`text-[20px] font-bold leading-none tabular-nums ${
                  it.tone === "good" ? "text-[#0f9f55]" : it.tone === "bad" ? "text-[#e0383b]" : "text-[#0a0a0a]"
                }`}
              >
                {it.value}
              </span>
              {it.unit && <span className="text-[12px] text-[#6f6f6a]">{it.unit}</span>}
            </div>
            {it.note && <div className="mt-1.5 text-[11px] text-[#6f6f6a] truncate">{it.note}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DataTable({
  head,
  rows,
  align,
}: {
  head: string[]
  rows: Array<Array<React.ReactNode>>
  /** 0번 열을 뺀 나머지는 오른쪽 정렬이 기본 */
  align?: "left"
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px] tabular-nums">
        <thead>
          <tr className="border-b border-[#d1d1cc] text-[11px] text-[#6f6f6a]">
            {head.map((h, i) => (
              <th key={h} className={`py-1.5 px-2 font-normal whitespace-nowrap ${i === 0 || align === "left" ? "text-left pl-0" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-[#ecece9] last:border-b-0">
              {r.map((c, i) => (
                <td key={i} className={`py-1.5 px-2 whitespace-nowrap ${i === 0 || align === "left" ? "text-left pl-0 text-[#0a0a0a]" : "text-right text-[#222220]"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 자료가 없을 때: 0 대신 무엇이 필요한지 적는다 */
export function NeedData({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-dashed border-[#b9b9b3] rounded px-3.5 py-2.5">
      <div className="text-[13px] font-semibold text-[#0a0a0a]">{title}</div>
      <div className="mt-0.5 text-[12px] text-[#555555]">{children}</div>
    </div>
  )
}

export function Delta({ value, unit = "%" }: { value: number | null | undefined; unit?: string }) {
  if (value == null) return <span className="text-[#6f6f6a]">비교 불가</span>
  return (
    <span className={`font-semibold ${value > 0 ? "text-[#0f9f55]" : value < 0 ? "text-[#e0383b]" : "text-[#555555]"}`}>
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}
      {unit}
    </span>
  )
}
