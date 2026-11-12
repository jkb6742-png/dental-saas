"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { BarChart3, Circle, FileText, Flag, Globe, ImageIcon, Megaphone, Users } from "lucide-react"

// 업무 보드 공통: 타입·상수·날짜 표시·작은 부품(아바타·깃발·팝오버)

export type Category = { id: string; name: string; open: number; overdue: number }
export type Quick = { all: number; mine: number; overdue: number }
export type Group = { id: string; name: string; sortOrder: number; clinicId: string | null }
export type Person = { id: string; name: string; clinicIds: string[] | null }
export type Task = {
  id: string
  clinicId: string | null
  groupId: string | null
  sortOrder: number
  title: string
  category: string
  status: string
  priority: string
  startOn: string | null
  dueOn: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  serviceRequestId: string | null
  assigneeUserId: string | null
  reviewRequired: boolean
  quotaSlot: number | null
  monthlyCommitment: { targetCount: number } | null
  clinic: { name: string } | null
  group: { name: string } | null
  assignee: { user: { name: string } } | null
  _count: { comments: number; files: number; checklist: number }
  checklistDone: number
}
export type Board = { groups: Group[]; tasks: Task[]; assignable: Person[] }

export const CROSS_SCOPES = ["all", "mine", "overdue"] as const
export const isCross = (scope: string) => (CROSS_SCOPES as readonly string[]).includes(scope)

export const STATUS: { key: string; label: string; dot: string; text: string }[] = [
  { key: "TODO", label: "할 일", dot: "#8a8a84", text: "#333333" },
  { key: "BLOCKED", label: "자료 대기", dot: "#b54708", text: "#b54708" },
  { key: "IN_PROGRESS", label: "진행", dot: "#0062ff", text: "#0062ff" },
  { key: "IN_REVIEW", label: "검토", dot: "#6941c6", text: "#6941c6" },
  { key: "DONE", label: "완료", dot: "#1a7f37", text: "#1a7f37" },
  { key: "CANCELLED", label: "취소", dot: "#c4c4be", text: "#8a8a84" },
]
export const statusOf = (k: string) => STATUS.find((s) => s.key === k) ?? STATUS[0]
export const PRIORITY: { key: string; label: string; color: string }[] = [
  { key: "HIGH", label: "긴급", color: "#d92d20" },
  { key: "NORMAL", label: "보통", color: "#8a8a84" },
  { key: "LOW", label: "낮음", color: "#c4c4be" },
]
export const PRIORITY_RANK: Record<string, number> = { HIGH: 0, NORMAL: 1, LOW: 2 }
export const KIND: { key: string; label: string; Icon: typeof FileText }[] = [
  { key: "BLOG", label: "블로그", Icon: FileText },
  { key: "IMAGE", label: "이미지", Icon: ImageIcon },
  { key: "WEBSITE", label: "홈페이지", Icon: Globe },
  { key: "REPORT", label: "보고서", Icon: BarChart3 },
  { key: "ADS", label: "광고", Icon: Megaphone },
  { key: "MEETING", label: "미팅", Icon: Users },
  { key: "OTHER", label: "기타", Icon: Circle },
]
export const kindOf = (k: string) => KIND.find((x) => x.key === k) ?? KIND[KIND.length - 1]

export const isOpen = (t: { status: string }) => t.status !== "DONE" && t.status !== "CANCELLED"

// ── 날짜(한국 시간, YYYY-MM-DD 문자열로만 계산) ──
export const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
export const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export const diffDays = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400_000)
const DOW = ["일", "월", "화", "수", "목", "금", "토"]
export const dow = (ymd: string) => DOW[new Date(`${ymd}T00:00:00Z`).getUTCDay()]
/** 이번 주(월~일) */
export function weekRange(today: string) {
  const w = new Date(`${today}T00:00:00Z`).getUTCDay()
  const mon = addDays(today, w === 0 ? -6 : 1 - w)
  return { start: mon, end: addDays(mon, 6) }
}
/** 마감 표시: 오늘 / 내일 / 11.18(수) / 2일 지연(빨강) */
export function dueLabel(t: { dueOn: string | null; status: string }, today: string): { text: string; late: boolean; soon: boolean } | null {
  if (!t.dueOn) return null
  const d = t.dueOn.slice(0, 10)
  const gap = diffDays(d, today)
  if (gap < 0 && isOpen(t)) return { text: `${-gap}일 지연`, late: true, soon: false }
  if (gap === 0) return { text: "오늘", late: false, soon: isOpen(t) }
  if (gap === 1) return { text: "내일", late: false, soon: isOpen(t) }
  const [, m, dd] = d.split("-")
  return { text: `${Number(m)}.${dd}(${dow(d)})`, late: false, soon: false }
}

/** 이 업무에 배정할 수 있는 사람 */
export const canAssign = (p: Person, clinicId: string | null) => clinicId === null || p.clinicIds === null || p.clinicIds.includes(clinicId)

// ── 작은 부품 ──
const AVATAR_BG = ["#dbe7ff", "#e3f4e6", "#fdebd3", "#ece4fb", "#fde2e0", "#e2f1f6"]
export function Avatar({ name, size = 24 }: { name: string | null | undefined; size?: number }) {
  if (!name)
    return (
      <span className="inline-flex items-center justify-center rounded-full border border-dashed border-[#c4c4be] text-[#b0b0aa]" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
        ?
      </span>
    )
  const code = Array.from(name).reduce((s, c) => s + c.charCodeAt(0), 0)
  const initials = /[가-힣]/.test(name) ? name.replace(/\s/g, "").slice(-2) : name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold text-[#333]"
      style={{ width: size, height: size, fontSize: size * 0.4, background: AVATAR_BG[code % AVATAR_BG.length] }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}

export function PriorityFlag({ p, className = "w-3.5 h-3.5" }: { p: string; className?: string }) {
  const pr = PRIORITY.find((x) => x.key === p) ?? PRIORITY[1]
  return <Flag className={className} style={{ color: pr.color }} fill={p === "HIGH" ? pr.color : "none"} aria-hidden="true" />
}

export function StatusDot({ s }: { s: string }) {
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: statusOf(s).dot }} aria-hidden="true" />
}

/**
 * 화면에 하나만 뜨는 팝오버. 기준 요소(anchor) 아래에 고정 위치로 붙고,
 * Esc·바깥 클릭·스크롤로 닫힌다.
 */
export function Popover({ anchor, onClose, children, width = 220, label }: { anchor: DOMRect; onClose: () => void; children: React.ReactNode; width?: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: anchor.bottom + 4, left: anchor.left })
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 200
    const vw = window.innerWidth
    const vh = window.innerHeight
    let top = anchor.bottom + 4
    if (top + h > vh - 8 && anchor.top - h - 4 > 8) top = anchor.top - h - 4
    const left = Math.max(8, Math.min(anchor.left, vw - width - 8))
    setPos({ top, left })
  }, [anchor, width])
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const scroll = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return
      onClose()
    }
    document.addEventListener("keydown", key)
    document.addEventListener("mousedown", down)
    window.addEventListener("scroll", scroll, true)
    window.addEventListener("resize", onClose)
    // 첫 항목에 초점
    const first = ref.current?.querySelector<HTMLElement>("input,button")
    first?.focus()
    return () => {
      document.removeEventListener("keydown", key)
      document.removeEventListener("mousedown", down)
      window.removeEventListener("scroll", scroll, true)
      window.removeEventListener("resize", onClose)
    }
  }, [onClose])
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className="fixed z-[60] bg-white rounded border border-[#d1d1cc] shadow-[0_6px_24px_rgba(0,0,0,0.12)] py-1 max-h-[360px] overflow-y-auto text-[13px]"
      style={{ top: pos.top, left: pos.left, width }}
    >
      {children}
    </div>
  )
}

export function MenuItem({ children, onClick, active, danger, disabled }: { children: React.ReactNode; onClick: () => void; active?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full h-8 px-3 flex items-center gap-2 text-left hover:bg-[#f2f2ef] focus:bg-[#f2f2ef] focus:outline-none disabled:opacity-40 ${active ? "font-semibold text-[#0062ff]" : danger ? "text-[#d92d20]" : "text-[#333]"}`}
    >
      {children}
    </button>
  )
}

/** 날짜 고르기(팝오버 안에서만 date 입력 사용) */
export function DatePick({ value, onPick }: { value: string; onPick: (v: string | null) => void }) {
  const today = kstToday()
  return (
    <div className="px-3 py-2 space-y-2">
      <input type="date" aria-label="마감일" className="w-full h-8 px-2 rounded border border-[#d1d1cc] text-[13px]" defaultValue={value} onChange={(e) => e.target.value && onPick(e.target.value)} />
      <div className="flex flex-wrap gap-1">
        {[
          ["오늘", today],
          ["내일", addDays(today, 1)],
          ["다음 주", addDays(today, 7)],
        ].map(([l, v]) => (
          <button key={l} type="button" className="h-7 px-2 rounded border border-[#d1d1cc] hover:bg-[#f2f2ef]" onClick={() => onPick(v)}>
            {l}
          </button>
        ))}
        <button type="button" className="h-7 px-2 rounded text-[#d92d20] hover:bg-[#fdecea] ml-auto" onClick={() => onPick(null)}>
          지우기
        </button>
      </div>
    </div>
  )
}
