"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, CornerDownLeft, ListChecks, Building2, FileText, CalendarDays, ArrowRight, History, Plus } from "lucide-react"
import type { WorkNavEntry } from "../nav"
import { usePopover, useRecent, rememberRecent } from "./store"

type Item = { id: string; title: string; sub?: string; href?: string; run?: () => void }
type Group = { key: string; label: string; items: Item[] }

const ICON: Record<string, typeof Search> = { tasks: ListChecks, clinics: Building2, files: FileText, events: CalendarDays, pages: ArrowRight, recent: History, actions: Plus }

// 통합 검색(Ctrl+K / ⌘K): 업무·치과·파일·일정 + 메뉴 이동. ↑↓ 고르기, Enter 이동, Esc 닫기.
export default function CommandPalette({ groups: nav }: { groups: WorkNavEntry[][] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [remote, setRemote] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const recent = useRecent()
  usePopover(box, open, () => setOpen(false))

  // Ctrl+K / ⌘K 로 열고 닫기. 다른 화면에서도 work:search 이벤트로 열 수 있다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener("work:search", onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("work:search", onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setQ("")
      setRemote([])
    }
  }, [open])

  // 입력 후 0.2초 쉬면 서버 검색
  useEffect(() => {
    const term = q.trim()
    if (!open || !term) {
      setRemote([])
      setLoading(false)
      return
    }
    const ctl = new AbortController()
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/work/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { groups: [] }))
        .then((j) => setRemote(j.groups ?? []))
        .catch(() => {})
        .finally(() => !ctl.signal.aborted && setLoading(false))
    }, 200)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
  }, [q, open])

  // 메뉴 이동 명령(권한에 맞게 받은 메뉴 그대로)
  const pages = useMemo<Item[]>(
    () => nav.flat().flatMap((e) => (e.children ?? []).map((c) => ({ id: c.href, title: c.label, sub: e.label, href: c.href }))).concat([{ id: "/work/settings", title: "알림 설정", sub: "내 설정", href: "/work/settings" }]),
    [nav]
  )
  const quick = (kind: "task" | "event" | "memo") => () => window.dispatchEvent(new CustomEvent("work:quick-add", { detail: { kind } }))
  const actions: Item[] = [
    { id: "qa-task", title: "새 업무 추가", sub: "Alt+N", run: quick("task") },
    { id: "qa-event", title: "새 일정 추가", run: quick("event") },
    { id: "qa-memo", title: "메모 쓰기", run: quick("memo") },
  ]

  const shown = useMemo<Group[]>(() => {
    const term = q.trim().toLowerCase()
    if (!term)
      return [
        { key: "recent", label: "최근 본 항목", items: recent.map((r) => ({ id: r.href, title: r.label, href: r.href })) },
        { key: "actions", label: "빠른 추가", items: actions },
      ].filter((g) => g.items.length)
    const hit = (s: string) => s.toLowerCase().includes(term)
    return [
      ...remote.map((g) => ({ ...g, items: g.items as Item[] })),
      { key: "pages", label: "메뉴 이동", items: pages.filter((p) => hit(p.title) || hit(p.sub ?? "")).slice(0, 6) },
      { key: "actions", label: "빠른 추가", items: actions.filter((a) => hit(a.title)) },
    ].filter((g) => g.items.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, remote, recent, pages])

  const flat = shown.flatMap((g) => g.items.map((it) => ({ ...it, group: g.key })))
  useEffect(() => setActive(0), [q, remote])
  useEffect(() => {
    list.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  const choose = (it: (typeof flat)[number] | undefined) => {
    if (!it) return
    setOpen(false)
    if (it.run) return it.run()
    if (!it.href) return
    if (it.group === "tasks") rememberRecent(it.href, it.title)
    router.push(it.href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => (flat.length ? (a + 1) % flat.length : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => (flat.length ? (a - 1 + flat.length) % flat.length : 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      choose(flat[active])
    }
  }

  let idx = -1
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="통합 검색 (Ctrl+K)"
        className="h-8 w-full max-w-[360px] flex items-center gap-2 px-2.5 rounded border border-[#d1d1cc] bg-white text-[12px] text-[#8a8a84] hover:border-[#b9b9b3]"
      >
        <Search className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline truncate">업무·치과·파일·일정 검색</span>
        <kbd className="ml-auto hidden md:inline text-[11px] font-sans text-[#8a8a84] border border-[#e3e3de] rounded px-1">Ctrl+K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/20 flex items-start justify-center pt-[10vh] px-4">
          <div ref={box} role="dialog" aria-modal="true" aria-label="통합 검색" className="w-full max-w-[600px] bg-white border border-[#d1d1cc] rounded shadow-[0_12px_32px_rgb(0_0_0/0.18)] overflow-hidden">
            <div className="flex items-center gap-2 px-3 h-[48px] border-b border-[#e3e3de]">
              <Search className="w-4 h-4 text-[#6f6f6a]" aria-hidden="true" />
              <input
                data-autofocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="업무·치과·파일·일정·메뉴 검색"
                aria-label="검색어"
                role="combobox"
                aria-expanded="true"
                aria-controls="work-search-list"
                aria-activedescendant={flat[active] ? `ws-${active}` : undefined}
                className="flex-1 min-w-0 text-[15px] outline-none"
              />
              {loading && <span className="text-[12px] text-[#8a8a84]">찾는 중</span>}
              <kbd className="text-[11px] text-[#8a8a84] border border-[#e3e3de] rounded px-1">Esc</kbd>
            </div>
            <ul id="work-search-list" ref={list} role="listbox" aria-label="검색 결과" className="max-h-[60vh] overflow-y-auto py-1">
              {shown.map((g) => {
                const Icon = ICON[g.key] ?? ArrowRight
                return (
                  <li key={g.key} role="presentation">
                    <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-[#6f6f6a]">{g.label}</div>
                    <ul role="group" aria-label={g.label}>
                      {g.items.map((it) => {
                        idx++
                        const i = idx
                        const on = i === active
                        return (
                          <li
                            key={`${g.key}:${it.id}`}
                            id={`ws-${i}`}
                            data-idx={i}
                            role="option"
                            aria-selected={on}
                            onMouseMove={() => setActive(i)}
                            onClick={() => choose(flat[i])}
                            className={`flex items-center gap-2.5 px-3 h-[38px] cursor-pointer ${on ? "bg-[#e8f0ff]" : ""}`}
                          >
                            <Icon className={`w-4 h-4 shrink-0 ${on ? "text-[#0062ff]" : "text-[#8a8a84]"}`} aria-hidden="true" />
                            <span className="truncate text-[14px] text-[#0a0a0a]">{it.title}</span>
                            {it.sub && <span className="truncate text-[12px] text-[#8a8a84]">{it.sub}</span>}
                            {on && <CornerDownLeft className="ml-auto w-3.5 h-3.5 shrink-0 text-[#0062ff]" aria-hidden="true" />}
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )
              })}
              {q.trim() && !loading && !flat.length && <li className="px-3 py-6 text-center text-[13px] text-[#8a8a84]">찾는 결과가 없습니다</li>}
            </ul>
            <div className="flex items-center gap-3 px-3 h-[32px] border-t border-[#e3e3de] text-[11px] text-[#8a8a84]">
              <span>↑↓ 고르기</span>
              <span>Enter 이동</span>
              <span>Esc 닫기</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
