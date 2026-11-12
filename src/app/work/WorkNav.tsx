"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { ChevronRight, Star, X, History, Search } from "lucide-react"
import { WORK_ICONS, findWorkEntry, hrefScore, workSectionLabel, flatEntries, type WorkNavEntry } from "./nav"
import { useRecent, usePins, rememberRecent, usePopover, isTyping, kstMonth } from "./shell/store"

type Clinic = { id: string; name: string }
const INTERNAL: Clinic = { id: "internal", name: "THINKLAB 사내" }

// 왼쪽 메뉴. 92px 아이콘 줄 + 옆에 겹쳐 열리는 240px 2단 패널.
// 2단 패널: 하위 메뉴 → (홈·업무·치과) 고정한 치과·치과 목록(별표)·최근 본 항목.
// 단축키 Alt+1~7 = 1단 메뉴 순서대로 열기, Esc 닫기.
export default function WorkNav({ groups, clinics }: { groups: WorkNavEntry[][]; clinics: Clinic[] }) {
  const path = usePathname()
  const search = useSearchParams().toString()
  const activeEntry = findWorkEntry(groups, path, search)
  const [open, setOpen] = useState<WorkNavEntry | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const railButtons = useRef(new Map<string, HTMLButtonElement>())
  const recent = useRecent()
  const { pins, isPinned, toggle, error: pinError } = usePins()

  useEffect(() => setOpen(null), [path, search])

  // 화면 이동 = 최근 본 항목에 기록(치과 화면은 치과 이름으로)
  const clinicName = useMemo(() => new Map([INTERNAL, ...clinics].map((c) => [c.id, c.name])), [clinics])
  useEffect(() => {
    const qs = new URLSearchParams(search)
    if (qs.get("open")) return // 업무 상세는 업무 화면이 제목과 함께 기록한다(work:recent 이벤트)
    let label = workSectionLabel(path, search)
    const m = path.match(/^\/work\/clinics\/([^/]+)(?:\/(\d{4}-\d{2}))?/)
    if (m && clinicName.get(m[1])) label = `${clinicName.get(m[1])} ${m[2] ? `${m[2].slice(5)}월 현황` : "현황"}`
    const scope = path === "/work/board" ? qs.get("scope") : null
    if (scope && clinicName.get(scope)) label = `${clinicName.get(scope)} 보드`
    if (path === "/work/today" || path === "/work") return // 홈은 기록하지 않는다
    rememberRecent(search ? `${path}?${search}` : path, label)
  }, [path, search, clinicName])

  // 패널: 바깥 클릭·Esc 로 닫고, 닫히면 레일 버튼으로 포커스 복귀(트랩은 하지 않음: 레일로 바로 갈 수 있게)
  usePopover(panel, !!open, () => setOpen(null), { trap: false, autoFocus: false })

  const flat = flatEntries(groups)
  // Alt+1~7
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || isTyping(e)) return
      const n = /^Digit([1-9])$/.exec(e.code)?.[1]
      if (!n) return
      const entry = flat[Number(n) - 1]
      if (!entry) return
      e.preventDefault()
      setOpen(entry)
      railButtons.current.get(entry.label)?.focus()
      // 패널 첫 링크로 포커스
      setTimeout(() => panel.current?.querySelector<HTMLElement>("[data-panel] a,[data-panel] button")?.focus(), 0)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [flat])

  const itemClass = (highlight: boolean) =>
    `relative w-full flex flex-col items-center justify-center gap-1.5 h-16 px-1 ${
      highlight
        ? "bg-white text-[#0a0a0a] font-semibold shadow-[inset_3px_0_0_#0062ff]"
        : "text-[#3d3d3a] hover:bg-[#e0e0db] hover:text-[#0a0a0a]"
    }`

  let index = 0
  return (
    <div ref={panel} className="shrink-0 h-screen relative">
      <nav aria-label="업무 메뉴" className="w-[92px] h-full bg-[#e9e9e5] border-r border-[#d1d1cc] flex flex-col">
        <Link
          href="/work/today"
          prefetch={false}
          title="THINKLAB 업무"
          className="h-[52px] shrink-0 flex items-center justify-center border-b border-[#d1d1cc]"
        >
          <i className="block w-[14px] h-[14px] rounded-[2px] bg-[#0062ff]" aria-hidden="true" />
        </Link>
        <div className="flex-1 overflow-y-auto py-1.5">
          {groups.map((group, g) => (
            <Fragment key={g}>
              {g > 0 && <div className="mx-4 my-1.5 border-t border-[#d1d1cc]" />}
              {group.map((entry) => {
                const Icon = WORK_ICONS[entry.icon]
                const isOpen = open === entry
                const highlight = isOpen || (!open && entry === activeEntry)
                const n = ++index
                const inner = (
                  <>
                    <Icon className={`w-[22px] h-[22px] shrink-0 ${highlight ? "text-[#0062ff]" : "text-[#6f6f6a]"}`} aria-hidden="true" />
                    <span className="text-[13px] leading-none whitespace-nowrap">{entry.short}</span>
                  </>
                )
                if (entry.children) {
                  return (
                    <button
                      key={entry.label}
                      ref={(el) => {
                        if (el) railButtons.current.set(entry.label, el)
                      }}
                      type="button"
                      title={`${entry.label} (Alt+${n})`}
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                      aria-controls={isOpen ? "work-nav-panel" : undefined}
                      aria-current={entry === activeEntry ? "page" : undefined}
                      onClick={() => setOpen(isOpen ? null : entry)}
                      className={itemClass(highlight)}
                    >
                      {inner}
                      <ChevronRight className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9b9b95]" aria-hidden="true" />
                    </button>
                  )
                }
                return (
                  <Link
                    key={entry.label}
                    href={entry.href!}
                    prefetch={false}
                    title={entry.label}
                    aria-current={entry === activeEntry ? "page" : undefined}
                    onClick={() => setOpen(null)}
                    className={itemClass(highlight)}
                  >
                    {inner}
                  </Link>
                )
              })}
            </Fragment>
          ))}
        </div>
      </nav>

      {open?.children && (
        <nav
          id="work-nav-panel"
          data-panel
          aria-label={`${open.label} 세부 메뉴`}
          className="fixed left-[92px] top-0 bottom-0 z-50 w-[260px] max-w-[calc(100vw-92px)] bg-white border-r border-[#d1d1cc] shadow-[6px_0_18px_rgb(0_0_0/0.10)] flex flex-col"
        >
          <div className="h-[52px] shrink-0 flex items-center justify-between pl-4 pr-2 border-b border-[#e3e3de]">
            <span className="text-[16px] font-bold text-[#0a0a0a]">{open.label}</span>
            <button
              type="button"
              aria-label="메뉴 닫기"
              onClick={() => setOpen(null)}
              className="w-7 h-7 flex items-center justify-center rounded text-[#6f6f6a] hover:bg-[#f2f2ef]"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {open.children.map((child) => {
              const active = !!hrefScore(child.href, path, search) && activeEntry === open && bestIs(open, child.href, path, search)
              return (
                <Link
                  key={child.label}
                  href={child.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(null)}
                  className={`flex items-center px-5 h-[42px] text-[15px] ${
                    active ? "font-semibold text-[#0062ff] bg-[#e8f0ff]" : "text-[#222220] hover:bg-[#f2f2ef] hover:text-[#0a0a0a]"
                  }`}
                >
                  <span className="truncate">{child.label}</span>
                </Link>
              )
            })}

            {open.extras?.includes("pins") && (
              <Section title="고정한 치과">
                {pins.filter((p) => p.kind === "CLINIC").slice(0, 3).length === 0 ? (
                  <p className="px-5 py-2 text-[13px] text-[#8a8a84]">치과 메뉴에서 별표를 눌러 고정하세요</p>
                ) : (
                  pins
                    .filter((p) => p.kind === "CLINIC")
                    .slice(0, 3)
                    .map((p) => (
                      <ClinicRow
                        key={p.id}
                        clinic={{ id: p.refId, name: clinicName.get(p.refId) ?? p.label }}
                        pinned
                        onToggle={() => toggle("CLINIC", p.refId, p.label)}
                        onGo={() => setOpen(null)}
                      />
                    ))
                )}
              </Section>
            )}

            {open.extras?.includes("clinics") && (
              <ClinicList
                clinics={[INTERNAL, ...clinics]}
                isPinned={(id) => isPinned("CLINIC", id)}
                onToggle={(c) => toggle("CLINIC", c.id, c.name)}
                onGo={() => setOpen(null)}
              />
            )}
            {pinError && <p role="alert" className="px-4 py-1 text-[12px] text-[#d92d20]">{pinError}</p>}

            {open.extras?.includes("recent") && (
              <Section title="최근 본 항목">
                {recent.length === 0 ? (
                  <p className="px-5 py-2 text-[13px] text-[#8a8a84]">아직 없습니다</p>
                ) : (
                  recent.map((r) => (
                    <Link
                      key={r.href}
                      href={r.href}
                      prefetch={false}
                      onClick={() => setOpen(null)}
                      className="flex items-center gap-2.5 px-5 h-[40px] text-[14px] text-[#222220] hover:bg-[#f2f2ef]"
                    >
                      <History className="w-4 h-4 shrink-0 text-[#8a8a84]" aria-hidden="true" />
                      <span className="truncate">{r.label}</span>
                    </Link>
                  ))
                )}
              </Section>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}

/** 같은 패널 안에서 지금 화면에 가장 잘 맞는 하위 메뉴인지(내 업무·전체 업무 둘 다 켜지지 않게) */
function bestIs(entry: WorkNavEntry, href: string, path: string, search: string) {
  let best = "", s = 0
  for (const c of entry.children ?? []) {
    const v = hrefScore(c.href, path, search)
    if (v > s) (s = v), (best = c.href)
  }
  return best === href
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 pt-3 border-t border-[#ecece9]">
      <div className="px-5 pb-1.5 text-[12px] font-semibold text-[#6f6f6a]">{title}</div>
      {children}
    </div>
  )
}

/** 치과 한 줄: 이름(→ 업무 보드) · 월 현황 · 별표 */
function ClinicRow({ clinic, pinned, onToggle, onGo }: { clinic: Clinic; pinned: boolean; onToggle: () => void; onGo: () => void }) {
  const month = kstMonth()
  return (
    <div className="group flex items-center h-[40px] pl-5 pr-2 hover:bg-[#f2f2ef]">
      <Link href={`/work/board?scope=${clinic.id}`} prefetch={false} onClick={onGo} className="flex-1 min-w-0 truncate text-[14px] text-[#222220]" title={`${clinic.name} 업무 보드`}>
        {clinic.name}
      </Link>
      {clinic.id !== "internal" && (
        <Link
          href={`/work/clinics/${clinic.id}/${month}`}
          prefetch={false}
          onClick={onGo}
          className="shrink-0 px-2 text-[12px] text-[#8a8a84] hover:text-[#0062ff]"
          aria-label={`${clinic.name} ${month.slice(5)}월 현황`}
        >
          현황
        </Link>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={pinned}
        aria-label={pinned ? `${clinic.name} 고정 풀기` : `${clinic.name} 고정`}
        title={pinned ? "고정 풀기" : "고정"}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-[#e9e9e5]"
      >
        <Star className={`w-4 h-4 ${pinned ? "fill-[#0062ff] text-[#0062ff]" : "text-[#b9b9b3]"}`} aria-hidden="true" />
      </button>
    </div>
  )
}

/** 치과 목록(많으면 이름으로 거르기) */
function ClinicList({ clinics, isPinned, onToggle, onGo }: { clinics: Clinic[]; isPinned: (id: string) => boolean; onToggle: (c: Clinic) => void; onGo: () => void }) {
  const [q, setQ] = useState("")
  const shown = q ? clinics.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : clinics
  return (
    <Section title={`치과 ${clinics.length - 1}곳`}>
      {clinics.length > 8 && (
        <label className="mx-3 mb-1 flex items-center gap-1.5 h-[30px] px-2 border border-[#d1d1cc] rounded text-[12px]">
          <Search className="w-3.5 h-3.5 text-[#8a8a84]" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="치과 이름" aria-label="치과 이름으로 거르기" className="flex-1 min-w-0 outline-none bg-transparent" />
        </label>
      )}
      {shown.map((c) => (
        <ClinicRow key={c.id} clinic={c} pinned={isPinned(c.id)} onToggle={() => onToggle(c)} onGo={onGo} />
      ))}
      {!shown.length && <p className="px-4 py-1.5 text-[12px] text-[#8a8a84]">맞는 치과가 없습니다</p>}
    </Section>
  )
}
