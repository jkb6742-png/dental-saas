"use client"

import { AlarmClock, Building2, ChevronsLeft, ChevronsRight, LayoutList, Star, UserRound } from "lucide-react"
import type { Category, Quick } from "./shared"

// 카테고리 패널(208px): 묶음 보기(전체·내 업무·지연) / 즐겨찾기 / 사내 / 치과. 접으면 아이콘만.

export default function CategoryPanel({
  cats,
  quick,
  scope,
  onPick,
  collapsed,
  onCollapse,
  pinned,
  onPin,
}: {
  cats: Category[]
  quick: Quick | null
  scope: string
  onPick: (id: string) => void
  collapsed: boolean
  onCollapse: (v: boolean) => void
  pinned: string[]
  onPin: (id: string) => void
}) {
  const tops = [
    { id: "all", name: "전체 업무", Icon: LayoutList, n: quick?.all ?? 0, red: false },
    { id: "mine", name: "내 업무", Icon: UserRound, n: quick?.mine ?? 0, red: false },
    { id: "overdue", name: "지연 업무", Icon: AlarmClock, n: quick?.overdue ?? 0, red: true },
  ]
  if (collapsed)
    return (
      <nav aria-label="업무 카테고리" className="w-11 shrink-0 self-start bg-white rounded border border-[#d1d1cc] py-1 flex flex-col items-center gap-0.5">
        <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#ecece9] text-[#6f6f6a]" aria-label="카테고리 펼치기" onClick={() => onCollapse(false)}>
          <ChevronsRight className="w-4 h-4" />
        </button>
        {tops.map((t) => (
          <button
            key={t.id}
            className={`w-8 h-8 flex items-center justify-center rounded ${scope === t.id ? "bg-[#e8f0ff] text-[#0062ff]" : "text-[#6f6f6a] hover:bg-[#ecece9]"}`}
            aria-label={t.name}
            title={t.name}
            onClick={() => onPick(t.id)}
          >
            <t.Icon className="w-4 h-4" />
          </button>
        ))}
        <button
          className={`w-8 h-8 flex items-center justify-center rounded ${!tops.some((t) => t.id === scope) ? "bg-[#e8f0ff] text-[#0062ff]" : "text-[#6f6f6a] hover:bg-[#ecece9]"}`}
          aria-label="치과·사내 목록 펼치기"
          title={cats.find((c) => c.id === scope)?.name}
          onClick={() => onCollapse(false)}
        >
          <Building2 className="w-4 h-4" />
        </button>
      </nav>
    )

  const fav = cats.filter((c) => pinned.includes(c.id))
  const clinics = cats.filter((c) => c.id !== "internal")
  const clinicOrder = clinics.map((c) => c.id)
  return (
    <nav aria-label="업무 카테고리" className="w-[248px] shrink-0 self-start bg-white rounded-md border border-[#d1d1cc] overflow-hidden sticky top-3 max-h-[calc(100vh-24px)] overflow-y-auto">
      <div className="h-11 px-4 flex items-center border-b border-[#d1d1cc]">
        <span className="text-[14px] font-bold">카테고리</span>
        <span className="ml-auto flex gap-3 text-[11px] text-[#8a8a84]">
          <span className="w-7 text-right">진행</span>
          <span className="w-6 text-right">지연</span>
        </span>
      </div>
      <ul className="py-1.5 border-b border-[#d1d1cc]">
        {tops.map((t) => {
          const active = scope === t.id
          return (
            <li key={t.id}>
              <button
                onClick={() => onPick(t.id)}
                aria-current={active ? "page" : undefined}
                className={`w-full h-10 flex items-center gap-2.5 px-4 text-left text-[15px] ${active ? "bg-[#e8f0ff] text-[#0045b5] font-semibold shadow-[inset_3px_0_0_#0062ff]" : "text-[#222220] hover:bg-[#f5f5f2]"}`}
              >
                <t.Icon className={`w-[18px] h-[18px] ${active ? "text-[#0062ff]" : t.red && t.n > 0 ? "text-[#d92d20]" : "text-[#6f6f6a]"}`} aria-hidden="true" />
                <span className="flex-1">{t.name}</span>
                <span className={`min-w-[28px] text-right text-[13px] tabular-nums ${t.red && t.n > 0 ? "text-[#d92d20] font-bold" : active ? "text-[#0045b5] font-semibold" : "text-[#555555]"}`}>{t.n}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {fav.length > 0 && <Sec title="즐겨찾기" items={fav} scope={scope} onPick={onPick} pinned={pinned} onPin={onPin} order={clinicOrder} />}
      <Sec title="사내" items={cats.filter((c) => c.id === "internal")} scope={scope} onPick={onPick} pinned={pinned} onPin={onPin} order={clinicOrder} />
      <Sec title={`치과 ${clinics.length}곳`} items={clinics} scope={scope} onPick={onPick} pinned={pinned} onPin={onPin} order={clinicOrder} />
      <button className="w-full h-9 flex items-center justify-center gap-1 text-[12px] text-[#8a8a84] hover:bg-[#f2f2ef]" onClick={() => onCollapse(true)}>
        <ChevronsLeft className="w-3.5 h-3.5" aria-hidden="true" />
        패널 접기
      </button>
    </nav>
  )
}

// 치과 이름 첫 글자 네모: 이름마다 고정된 옅은 색으로 구분
const TINTS = [
  ["#e8f0ff", "#0045b5"],
  ["#e7f6ec", "#1a7f37"],
  ["#fff1e6", "#b54708"],
  ["#f1ecff", "#5b3fd1"],
  ["#e6f6f8", "#0e7490"],
  ["#fdebec", "#b42318"],
  ["#f2f2ef", "#3d3d3a"],
]
// 치과 목록 순서대로 색을 돌려 써서 서로 겹치지 않게(회색 제외 6색)
const tintOf = (id: string, order: string[]) => {
  const i = order.indexOf(id)
  return TINTS[(i < 0 ? 0 : i) % (TINTS.length - 1)]
}

function Sec({ title, items, scope, onPick, pinned, onPin, order }: { title: string; items: Category[]; scope: string; onPick: (id: string) => void; pinned: string[]; onPin: (id: string) => void; order: string[] }) {
  return (
    <section className="border-b border-[#d1d1cc] last:border-b-0">
      <h2 className="h-8 px-4 flex items-center text-[12px] font-semibold text-[#6f6f6a] bg-[#f7f7f5] border-b border-[#ecece9]">{title}</h2>
      <ul className="py-1">
        {items.map((c) => {
          const active = c.id === scope
          const isPinned = pinned.includes(c.id)
          const [bg, fg] = c.id === "internal" ? ["#191f28", "#ffffff"] : tintOf(c.id, order)
          return (
            <li key={c.id} className="group/cat relative">
              <button
                onClick={() => onPick(c.id)}
                aria-current={active ? "page" : undefined}
                className={`w-full h-11 flex items-center gap-2.5 pl-4 pr-3 text-left text-[15px] ${active ? "bg-[#e8f0ff] text-[#0045b5] font-semibold shadow-[inset_3px_0_0_#0062ff]" : "text-[#222220] hover:bg-[#f5f5f2]"}`}
              >
                <span className="w-6 h-6 shrink-0 rounded flex items-center justify-center text-[12px] font-bold" style={{ background: bg, color: fg }} aria-hidden="true">
                  {c.id === "internal" ? "T" : c.name.slice(0, 1)}
                </span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className={`w-7 text-right text-[13px] tabular-nums ${c.open ? (active ? "text-[#0045b5] font-semibold" : "text-[#3d3d3a] font-medium") : "text-[#c4c4be]"}`} title="진행 중">
                  {c.open}
                </span>
                <span className={`w-6 text-right text-[13px] tabular-nums ${c.overdue > 0 ? "text-[#d92d20] font-bold" : "text-[#d9d9d4]"}`} title="지연">
                  {c.overdue > 0 ? c.overdue : "·"}
                </span>
              </button>
              <button
                className={`absolute right-[72px] top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded bg-white/80 ${isPinned ? "text-[#b54708]" : "text-[#b0b0aa] opacity-0 group-hover/cat:opacity-100"} focus:opacity-100`}
                aria-label={isPinned ? `${c.name} 즐겨찾기 해제` : `${c.name} 즐겨찾기`}
                title={isPinned ? "즐겨찾기 해제" : "즐겨찾기"}
                onClick={() => onPin(c.id)}
              >
                <Star className="w-3.5 h-3.5" fill={isPinned ? "currentColor" : "none"} />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
