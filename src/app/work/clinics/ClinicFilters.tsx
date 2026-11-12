"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Search } from "lucide-react"

// 목록 필터: 담당 직원 · 상태 · 마감 · 검색. 모두 주소(쿼리)에 남겨 공유·새로고침해도 유지.

const sel = "h-8 px-2 rounded border border-[#d1d1cc] bg-white text-[14px]"

export default function ClinicFilters({ staff }: { staff: { id: string; name: string }[] }) {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get("q") ?? "")
  useEffect(() => setQ(sp.get("q") ?? ""), [sp])

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString())
    if (v) p.set(k, v)
    else p.delete(k)
    router.replace(`${path}${p.size ? `?${p}` : ""}`, { scroll: false })
  }
  const status = sp.get("status") ?? ""

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="담당 직원" className={sel} value={sp.get("staff") ?? ""} onChange={(e) => set("staff", e.target.value)}>
        <option value="">담당 직원 전체</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <div className="flex rounded border border-[#d1d1cc] bg-white overflow-hidden text-[13px]" role="group" aria-label="상태">
        {[
          ["", "전체"],
          ["risk", "위험"],
          ["warn", "주의"],
          ["ok", "정상"],
        ].map(([v, l]) => (
          <button key={v} className={`px-2.5 h-8 ${status === v ? "bg-[#191f28] text-white" : "hover:bg-[#ecece9]"}`} onClick={() => set("status", v)} aria-pressed={status === v}>
            {l}
          </button>
        ))}
      </div>
      <select aria-label="마감 상태" className={sel} value={sp.get("close") ?? ""} onChange={(e) => set("close", e.target.value)}>
        <option value="">마감 상태 전체</option>
        <option value="open">진행중</option>
        <option value="ops">운영 마감</option>
        <option value="final">최종 마감</option>
        <option value="prev">전월 미마감</option>
      </select>
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault()
          set("q", q.trim())
        }}
      >
        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#8a8a84]" aria-hidden="true" />
        <input className={`${sel} pl-7 w-[180px]`} placeholder="치과 이름 검색" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q.trim() !== (sp.get("q") ?? "") && set("q", q.trim())} />
      </form>
    </div>
  )
}
