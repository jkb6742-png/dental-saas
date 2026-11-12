import { NextRequest, NextResponse } from "next/server"
import type { AttendanceClass } from "@prisma/client"
import { prisma } from "@/lib/db"
import { guard, fail, isMonth, isYmd, monthRange, currentMonth, kstToday, dateOnly, audit, str } from "@/lib/work/common"
import { clientIp, officeNetworkCheck, OFFICE_DENIED, scheduleRemoteChecks, cancelRemainingChecks } from "@/lib/work/presence"
import { mySummary, teamSummary } from "./views"

// 출퇴근. 시각은 서버 시각으로만 찍는다(직원이 시각을 고를 수 없음).
// 대표는 다른 직원 기록을 고칠 수 있고, 고친 내용은 기록된다.

const CLASSES: AttendanceClass[] = ["WORKED", "PAID_LEAVE", "BUSINESS_TRIP", "ABSENT", "EXCLUDED"]

export async function GET(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const q = req.nextUrl.searchParams
  const month = q.get("month") ?? currentMonth()
  if (!isMonth(month)) return fail("월 형식이 잘못되었습니다")
  // 화면용 집계: summary=me(내 근태, 대표는 userId 로 다른 직원도) / summary=team(대표만)
  const summary = q.get("summary")
  if (summary === "team") {
    if (!actor.isMaster) return fail("권한이 없습니다", 403)
    return NextResponse.json(await teamSummary(month))
  }
  if (summary === "me") {
    const target = actor.isMaster && q.get("userId") ? q.get("userId")! : actor.id
    const body = await mySummary(target, month)
    const me = await prisma.employee.findUnique({ where: { userId: actor.id }, select: { workMode: true, user: { select: { agencyId: true } } } })
    let presence = null
    if (me) {
      const ip = clientIp(req)
      const net = me.workMode === "OFFICE" ? await officeNetworkCheck(me.user.agencyId, ip) : null
      presence = { workMode: me.workMode, ip, enforced: net?.enforced ?? false, officeOk: net?.ok ?? true, network: net?.network ?? null }
    }
    const today = await prisma.attendanceRecord.findUnique({ where: { employeeUserId_workDate: { employeeUserId: actor.id, workDate: dateOnly(kstToday()) } } })
    return NextResponse.json({ ...body, today, presence })
  }
  const { start, next } = monthRange(month)
  const who = q.get("userId")
  // 대표: 전체 또는 지정 직원, 직원: 본인만
  const where = actor.isMaster ? (who ? { employeeUserId: who } : {}) : { employeeUserId: actor.id }
  const rows = await prisma.attendanceRecord.findMany({
    where: { ...where, workDate: { gte: start, lt: next } },
    include: { employee: { select: { user: { select: { name: true } } } } },
    orderBy: [{ workDate: "asc" }],
  })
  const today = await prisma.attendanceRecord.findUnique({ where: { employeeUserId_workDate: { employeeUserId: actor.id, workDate: dateOnly(kstToday()) } } })
  const employees = actor.isMaster
    ? await prisma.employee.findMany({ where: { OR: [{ leftOn: null }, { leftOn: { gte: start } }] }, select: { userId: true, user: { select: { name: true } } }, orderBy: { hiredOn: "asc" } })
    : []
  // 출퇴근 버튼 옆 안내: 내 근무 방식과 지금 네트워크가 사무실인지
  const me = await prisma.employee.findUnique({ where: { userId: actor.id }, select: { workMode: true, user: { select: { agencyId: true } } } })
  let presence = null
  if (me) {
    const ip = clientIp(req)
    const net = me.workMode === "OFFICE" ? await officeNetworkCheck(me.user.agencyId, ip) : null
    presence = { workMode: me.workMode, ip, enforced: net?.enforced ?? false, officeOk: net?.ok ?? true, network: net?.network ?? null }
  }
  return NextResponse.json({ month, records: rows, today, employees, presence })
}

export async function POST(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const b = await req.json().catch(() => ({}))

  // 출퇴근: 사무실 근무자는 허용 네트워크(사무실 공인 IP)에서만. 재택 근무자는 어디서나 찍되 무작위 QR 인증이 붙는다.
  if (b.action === "in" || b.action === "out") {
    const emp = await prisma.employee.findUnique({
      where: { userId: actor.id },
      select: { userId: true, workMode: true, user: { select: { agencyId: true } } },
    })
    if (!emp) return fail("직원 정보가 없는 계정입니다. 대표 > 직원 관리에서 등록하세요")
    const agencyId = emp.user.agencyId
    const ip = clientIp(req)
    if (emp.workMode === "OFFICE") {
      const net = await officeNetworkCheck(agencyId, ip)
      if (!net.ok) {
        await audit(actor.id, "ATTENDANCE_IP_DENIED", null, { action: b.action, ip })
        return fail(OFFICE_DENIED, 403)
      }
    }
    const workDate = dateOnly(kstToday())
    const cur = await prisma.attendanceRecord.findUnique({ where: { employeeUserId_workDate: { employeeUserId: actor.id, workDate } } })
    if (b.action === "in") {
      if (cur?.clockInAt) return fail("오늘 이미 출근을 찍었습니다")
      const now = new Date()
      const data = { clockInAt: now, class: "WORKED" as const, workMode: emp.workMode, clockInIp: ip }
      const row = await prisma.attendanceRecord.upsert({
        where: { employeeUserId_workDate: { employeeUserId: actor.id, workDate } },
        create: { employeeUserId: actor.id, workDate, ...data },
        update: data,
      })
      if (emp.workMode === "REMOTE") await scheduleRemoteChecks(actor.id, agencyId, now)
      return NextResponse.json(row)
    }
    if (!cur?.clockInAt) return fail("출근 기록이 없습니다")
    if (cur.clockOutAt) return fail("오늘 이미 퇴근을 찍었습니다")
    const row = await prisma.attendanceRecord.update({ where: { id: cur.id }, data: { clockOutAt: new Date(), clockOutIp: ip } })
    if (emp.workMode === "REMOTE") await cancelRemainingChecks(actor.id)
    return NextResponse.json(row)
  }

  // 대표 수정: { action:"set", userId, workDate, clockIn:"09:02", clockOut:"18:10", breakMinutes, class, note }
  if (b.action === "set") {
    if (!actor.isMaster) return fail("권한이 없습니다", 403)
    if (!isYmd(b.workDate)) return fail("날짜를 고르세요")
    const emp = await prisma.employee.findUnique({ where: { userId: String(b.userId ?? "") }, select: { userId: true } })
    if (!emp) return fail("직원을 찾을 수 없습니다")
    const at = (hm: unknown) => {
      if (!hm) return null
      if (typeof hm !== "string" || !/^\d{2}:\d{2}$/.test(hm)) throw new Error("시각은 09:00 형식입니다")
      return new Date(`${b.workDate}T${hm}:00+09:00`)
    }
    let clockInAt, clockOutAt
    try {
      clockInAt = at(b.clockIn)
      clockOutAt = at(b.clockOut)
    } catch (e) {
      return fail((e as Error).message)
    }
    if (clockInAt && clockOutAt && clockOutAt < clockInAt) return fail("퇴근이 출근보다 빠릅니다")
    const breakMinutes = Math.max(0, Math.min(600, Number(b.breakMinutes) || 0))
    const cls = CLASSES.includes(b.class) ? b.class : null
    const workDate = dateOnly(b.workDate)
    const before = await prisma.attendanceRecord.findUnique({ where: { employeeUserId_workDate: { employeeUserId: emp.userId, workDate } } })
    const data = { clockInAt, clockOutAt, breakMinutes, class: cls, note: str(b.note, 200), source: "MANAGER" as const }
    const row = await prisma.attendanceRecord.upsert({
      where: { employeeUserId_workDate: { employeeUserId: emp.userId, workDate } },
      create: { employeeUserId: emp.userId, workDate, ...data },
      update: data,
    })
    await audit(actor.id, "ATTENDANCE_EDITED", null, {
      employee: emp.userId,
      workDate: b.workDate,
      before: before ? { in: before.clockInAt, out: before.clockOutAt, class: before.class, breakMinutes: before.breakMinutes } : null,
      after: { in: clockInAt, out: clockOutAt, class: cls, breakMinutes },
    })
    return NextResponse.json(row)
  }
  return fail("알 수 없는 동작")
}
