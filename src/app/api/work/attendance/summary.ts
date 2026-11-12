import type { AttendanceClass, LeaveUnit, WorkMode } from "@prisma/client"
import { prisma } from "@/lib/db"
import { kstToday, dateOnly, ymdOf, monthRange } from "@/lib/work/common"

// 근태 집계(서버 전용). 하루 실근무 = 퇴근 − 출근 − 휴게.
// 휴게가 0으로 남아 있으면 4시간 넘게 일한 날은 점심 60분을 뺀다.
// 연장 = 소정 퇴근 시각 이후 근무 + 승인된 추가근무 중 출퇴근 시각 밖에 있는 부분(근무일이 아닌 날은 그날 실근무 전부).
// 주간 합계 = 하루 실근무 합 + 승인된 추가근무 중 출퇴근 시각 밖에 있는 부분. 40시간 정상, 48시간 주의, 52시간 한도.

export const WEEK_NORMAL = 40 * 60
export const WEEK_WARN = 48 * 60
export const WEEK_LIMIT = 52 * 60
const DAY = 86400_000

export const weekdayOf = (ymd: string) => {
  const d = dateOnly(ymd).getUTCDay()
  return d === 0 ? 7 : d
}
export const addDays = (ymd: string, n: number) => ymdOf(new Date(dateOnly(ymd).getTime() + n * DAY))!
export const mondayOf = (ymd: string) => addDays(ymd, -(weekdayOf(ymd) - 1))
const hmToMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}
/** 그 날 한국 자정부터 몇 분 지났는지(다음 날 새벽 퇴근은 1440 이상) */
const minOfDay = (ymd: string, d: Date) => Math.floor((d.getTime() - Date.parse(`${ymd}T00:00:00+09:00`)) / 60000)

export type DayStatus = "NORMAL" | "LATE" | "EARLY" | "LATE_EARLY" | "MISSING" | "LEAVE" | "HALF" | "TRIP" | "ABSENT" | "EXCLUDED" | "WORKING" | "NONE" | "OFF"

export type DayRow = {
  date: string
  wd: number
  workday: boolean
  future: boolean
  isToday: boolean
  in: Date | null
  out: Date | null
  breakMin: number
  workedMin: number
  otMin: number // 승인 추가근무 중 출퇴근 밖
  beyondMin: number // 소정 퇴근 이후 근무
  totalMin: number // workedMin + otMin
  status: DayStatus
  remote: boolean
  leaveUnit: LeaveUnit | null
  leavePending: boolean
  cls: AttendanceClass | null
  source: string | null
  note: string | null
}

export type EmpLite = { userId: string; workStart: string; workEnd: string; workWeekdays: number[]; hiredOn: Date; leftOn: Date | null; workMode: WorkMode }

export const empSelect = { userId: true, workStart: true, workEnd: true, workWeekdays: true, hiredOn: true, leftOn: true, workMode: true } as const

/** 기간 [from, toExcl) 의 출퇴근·연차·추가근무를 한 번에 읽는다 */
export async function loadPeriod(userIds: string[], from: string, toExcl: string) {
  const gte = dateOnly(from)
  const lt = dateOnly(toExcl)
  const [recs, leaves, ots] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { employeeUserId: { in: userIds }, workDate: { gte, lt } } }),
    prisma.leaveRequest.findMany({
      where: { employeeUserId: { in: userIds }, status: { in: ["APPROVED", "PENDING"] }, startOn: { lt }, endOn: { gte } },
      select: { employeeUserId: true, startOn: true, endOn: true, unit: true, status: true },
    }),
    prisma.overtimeRecord.findMany({ where: { employeeUserId: { in: userIds }, workDate: { gte, lt }, status: "APPROVED" } }),
  ])
  return { recs, leaves, ots }
}
export type Period = Awaited<ReturnType<typeof loadPeriod>>

export function buildDays(emp: EmpLite, from: string, toExcl: string, p: Period): DayRow[] {
  const today = kstToday()
  const hired = ymdOf(emp.hiredOn)!
  const left = ymdOf(emp.leftOn)
  const startMin = hmToMin(emp.workStart)
  const endMin = hmToMin(emp.workEnd)
  const recBy = new Map(p.recs.filter((r) => r.employeeUserId === emp.userId).map((r) => [ymdOf(r.workDate)!, r]))
  const leaveBy = new Map<string, { unit: LeaveUnit; pending: boolean }>()
  for (const l of p.leaves) {
    if (l.employeeUserId !== emp.userId) continue
    for (let d = ymdOf(l.startOn)!; d <= ymdOf(l.endOn)!; d = addDays(d, 1)) {
      const cur = leaveBy.get(d)
      if (cur && !cur.pending) continue // 승인이 우선
      leaveBy.set(d, { unit: l.unit, pending: l.status === "PENDING" })
    }
  }
  const otBy = new Map<string, typeof p.ots>()
  for (const o of p.ots) {
    if (o.employeeUserId !== emp.userId) continue
    const k = ymdOf(o.workDate)!
    otBy.set(k, [...(otBy.get(k) ?? []), o])
  }

  const out: DayRow[] = []
  for (let date = from; date < toExcl; date = addDays(date, 1)) {
    const wd = weekdayOf(date)
    const employed = date >= hired && (!left || date <= left)
    const workday = employed && emp.workWeekdays.includes(wd)
    const r = recBy.get(date)
    const lv = leaveBy.get(date)
    const leave = lv && !lv.pending && workday ? lv : null
    const cin = r?.clockInAt ?? null
    const cout = r?.clockOutAt ?? null
    let breakMin = 0
    let workedMin = 0
    if (cin && cout) {
      const span = Math.max(0, Math.round((cout.getTime() - cin.getTime()) / 60000))
      breakMin = r!.breakMinutes || (span > 240 ? 60 : 0)
      workedMin = Math.max(0, span - breakMin)
    }
    let otMin = 0
    for (const o of otBy.get(date) ?? []) {
      let overlap = 0
      if (cin && cout) overlap = Math.max(0, Math.min(o.endAt.getTime(), cout.getTime()) - Math.max(o.startAt.getTime(), cin.getTime())) / 60000
      otMin += Math.max(0, Math.round(o.minutes - overlap))
    }
    let beyondMin = 0
    if (cin && cout) {
      if (!workday) beyondMin = workedMin
      else beyondMin = Math.max(0, minOfDay(date, cout) - Math.max(endMin, minOfDay(date, cin)))
    }

    const future = date > today
    const isToday = date === today
    let status: DayStatus = workday ? "NONE" : "OFF"
    const cls = r?.class ?? null
    if (cls === "PAID_LEAVE" || leave?.unit === "FULL") status = "LEAVE"
    else if (cls === "BUSINESS_TRIP") status = "TRIP"
    else if (cls === "ABSENT") status = "ABSENT"
    else if (cls === "EXCLUDED") status = "EXCLUDED"
    else if (cin && cout) {
      const late = workday && leave?.unit !== "HALF_AM" && minOfDay(date, cin) > startMin
      const early = workday && leave?.unit !== "HALF_PM" && minOfDay(date, cout) < endMin
      status = late && early ? "LATE_EARLY" : late ? "LATE" : early ? "EARLY" : leave ? "HALF" : "NORMAL"
    } else if (cin && !cout) status = isToday ? "WORKING" : workday || !!r ? "MISSING" : "OFF"
    else if (workday && !future && !isToday) status = leave ? "HALF" : "MISSING"
    // 반차인데 기록이 아예 없으면 나머지 반나절이 미기록
    if (status === "HALF" && !cin && !isToday) status = "MISSING"

    out.push({
      date,
      wd,
      workday,
      future,
      isToday,
      in: cin,
      out: cout,
      breakMin,
      workedMin,
      otMin,
      beyondMin,
      totalMin: workedMin + otMin,
      status,
      remote: r?.workMode === "REMOTE",
      leaveUnit: lv && workday ? lv.unit : null,
      leavePending: !!lv?.pending,
      cls,
      source: r?.source ?? null,
      note: r?.note ?? null,
    })
  }
  return out
}

export function monthKpi(days: DayRow[]) {
  let workedMin = 0
  let extraMin = 0
  let late = 0
  let early = 0
  let missing = 0
  let workdays = 0
  let leaveDays = 0
  for (const d of days) {
    workedMin += d.totalMin
    extraMin += d.otMin + d.beyondMin
    if (d.status === "LATE" || d.status === "LATE_EARLY") late++
    if (d.status === "EARLY" || d.status === "LATE_EARLY") early++
    if (d.status === "MISSING") missing++
    if (d.in) workdays++
    if (d.leaveUnit && !d.leavePending) leaveDays += d.leaveUnit === "FULL" ? 1 : 0.5
  }
  return { workedMin, extraMin, late, early, missing, workdays, leaveDays }
}

export const weekLevel = (min: number) => (min >= WEEK_LIMIT ? "OVER" : min >= WEEK_WARN ? "WARN" : "OK")

/** 그 달에 걸친 주(월~일) 목록과 합계. days 는 첫 주 월요일~마지막 주 일요일 전부를 담고 있어야 한다. */
export function weeksOf(month: string, days: DayRow[]) {
  const { start, next } = monthRange(month)
  const first = ymdOf(start)!
  const last = addDays(ymdOf(next)!, -1)
  const weeks: { start: string; end: string; totalMin: number; otMin: number; level: string }[] = []
  for (let w = mondayOf(first); w <= last; w = addDays(w, 7)) {
    const end = addDays(w, 6)
    const ds = days.filter((d) => d.date >= w && d.date <= end)
    const totalMin = ds.reduce((s, d) => s + d.totalMin, 0)
    weeks.push({ start: w, end, totalMin, otMin: ds.reduce((s, d) => s + d.otMin, 0), level: weekLevel(totalMin) })
  }
  return weeks
}

/** 그 달 집계에 필요한 읽기 범위: 첫 주 월요일 ~ 마지막 주 일요일 다음 날 */
export function monthSpan(month: string) {
  const { start, next } = monthRange(month)
  const first = ymdOf(start)!
  const nextFirst = ymdOf(next)!
  return { first, nextFirst, from: mondayOf(first), to: addDays(mondayOf(addDays(nextFirst, -1)), 7) }
}
