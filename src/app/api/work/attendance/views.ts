import { prisma } from "@/lib/db"
import { kstToday, dateOnly, ymdOf } from "@/lib/work/common"
import { leaveBalance } from "@/lib/work/leave"
import { buildDays, empSelect, loadPeriod, monthKpi, monthSpan, mondayOf, addDays, weeksOf, weekLevel, WEEK_NORMAL, WEEK_WARN, WEEK_LIMIT } from "./summary"

// 근태 화면 응답 모음. route.ts GET ?summary=me|team 에서 부른다.

const limits = { normal: WEEK_NORMAL, warn: WEEK_WARN, limit: WEEK_LIMIT }

/** 내 근태: 그 달 일자별 표·KPI·주별 합계·연차 이력·추가근무 */
export async function mySummary(userId: string, month: string) {
  const emp = await prisma.employee.findUnique({ where: { userId }, select: { ...empSelect, user: { select: { name: true } } } })
  if (!emp) return { month, userId, employee: null, limits }
  const span = monthSpan(month)
  const p = await loadPeriod([userId], span.from, span.to)
  const all = buildDays(emp, span.from, span.to, p)
  const days = all.filter((d) => d.date >= span.first && d.date < span.nextFirst)
  const year = month.slice(0, 4)
  const [bal, ot, leaves] = await Promise.all([
    leaveBalance(userId),
    prisma.overtimeRecord.findMany({
      where: { employeeUserId: userId, workDate: { gte: dateOnly(span.first), lt: dateOnly(span.nextFirst) } },
      orderBy: [{ workDate: "desc" }, { startAt: "desc" }],
    }),
    prisma.leaveRequest.findMany({
      where: { employeeUserId: userId, startOn: { gte: dateOnly(`${year}-01-01`), lt: dateOnly(`${Number(year) + 1}-01-01`) } },
      orderBy: { startOn: "desc" },
      take: 50,
    }),
  ])
  const kpi = monthKpi(days)
  return {
    month,
    userId,
    limits,
    employee: { name: emp.user.name, workStart: emp.workStart, workEnd: emp.workEnd, workMode: emp.workMode, workWeekdays: emp.workWeekdays },
    days,
    weeks: weeksOf(month, all),
    kpi: {
      ...kpi,
      approvedOtMin: ot.filter((o) => o.status === "APPROVED").reduce((s, o) => s + o.minutes, 0),
      pendingOtMin: ot.filter((o) => o.status === "PENDING").reduce((s, o) => s + o.minutes, 0),
      leaveBalance: bal.balance,
      leavePending: bal.pending,
    },
    overtime: ot,
    leaves: leaves.map((l) => ({ ...l, requestedDays: Number(l.requestedDays) })),
  }
}

/** 팀 근태(대표): 오늘 현황·직원별 월 집계·이번 주 합계·승인 대기·재택 미인증 */
export async function teamSummary(month: string) {
  const today = kstToday()
  const span = monthSpan(month)
  const weekStart = mondayOf(today)
  const weekEnd = addDays(weekStart, 7)
  const emps = await prisma.employee.findMany({
    where: { OR: [{ leftOn: null }, { leftOn: { gte: dateOnly(span.first) } }] },
    select: { ...empSelect, user: { select: { name: true } } },
    orderBy: { hiredOn: "asc" },
  })
  const ids = emps.map((e) => e.userId)
  const [pm, pw, pendingLeave, pendingOvertime, missedChecks, balances] = await Promise.all([
    loadPeriod(ids, span.from, span.to),
    loadPeriod(ids, weekStart, weekEnd),
    prisma.leaveRequest.findMany({ where: { status: "PENDING" }, include: { employee: { select: { user: { select: { name: true } } } } }, orderBy: { startOn: "asc" }, take: 50 }),
    prisma.overtimeRecord.findMany({ where: { status: "PENDING" }, include: { employee: { select: { user: { select: { name: true } } } } }, orderBy: [{ workDate: "asc" }, { startAt: "asc" }], take: 100 }),
    prisma.remoteCheck.findMany({
      where: { status: "MISSED", workDate: { gte: dateOnly(weekStart), lt: dateOnly(weekEnd) } },
      select: { employeeUserId: true, workDate: true, scheduledAt: true, reason: true },
      orderBy: { scheduledAt: "asc" },
    }),
    Promise.all(ids.map(async (id) => [id, await leaveBalance(id)] as const)),
  ])
  const balBy = new Map(balances)
  const nameBy = new Map(emps.map((e) => [e.userId, e.user.name]))

  const snap = { in: 0, leave: 0, missing: 0, risk: 0 }
  const rows = emps.map((e) => {
    const all = buildDays(e, span.from, span.to, pm)
    const days = all.filter((d) => d.date >= span.first && d.date < span.nextFirst)
    const kpi = monthKpi(days)
    const week = buildDays(e, weekStart, weekEnd, pw)
    const weekMin = week.reduce((s, d) => s + d.totalMin, 0)
    const t = week.find((d) => d.isToday)
    const employedNow = !e.leftOn || ymdOf(e.leftOn)! >= today
    if (employedNow && t) {
      if (t.in) snap.in++
      else if (t.status === "LEAVE" || t.status === "TRIP") snap.leave++
      else if (t.workday && t.status !== "EXCLUDED") snap.missing++
    }
    if (employedNow && weekMin >= WEEK_WARN) snap.risk++
    return {
      userId: e.userId,
      name: e.user.name,
      workMode: e.workMode,
      workStart: e.workStart,
      workEnd: e.workEnd,
      left: !employedNow,
      ...kpi,
      leaveBalance: balBy.get(e.userId)?.balance ?? 0,
      weekMin,
      weekLevel: weekLevel(weekMin),
      todayStatus: t?.status ?? null,
      days,
    }
  })

  const missedBy = new Map<string, { userId: string; name: string; count: number; dates: string[] }>()
  for (const c of missedChecks) {
    const cur = missedBy.get(c.employeeUserId) ?? { userId: c.employeeUserId, name: nameBy.get(c.employeeUserId) ?? "", count: 0, dates: [] }
    cur.count++
    const d = ymdOf(c.workDate)!
    if (!cur.dates.includes(d)) cur.dates.push(d)
    missedBy.set(c.employeeUserId, cur)
  }

  return {
    month,
    today,
    limits,
    week: { start: weekStart, end: addDays(weekStart, 6) },
    snapshot: snap,
    rows,
    pendingLeave: pendingLeave.map((l) => ({ id: l.id, name: l.employee.user.name, startOn: l.startOn, endOn: l.endOn, unit: l.unit, requestedDays: Number(l.requestedDays) })),
    pendingOvertime: pendingOvertime.map((o) => ({ ...o, name: o.employee.user.name, employee: undefined })),
    remoteMissed: [...missedBy.values()],
  }
}
