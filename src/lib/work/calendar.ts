import type { CalendarEventType, CalendarVisibility, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { Actor } from "@/lib/requests/access"
import { billingState, BILLING_STATE_LABEL } from "./billing"
import { dayInMonth, shiftMonth } from "./common"

// 통합 달력: 업무 마감 + 미팅·외부 일정 + 연차(승인·대기) + 결제일(대표만)을 한 목록으로 모은다.
// 날짜 칸은 한국 날짜(YYYY-MM-DD) 문자열로 통일한다.

export type CalendarItem = {
  id: string
  kind: "TASK" | "EVENT" | "LEAVE" | "PAYMENT"
  date: string // 시작 날짜(KST)
  endDate: string // 끝 날짜(KST, 하루짜리는 date 와 같음)
  time: string | null // 시작 시각 HH:mm (종일·마감·연차는 null)
  title: string
  clinicId: string | null
  clinicName: string | null
  sub: string | null // 담당자·종류 등 보조 표시
  status: string
  link: string | null
  // 아래는 달력 화면(주간·사람별·상세 패널)용 보조 정보. 다른 화면은 쓰지 않아도 된다.
  userIds?: string[] // 이 항목과 관련된 사람(업무 담당자 / 일정 주최·참석자 / 연차 신청자)
  assigneeId?: string | null // TASK
  overdue?: boolean // TASK: 완료 전인데 마감일이 오늘보다 이전
  startAt?: string // EVENT: ISO
  endAt?: string // EVENT: ISO
  endTime?: string | null // EVENT: 끝 시각 HH:mm (종일은 null)
  eventType?: string // EVENT
  location?: string | null // EVENT
  organizerId?: string // EVENT
  organizerName?: string | null // EVENT
  participantNames?: string[] // EVENT
  notesPreview?: string | null // EVENT: 내부 메모 앞부분
  taskId?: string | null // EVENT: 연결 업무
  leaveUnit?: string // LEAVE: FULL | HALF_AM | HALF_PM
}

const KST = 9 * 3600_000
export const kstDate = (d: Date) => new Date(d.getTime() + KST).toISOString().slice(0, 10)
const kstTime = (d: Date) => new Date(d.getTime() + KST).toISOString().slice(11, 16)
const utcDay = (d: Date) => d.toISOString().slice(0, 10) // @db.Date 칸

export const EVENT_TYPE_LABEL: Record<string, string> = {
  CLINIC_MEETING: "치과 미팅",
  SALES_MEETING: "영업 미팅",
  INTERNAL_MEETING: "사내 회의",
  EXTERNAL: "외부 일정",
  OTHER: "기타",
}

/** 이 사람이 볼 수 있는 일정 조건 */
export function eventScope(actor: Actor): Prisma.CalendarEventWhereInput {
  const mine: Prisma.CalendarEventWhereInput = { OR: [{ organizerUserId: actor.id }, { participants: { some: { userId: actor.id } } }] }
  if (actor.isMaster) return {}
  const clinics = actor.clinicIds ?? []
  return {
    OR: [
      mine,
      { visibility: { not: "PRIVATE" }, clinicId: null },
      { visibility: { not: "PRIVATE" }, clinicId: { in: clinics } },
    ],
  }
}

/** from 이상 to 미만(YYYY-MM-DD, KST) 범위의 달력 항목 */
export async function loadCalendar(actor: Actor, from: string, to: string, clinicId?: string | null): Promise<CalendarItem[]> {
  const fromUtc = new Date(`${from}T00:00:00+09:00`)
  const toUtc = new Date(`${to}T00:00:00+09:00`)
  const fromDay = new Date(`${from}T00:00:00Z`)
  const toDay = new Date(`${to}T00:00:00Z`)
  const clinics = actor.isMaster ? null : actor.clinicIds ?? []
  const clinicFilter = clinicId ? { clinicId } : clinics ? { OR: [{ clinicId: { in: clinics } }, { clinicId: null }] } : {}

  const [tasks, events, leaves] = await Promise.all([
    prisma.task.findMany({
      where: { ...clinicFilter, dueOn: { gte: fromDay, lt: toDay }, status: { not: "CANCELLED" } },
      select: { id: true, title: true, dueOn: true, status: true, clinicId: true, assigneeUserId: true, clinic: { select: { name: true } }, assignee: { select: { user: { select: { name: true } } } } },
    }),
    prisma.calendarEvent.findMany({
      where: {
        AND: [eventScope(actor), clinicId ? { clinicId } : {}],
        status: { not: "CANCELLED" },
        startAt: { lt: toUtc },
        endAt: { gte: fromUtc },
      },
      select: {
        id: true, title: true, type: true, status: true, allDay: true, startAt: true, endAt: true, clinicId: true, location: true, internalNotes: true, taskId: true,
        organizerUserId: true, organizer: { select: { name: true } }, clinic: { select: { name: true } },
        participants: { select: { userId: true, user: { select: { name: true } } } },
      },
    }),
    // 연차는 치과 필터와 무관하게 회사 일정으로 보인다(누가 쉬는지만)
    prisma.leaveRequest.findMany({
      where: { status: { in: ["APPROVED", "PENDING"] }, startOn: { lt: toDay }, endOn: { gte: fromDay } },
      select: { id: true, employeeUserId: true, startOn: true, endOn: true, unit: true, status: true, employee: { select: { user: { select: { name: true } } } } },
    }),
  ])

  const items: CalendarItem[] = []
  const today = kstDate(new Date())
  for (const t of tasks) {
    const day = utcDay(t.dueOn!)
    items.push({
      id: t.id, kind: "TASK", date: day, endDate: day, time: null, title: t.title,
      clinicId: t.clinicId, clinicName: t.clinic?.name ?? "사내", sub: t.assignee?.user.name ?? "미배정",
      status: t.status, link: `/work/tasks?open=${t.id}`,
      userIds: t.assigneeUserId ? [t.assigneeUserId] : [], assigneeId: t.assigneeUserId,
      overdue: t.status !== "DONE" && day < today,
    })
  }
  for (const e of events) {
    const endInclusive = e.allDay ? new Date(e.endAt.getTime() - 1) : e.endAt
    items.push({
      id: e.id, kind: "EVENT", date: kstDate(e.startAt), endDate: kstDate(endInclusive), time: e.allDay ? null : kstTime(e.startAt),
      title: e.title, clinicId: e.clinicId, clinicName: e.clinic?.name ?? null,
      sub: [EVENT_TYPE_LABEL[e.type], e.location].filter(Boolean).join(" · "), status: e.status, link: null,
      userIds: [...new Set([e.organizerUserId, ...e.participants.map((p) => p.userId)])],
      startAt: e.startAt.toISOString(), endAt: e.endAt.toISOString(), endTime: e.allDay ? null : kstTime(e.endAt),
      eventType: e.type, location: e.location, organizerId: e.organizerUserId, organizerName: e.organizer?.name ?? null,
      participantNames: e.participants.map((p) => p.user.name), notesPreview: e.internalNotes ? e.internalNotes.slice(0, 160) : null,
      taskId: e.taskId,
    })
  }
  for (const l of leaves) {
    items.push({
      id: l.id, kind: "LEAVE", date: utcDay(l.startOn), endDate: utcDay(l.endOn), time: null,
      title: `${l.employee.user.name} ${l.unit === "FULL" ? "연차" : l.unit === "HALF_AM" ? "오전 반차" : "오후 반차"}${l.status === "PENDING" ? " (승인 대기)" : ""}`,
      clinicId: null, clinicName: null, sub: l.status === "PENDING" ? "승인 대기" : null, status: l.status, link: "/work/leave",
      userIds: [l.employeeUserId], leaveUnit: l.unit,
    })
  }
  if (actor.isMaster) items.push(...(await loadPayments(from, to, clinicId)))
  return items.sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")))
}

const TYPES = Object.keys(EVENT_TYPE_LABEL) as CalendarEventType[]
const VIS: CalendarVisibility[] = ["PRIVATE", "INTERNAL", "CLINIC"]
const DAY = /^\d{4}-\d{2}-\d{2}$/
const HM = /^\d{2}:\d{2}$/

/** 입력 → 저장값. 실패하면 오류 문자열 */
export function parseEventInput(b: any) {
  const title = String(b?.title ?? "").trim()
  if (!title) return "제목을 입력하세요"
  const type = TYPES.includes(b.type) ? (b.type as CalendarEventType) : "OTHER"
  const visibility = VIS.includes(b.visibility) ? (b.visibility as CalendarVisibility) : "INTERNAL"
  const date = String(b.date ?? "")
  const endDate = String(b.endDate || b.date || "")
  if (!DAY.test(date) || !DAY.test(endDate) || endDate < date) return "날짜를 확인하세요"
  const allDay = !!b.allDay || !b.startTime
  let startAt: Date, endAt: Date
  if (allDay) {
    startAt = new Date(`${date}T00:00:00+09:00`)
    endAt = new Date(new Date(`${endDate}T00:00:00+09:00`).getTime() + 86400_000) // 종일은 다음날 0시까지
  } else {
    const st = String(b.startTime), et = String(b.endTime || b.startTime)
    if (!HM.test(st) || !HM.test(et)) return "시간을 확인하세요"
    startAt = new Date(`${date}T${st}:00+09:00`)
    endAt = new Date(`${endDate}T${et}:00+09:00`)
    if (endAt < startAt) return "끝나는 시간이 시작보다 빠릅니다"
  }
  const clinicId = b.clinicId ? String(b.clinicId) : null
  if (visibility === "CLINIC" && !clinicId) return "원장 공개 일정은 치과를 골라야 합니다"
  const publicTitle = visibility === "CLINIC" ? String(b.publicTitle || title).trim().slice(0, 200) : null
  return {
    title: title.slice(0, 200), type, visibility, allDay, startAt, endAt, clinicId, publicTitle,
    location: b.location ? String(b.location).slice(0, 200) : null,
    internalNotes: b.internalNotes ? String(b.internalNotes).slice(0, 5000) : null,
    participantIds: Array.isArray(b.participantIds) ? b.participantIds.filter((x: unknown) => typeof x === "string").slice(0, 30) : [],
  }
}

const man = (krw: number) => `${(krw / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만원`

/**
 * 결제일(대표만): 청구일·입금 예정일.
 * 이미 만든 청구 행은 실제 상태(입금 완료·연체 등)로, 아직 청구 행이 없는 달은 진행 중 계약의 청구일·입금일로 미리 보여준다.
 */
async function loadPayments(from: string, to: string, clinicId?: string | null): Promise<CalendarItem[]> {
  const fromDay = new Date(`${from}T00:00:00Z`)
  const toDay = new Date(`${to}T00:00:00Z`)
  const inRange = (d: string) => d >= from && d < to
  const clinicWhere = clinicId ? { clinicId } : {}
  const cycles = await prisma.billingCycle.findMany({
    where: { ...clinicWhere, voidedAt: null, OR: [{ dueOn: { gte: fromDay, lt: toDay } }, { plannedBillOn: { gte: fromDay, lt: toDay } }] },
    select: {
      id: true, clinicId: true, contractId: true, serviceMonth: true, plannedBillOn: true, dueOn: true, amountDueKrw: true, billedAt: true, voidedAt: true,
      clinic: { select: { name: true } }, receipts: { select: { amountKrw: true } },
    },
  })
  const items: CalendarItem[] = []
  const have = new Set(cycles.map((c) => `${c.contractId}:${utcDay(c.serviceMonth).slice(0, 7)}`))
  for (const c of cycles) {
    const paid = c.receipts.reduce((s, r) => s + r.amountKrw, 0)
    const state = billingState(c, paid)
    const month = utcDay(c.serviceMonth).slice(0, 7)
    const bill = utcDay(c.plannedBillOn)
    const due = utcDay(c.dueOn)
    if (inRange(bill) && bill !== due)
      items.push({ id: `bill:${c.id}`, kind: "PAYMENT", date: bill, endDate: bill, time: null, title: `${c.clinic.name} 청구 ${man(c.amountDueKrw)}`, clinicId: c.clinicId, clinicName: c.clinic.name, sub: `${month} 분 · ${c.billedAt ? "청구함" : "청구 전"}`, status: c.billedAt ? "BILLED" : "PLANNED", link: "/work/billing" })
    if (inRange(due))
      items.push({ id: `due:${c.id}`, kind: "PAYMENT", date: due, endDate: due, time: null, title: `${c.clinic.name} 입금 ${man(c.amountDueKrw)}`, clinicId: c.clinicId, clinicName: c.clinic.name, sub: `${month} 분 · ${BILLING_STATE_LABEL[state]}`, status: state, link: "/work/billing" })
  }

  // 아직 청구 행이 없는 달: 진행 중 계약으로 예정일 계산(입금이 다음 달인 계약 때문에 한 달 앞부터 본다)
  const contracts = await prisma.clinicContract.findMany({
    where: { ...clinicWhere, status: "ACTIVE", billDayOfMonth: { not: null } }, // 금액 미입력(0원)도 결제일은 보여준다
    select: { id: true, clinicId: true, startsOn: true, endsOn: true, monthlyFeeKrw: true, vatTreatment: true, billDayOfMonth: true, paymentDueDay: true, paymentDueMonthOffset: true, clinic: { select: { name: true } } },
  })
  const lastMonth = to.slice(0, 7)
  for (let m = shiftMonth(from.slice(0, 7), -1); m <= lastMonth; m = shiftMonth(m, 1)) {
    for (const c of contracts) {
      const start = utcDay(c.startsOn).slice(0, 7)
      const end = c.endsOn ? utcDay(c.endsOn).slice(0, 7) : null
      if (m < start || (end && m > end) || have.has(`${c.id}:${m}`)) continue
      const amount = c.vatTreatment === "EXCLUDED" ? Math.round(c.monthlyFeeKrw * 1.1) : c.monthlyFeeKrw
      const bill = utcDay(dayInMonth(m, c.billDayOfMonth!))
      const due = utcDay(dayInMonth(shiftMonth(m, c.paymentDueMonthOffset), c.paymentDueDay ?? c.billDayOfMonth!))
      if (inRange(bill) && bill !== due)
        items.push({ id: `pbill:${c.id}:${m}`, kind: "PAYMENT", date: bill, endDate: bill, time: null, title: `${c.clinic.name} 청구 ${amount ? man(amount) : "(금액 미입력)"}`, clinicId: c.clinicId, clinicName: c.clinic.name, sub: `${m} 분 · 예정`, status: "PLANNED", link: "/work/billing" })
      if (inRange(due))
        items.push({ id: `pdue:${c.id}:${m}`, kind: "PAYMENT", date: due, endDate: due, time: null, title: `${c.clinic.name} 입금 ${amount ? man(amount) : "(금액 미입력)"}`, clinicId: c.clinicId, clinicName: c.clinic.name, sub: `${m} 분 · 예정`, status: "PLANNED", link: "/work/billing" })
    }
  }
  return items
}
