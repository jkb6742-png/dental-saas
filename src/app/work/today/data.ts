import { prisma } from "@/lib/db"
import type { WorkActor } from "@/lib/work/actor"
import { monthQuota, type QuotaRow } from "@/lib/work/contracts"
import { kstToday, dateOnly, KST_MS, monthRange } from "@/lib/work/common"

// 홈(/work/today) 서버 데이터. 화면은 45초마다 새로 그리므로 무거운 계약 진행률은 5분 캐시한다.

export const OPEN = ["TODO", "BLOCKED", "IN_PROGRESS", "IN_REVIEW"] as const
const WEEK = ["일", "월", "화", "수", "목", "금", "토"]

export const addDays = (ymd: string, n: number) => new Date(new Date(`${ymd}T00:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10)
export const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)
export const hm = (d: Date | null | undefined) => (d ? new Date(d.getTime() + KST_MS).toISOString().slice(11, 16) : "")
const kstYmd = (d: Date) => new Date(d.getTime() + KST_MS).toISOString().slice(0, 10)
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400_000)

/** 11.18(수) */
export const shortDay = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()}(${WEEK[d.getUTCDay()]})`
}
/** 오늘 / 내일 / 11.18(수) / 2일 지연 */
export function dueLabel(due: string | null, today: string): { text: string; late: boolean } {
  if (!due) return { text: "마감 없음", late: false }
  const diff = dayDiff(due, today)
  if (diff < 0) return { text: `${-diff}일 지연`, late: true }
  if (diff === 0) return { text: "오늘", late: false }
  if (diff === 1) return { text: "내일", late: false }
  return { text: shortDay(due), late: false }
}
export const longDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEK[d.getUTCDay()]}요일`
}
export const weekdayOf = (s: string) => new Date(`${s}T00:00:00Z`).getUTCDay()

/** 이번 달 경과 비율(오늘 포함) */
export function monthElapsed(today: string) {
  const { start, next } = monthRange(today.slice(0, 7))
  const days = Math.round((next.getTime() - start.getTime()) / 86400_000)
  return Number(today.slice(8, 10)) / days
}

// ── 계약 진행률(5분 캐시) ──
export type ClinicProgress = { id: string; name: string; target: number; done: number; q: QuotaRow[] }
const quotaCache = new Map<string, { at: number; rows: QuotaRow[] }>()
const TTL = 5 * 60_000

async function cachedQuota(clinicId: string, month: string) {
  const key = `${clinicId}:${month}`
  const hit = quotaCache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.rows
  const rows = await monthQuota(clinicId, month).catch(() => [] as QuotaRow[])
  quotaCache.set(key, { at: Date.now(), rows })
  return rows
}

export async function clinicProgress(clinics: { id: string; name: string }[], month: string): Promise<ClinicProgress[]> {
  return Promise.all(
    clinics.slice(0, 40).map(async (c) => {
      const q = await cachedQuota(c.id, month)
      return {
        id: c.id,
        name: c.name,
        q,
        target: q.reduce((s, x) => s + x.target, 0),
        done: q.reduce((s, x) => s + Math.min(x.done, x.target), 0),
      }
    })
  )
}
export const isBehind = (p: ClinicProgress, elapsed: number) => p.target > 0 && p.done / p.target + 0.15 < elapsed

// ── 직원 홈 ──
export type HomeTask = {
  id: string
  title: string
  status: string
  high: boolean
  due: string | null
  where: string
  reviewRequired: boolean
  bucket: "overdue" | "today" | "week"
}

export async function loadStaffHome(actor: WorkActor) {
  const today = kstToday()
  const weekEnd = addDays(today, 7)
  const clinicIds = actor.clinics.map((c) => c.id)
  const reqScope = actor.isMaster ? {} : { clinicId: { in: clinicIds } }
  const weekStart = addDays(today, -6)

  const [myTasks, tasksEver, eventsEver, requests, doneRecent, dueRecent] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeUserId: actor.id, status: { in: [...OPEN] } },
      select: {
        id: true, title: true, status: true, priority: true, dueOn: true, reviewRequired: true,
        clinic: { select: { name: true } }, group: { select: { name: true } },
      },
      orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }, { priority: "desc" }, { createdAt: "asc" }],
      take: 300,
    }),
    prisma.task.count({ where: { assigneeUserId: actor.id } }),
    prisma.calendarEvent.count({ where: { organizerUserId: actor.id } }),
    prisma.serviceRequest.findMany({
      where: {
        ...reqScope,
        status: { in: ["REQUESTED", "IN_REVIEW", "IN_PROGRESS"] },
        OR: [{ task: { assigneeUserId: actor.id } }, { assignee: actor.name }],
      },
      select: { id: true, title: true, status: true, createdAt: true, dueDate: true, clinicId: true, clinic: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 6,
    }),
    prisma.task.findMany({
      where: { assigneeUserId: actor.id, status: "DONE", completedAt: { gte: new Date(dateOnly(weekStart).getTime() - KST_MS) } },
      select: { completedAt: true },
      take: 1000,
    }),
    prisma.task.findMany({
      where: { assigneeUserId: actor.id, status: { not: "CANCELLED" }, dueOn: { gte: dateOnly(weekStart), lte: dateOnly(today) } },
      select: { dueOn: true },
      take: 1000,
    }),
  ])

  const tasks: HomeTask[] = []
  let overdue = 0
  let dueToday = 0
  let later = 0
  let inReview = 0
  for (const t of myTasks) {
    if (t.status === "IN_REVIEW") inReview++
    const due = ymd(t.dueOn)
    const bucket = !due ? null : due < today ? "overdue" : due === today ? "today" : due < weekEnd ? "week" : null
    if (bucket === "overdue") overdue++
    if (bucket === "today") dueToday++
    if (!bucket) {
      later++
      continue
    }
    tasks.push({
      id: t.id,
      title: t.title,
      status: t.status,
      high: t.priority === "HIGH",
      due,
      where: [t.clinic?.name ?? "사내", t.group?.name].filter(Boolean).join(" · "),
      reviewRequired: t.reviewRequired,
      bucket,
    })
  }

  // 최근 7일: 날마다 완료 수 vs 그날 마감이던 업무 수
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i)
    return {
      day,
      label: i === 6 ? "오늘" : shortDay(day).replace(/^\d+\./, ""),
      done: doneRecent.filter((t) => t.completedAt && kstYmd(t.completedAt) === day).length,
      due: dueRecent.filter((t) => ymd(t.dueOn) === day).length,
    }
  })

  return {
    tasks,
    counts: { overdue, dueToday, inReview, later, open: myTasks.length },
    firstUse: tasksEver === 0,
    guide: { clinics: actor.clinics.length > 0, task: tasksEver > 0, event: eventsEver > 0 },
    requests: requests.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      clinicId: r.clinicId,
      clinicName: r.clinic.name,
      created: kstYmd(r.createdAt),
      due: r.dueDate ? kstYmd(r.dueDate) : null,
    })),
    week,
  }
}

// ── 대표 홈 ──
export type OpsIssue = {
  key: string
  clinic: string
  problem: string
  owner: string
  due: { text: string; late: boolean }
  action: { label: string; href: string }
  score: number
}

export async function loadMasterHome(actor: WorkActor) {
  const today = kstToday()
  const todayDate = dateOnly(today)
  const month = today.slice(0, 7)
  const elapsed = monthElapsed(today)
  const twoDaysAgo = new Date(Date.now() - 2 * 86400_000)
  const heatEnd = addDays(today, 14)
  const monthStartUtc = new Date(monthRange(month).start.getTime() - KST_MS)

  const [
    lateTasks, lateCount, unassignedTasks, unassignedCount, oldRequests, bills, access,
    pendingLeave, missed, staff, att, leavesToday, statusGroups, doneThisMonth, heat,
  ] = await Promise.all([
    prisma.task.findMany({
      where: { status: { in: [...OPEN] }, dueOn: { lt: todayDate } },
      select: { clinicId: true, clinic: { select: { name: true } }, dueOn: true, assignee: { select: { user: { select: { name: true } } } } },
      take: 1000,
    }),
    prisma.task.count({ where: { status: { in: [...OPEN] }, dueOn: { lt: todayDate } } }),
    prisma.task.findMany({
      where: { status: { in: [...OPEN] }, assigneeUserId: null },
      select: { clinicId: true, clinic: { select: { name: true } }, dueOn: true },
      take: 1000,
    }),
    prisma.task.count({ where: { status: { in: [...OPEN] }, assigneeUserId: null } }),
    prisma.serviceRequest.findMany({
      where: { status: { in: ["REQUESTED", "IN_REVIEW", "IN_PROGRESS"] }, createdAt: { lt: twoDaysAgo } },
      select: {
        clinicId: true, clinic: { select: { name: true } }, createdAt: true, dueDate: true, assignee: true,
        task: { select: { assignee: { select: { user: { select: { name: true } } } } } },
      },
      take: 500,
    }),
    prisma.billingCycle.findMany({
      where: { voidedAt: null, dueOn: { lte: todayDate } },
      select: { id: true, clinicId: true, clinic: { select: { name: true } }, dueOn: true, amountDueKrw: true, receipts: { select: { amountKrw: true } } },
      take: 500,
    }),
    prisma.staffClinicAccess.findMany({ select: { clinicId: true, employee: { select: { leftOn: true, user: { select: { name: true } } } } } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.remoteCheck.count({ where: { status: "MISSED", workDate: { gte: dateOnly(addDays(today, -7)) } } }),
    prisma.employee.findMany({
      where: { OR: [{ leftOn: null }, { leftOn: { gt: todayDate } }], hiredOn: { lte: todayDate } },
      select: { userId: true, workMode: true, workStart: true, workWeekdays: true, user: { select: { name: true, role: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.attendanceRecord.findMany({ where: { workDate: todayDate }, select: { employeeUserId: true, clockInAt: true, clockOutAt: true } }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startOn: { lte: todayDate }, endOn: { gte: todayDate } },
      select: { employeeUserId: true, unit: true },
    }),
    prisma.task.groupBy({ by: ["status"], where: { status: { in: [...OPEN] } }, _count: { _all: true } }),
    prisma.task.count({ where: { status: "DONE", completedAt: { gte: monthStartUtc } } }),
    prisma.task.groupBy({
      by: ["assigneeUserId", "dueOn"],
      where: { status: { in: [...OPEN] }, assigneeUserId: { not: null }, dueOn: { gte: todayDate, lt: dateOnly(heatEnd) } },
      _count: { _all: true },
    }),
  ])

  const progress = await clinicProgress(actor.clinics, month)
  const behind = progress.filter((p) => isBehind(p, elapsed))

  // 치과별 담당 직원 이름
  const ownersOf = new Map<string, string[]>()
  for (const a of access) {
    if (a.employee.leftOn && ymd(a.employee.leftOn)! <= today) continue
    ownersOf.set(a.clinicId, [...(ownersOf.get(a.clinicId) ?? []), a.employee.user.name])
  }
  const ownerText = (clinicId: string | null) => {
    if (!clinicId) return "사내"
    const n = ownersOf.get(clinicId) ?? []
    return n.length === 0 ? "배정 없음" : n.length > 2 ? `${n.slice(0, 2).join(", ")} 외 ${n.length - 2}` : n.join(", ")
  }

  const issues: OpsIssue[] = []
  // 1) 치과별 지연 업무
  const lateBy = new Map<string, { name: string; clinicId: string | null; n: number; oldest: string; owners: Set<string> }>()
  for (const t of lateTasks) {
    const k = t.clinicId ?? "_"
    const g = lateBy.get(k) ?? { name: t.clinic?.name ?? "사내", clinicId: t.clinicId, n: 0, oldest: ymd(t.dueOn)!, owners: new Set<string>() }
    g.n++
    if (ymd(t.dueOn)! < g.oldest) g.oldest = ymd(t.dueOn)!
    g.owners.add(t.assignee?.user.name ?? "미배정")
    lateBy.set(k, g)
  }
  for (const [k, g] of lateBy) {
    const owners = [...g.owners]
    issues.push({
      key: `late-${k}`,
      clinic: g.name,
      problem: `마감 지난 업무 ${g.n}건`,
      owner: owners.length > 2 ? `${owners.slice(0, 2).join(", ")} 외 ${owners.length - 2}` : owners.join(", "),
      due: dueLabel(g.oldest, today),
      action: { label: "업무 보기", href: `/work/tasks?due=overdue${g.clinicId ? `&clinicId=${g.clinicId}` : ""}` },
      score: 300 + g.n * 10 + Math.min(60, -dayDiff(g.oldest, today)),
    })
  }
  // 2) 미입금
  for (const b of bills) {
    const paid = b.receipts.reduce((s, r) => s + r.amountKrw, 0)
    const left = b.amountDueKrw - paid
    if (left <= 0) continue
    const d = ymd(b.dueOn)!
    if (d >= today) continue
    issues.push({
      key: `bill-${b.id}`,
      clinic: b.clinic.name,
      problem: `미입금 ${left.toLocaleString("ko-KR")}원`,
      owner: "대표",
      due: dueLabel(d, today),
      action: { label: "입금 확인", href: "/work/billing" },
      score: 280 + Math.min(60, -dayDiff(d, today)),
    })
  }
  // 3) 2일 넘은 원장 요청
  const reqBy = new Map<string, { name: string; n: number; oldest: string; owners: Set<string> }>()
  for (const r of oldRequests) {
    const g = reqBy.get(r.clinicId) ?? { name: r.clinic.name, n: 0, oldest: kstYmd(r.createdAt), owners: new Set<string>() }
    g.n++
    if (kstYmd(r.createdAt) < g.oldest) g.oldest = kstYmd(r.createdAt)
    const who = r.task?.assignee?.user.name ?? r.assignee
    if (who) g.owners.add(who)
    reqBy.set(r.clinicId, g)
  }
  for (const [clinicId, g] of reqBy) {
    const owners = [...g.owners]
    issues.push({
      key: `req-${clinicId}`,
      clinic: g.name,
      problem: `원장 요청 ${g.n}건 ${-dayDiff(g.oldest, today)}일째 처리 중`,
      owner: owners.length ? owners.slice(0, 2).join(", ") : "미배정",
      due: { text: `${shortDay(g.oldest)} 접수`, late: false },
      action: { label: "요청 보기", href: `/dashboard/${clinicId}/requests` },
      score: 250 + g.n * 5 + Math.min(30, -dayDiff(g.oldest, today)),
    })
  }
  // 4) 계약 진행 부족
  const monthEnd = addDays(monthRange(month).next.toISOString().slice(0, 10), -1)
  for (const p of behind) {
    const expected = Math.round(p.target * elapsed)
    issues.push({
      key: `quota-${p.id}`,
      clinic: p.name,
      problem: `계약 진행 ${p.done}/${p.target} (오늘 기준 ${expected}건 기대)`,
      owner: ownerText(p.id),
      due: { text: `${shortDay(monthEnd)}까지`, late: false },
      action: { label: "월 현황", href: `/work/clinics/${p.id}/${month}` },
      score: 200 + Math.round((elapsed - p.done / p.target) * 100),
    })
  }
  // 5) 담당자 없는 업무
  const unBy = new Map<string, { name: string; clinicId: string | null; n: number; first: string | null }>()
  for (const t of unassignedTasks) {
    const k = t.clinicId ?? "_"
    const g = unBy.get(k) ?? { name: t.clinic?.name ?? "사내", clinicId: t.clinicId, n: 0, first: null }
    g.n++
    const d = ymd(t.dueOn)
    if (d && (!g.first || d < g.first)) g.first = d
    unBy.set(k, g)
  }
  for (const [k, g] of unBy) {
    issues.push({
      key: `un-${k}`,
      clinic: g.name,
      problem: `담당자 없는 업무 ${g.n}건`,
      owner: ownerText(g.clinicId),
      due: g.first ? dueLabel(g.first, today) : { text: "마감 없음", late: false },
      action: { label: "배정", href: `/work/tasks?assignee=none${g.clinicId ? `&clinicId=${g.clinicId}` : ""}` },
      score: 150 + g.n * 3 + (g.first && g.first <= today ? 50 : 0),
    })
  }
  issues.sort((a, b) => b.score - a.score)

  // 미입금 합계 / 입금 확인 대기(오늘까지 예정)
  let unpaid = 0
  let paymentWaiting = 0
  for (const b of bills) {
    const left = b.amountDueKrw - b.receipts.reduce((s, r) => s + r.amountKrw, 0)
    if (left <= 0) continue
    paymentWaiting++
    if (ymd(b.dueOn)! < today) unpaid += left
  }

  // 오늘 근무
  const dow = weekdayOf(today) || 7
  const leaveOf = new Map(leavesToday.map((l) => [l.employeeUserId, l.unit]))
  const roster = staff
    .filter((s) => s.user.role === "STAFF" && s.workWeekdays.includes(dow))
    .map((s) => {
      const a = att.find((x) => x.employeeUserId === s.userId)
      const unit = leaveOf.get(s.userId)
      const state: "IN" | "OUT" | "LEAVE" | "ABSENT" = unit === "FULL" ? "LEAVE" : a?.clockOutAt ? "OUT" : a?.clockInAt ? "IN" : unit ? "LEAVE" : "ABSENT"
      return {
        id: s.userId,
        name: s.user.name,
        remote: s.workMode === "REMOTE",
        state,
        time: state === "OUT" ? hm(a?.clockOutAt) : state === "IN" ? hm(a?.clockInAt) : "",
        late: !!a?.clockInAt && hm(a.clockInAt) > s.workStart,
        leaveLabel: unit === "HALF_AM" ? "오전 반차" : unit === "HALF_PM" ? "오후 반차" : "연차",
      }
    })

  // 상태 분포
  const statusCount = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])) as Record<string, number>

  // 히트맵: 행 = 재직 직원, 열 = 오늘부터 14일
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i))
  const heatMap = new Map<string, number>()
  for (const h of heat) heatMap.set(`${h.assigneeUserId}:${ymd(h.dueOn)}`, h._count._all)
  const heatRows = staff
    .filter((s) => s.user.role === "STAFF" || heat.some((h) => h.assigneeUserId === s.userId))
    .map((s) => ({ id: s.userId, name: s.user.name, cells: days.map((d) => heatMap.get(`${s.userId}:${d}`) ?? 0) }))

  return {
    counts: { late: lateCount, unassigned: unassignedCount, behind: behind.length, unpaid },
    issues: issues.slice(0, 5),
    issueTotal: issues.length,
    approvals: { leave: pendingLeave, payment: paymentWaiting, missed },
    roster,
    progress,
    elapsed,
    status: {
      TODO: statusCount.TODO ?? 0,
      BLOCKED: statusCount.BLOCKED ?? 0,
      IN_PROGRESS: statusCount.IN_PROGRESS ?? 0,
      IN_REVIEW: statusCount.IN_REVIEW ?? 0,
      DONE: doneThisMonth,
    },
    heat: { days, rows: heatRows },
  }
}
