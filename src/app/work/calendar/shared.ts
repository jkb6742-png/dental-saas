import type { CSSProperties } from "react"

export type Clinic = { id: string; name: string }
export type Person = { id: string; name: string }
export type Kind = "TASK" | "EVENT" | "LEAVE" | "PAYMENT"
export type Item = {
  id: string
  kind: Kind
  date: string
  endDate: string
  time: string | null
  title: string
  clinicId: string | null
  clinicName: string | null
  sub: string | null
  status: string
  link: string | null
  userIds?: string[]
  assigneeId?: string | null
  overdue?: boolean
  startAt?: string
  endAt?: string
  endTime?: string | null
  eventType?: string
  location?: string | null
  organizerId?: string
  organizerName?: string | null
  participantNames?: string[]
  notesPreview?: string | null
  taskId?: string | null
  leaveUnit?: string
}
export type View = "month" | "week" | "people"
/** 일정 추가·수정 폼 시작값 */
export type EditInit = { id?: string; date: string; startTime?: string; endTime?: string; allDay?: boolean }

export const RED = "#d92d20"
export const KIND: Record<Kind, { label: string; color: string }> = {
  TASK: { label: "업무", color: "#0062ff" },
  EVENT: { label: "미팅", color: "#7a5af8" },
  LEAVE: { label: "연차", color: "#1a7f37" },
  PAYMENT: { label: "결제", color: "#b54708" },
}
export const EVENT_TYPES: Record<string, string> = {
  CLINIC_MEETING: "치과 미팅",
  SALES_MEETING: "영업 미팅",
  INTERNAL_MEETING: "사내 회의",
  EXTERNAL: "외부 일정",
  OTHER: "기타",
}
export const TASK_STATUS: Record<string, string> = {
  TODO: "할 일",
  BLOCKED: "자료 대기",
  IN_PROGRESS: "진행 중",
  IN_REVIEW: "검토 중",
  DONE: "완료",
}

export const isOverdue = (it: Item) => (it.kind === "TASK" && !!it.overdue) || (it.kind === "PAYMENT" && it.status === "OVERDUE")
export const colorOf = (it: Item) => (isOverdue(it) ? RED : KIND[it.kind].color)
export const isDone = (it: Item) => it.status === "DONE" || it.status === "PAID"
export const isPending = (it: Item) => it.kind === "LEAVE" && it.status === "PENDING"

/** 칩 모양: 연한 바탕 + 같은 색 얇은 선. 승인 대기 연차는 더 연하게 + 점선 */
export function chipStyle(it: Item): CSSProperties {
  const c = colorOf(it)
  if (isPending(it)) return { background: `${c}0a`, border: `1px dashed ${c}99`, color: `${c}cc` }
  if (isDone(it)) return { background: "#f5f5f3", border: "1px solid #e2e2de", color: "#9a9a94" }
  return { background: `${c}12`, border: `1px solid ${c}40`, color: "#191f28" }
}

/** 이 사람이 이 일정을 옮길 수 있는지(업무는 서버가 다시 검사) */
export const canDrag = (it: Item, me: string, isMaster: boolean) =>
  it.kind === "TASK" ? it.status !== "DONE" : it.kind === "EVENT" ? isMaster || it.organizerId === me : false

export const WEEK = ["일", "월", "화", "수", "목", "금", "토"]
export const pad = (n: number) => String(n).padStart(2, "0")
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
export const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
export const addDays = (s: string, n: number) => new Date(new Date(`${s}T00:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10)
export const dowOf = (s: string) => new Date(`${s}T00:00:00Z`).getUTCDay()
export const mondayOf = (s: string) => addDays(s, -((dowOf(s) + 6) % 7))
export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400_000)
/** 11.18(수) */
export const fmtDay = (s: string) => `${Number(s.slice(5, 7))}.${Number(s.slice(8))}(${WEEK[dowOf(s)]})`
/** 오늘 / 내일 / 11.18(수) */
export const relDay = (s: string, today: string) => (s === today ? "오늘" : s === addDays(today, 1) ? "내일" : fmtDay(s))
/** ISO → KST 날짜·시각 */
export const kstParts = (iso: string) => {
  const k = new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString()
  return { date: k.slice(0, 10), time: k.slice(11, 16) }
}

export const field = "h-8 px-2 rounded border border-[#d1d1cc] bg-white text-[14px]"
export const btn = "h-8 px-3 rounded text-[14px] font-medium bg-[#191f28] text-white disabled:opacity-40"

/** 범위 안의 날마다 항목을 펼친다(여러 날 일정은 날마다) */
export function spreadByDay(items: Item[], from: string, toInclusive: string, filter: (it: Item) => boolean) {
  const m = new Map<string, Item[]>()
  for (const it of items) {
    if (!filter(it)) continue
    const start = it.date < from ? from : it.date
    for (let d = start; d <= it.endDate && d <= toInclusive; d = addDays(d, 1)) m.set(d, [...(m.get(d) ?? []), it])
  }
  return m
}

// 끌어 옮기기: 끄는 동안 어떤 항목인지 기억
export const DRAG_MIME = "application/x-work-calendar"
