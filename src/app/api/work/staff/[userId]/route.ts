import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { guard, fail, audit, str, isMonth, currentMonth, monthRange, isYmd, dateOnly } from "@/lib/work/common"
import { leaveBalance } from "@/lib/work/leave"
import { masterAgency, parseProfile, ownClinicIds, tempPassword } from "@/lib/work/staff"

// 직원 상세(대표 전용): 기본정보·근태·연차·담당 치과·업무·계정 보안

type Ctx = { params: Promise<{ userId: string }> }

async function target(masterId: string, userId: string) {
  const agencyId = await masterAgency(masterId)
  if (!agencyId) return null
  const u = await prisma.user.findFirst({
    where: { id: userId, agencyId, role: { in: ["STAFF", "MASTER"] } },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  })
  return u ? { ...u, agencyId } : null
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const { userId } = await ctx.params
  const u = await target(g.actor.id, userId)
  if (!u) return fail("직원을 찾을 수 없습니다", 404)
  const month = req.nextUrl.searchParams.get("month") ?? currentMonth()
  if (!isMonth(month)) return fail("월 형식이 잘못되었습니다")
  const { start, next } = monthRange(month)

  const employee = await prisma.employee.findUnique({
    where: { userId },
    include: { clinicAccess: { select: { clinicId: true } } },
  })
  const [clinics, attendance, remoteChecks, tasks, ledger, logs, salaries] = await Promise.all([
    prisma.clinic.findMany({ where: { agencyId: u.agencyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    employee
      ? prisma.attendanceRecord.findMany({ where: { employeeUserId: userId, workDate: { gte: start, lt: next } }, orderBy: { workDate: "desc" } })
      : [],
    employee
      ? prisma.remoteCheck.findMany({
          where: { employeeUserId: userId, workDate: { gte: start, lt: next }, status: { not: "CANCELLED" } },
          orderBy: { scheduledAt: "desc" },
          select: { id: true, workDate: true, scheduledAt: true, shownAt: true, verifiedAt: true, status: true, reissueCount: true, wrongAttempts: true, reason: true },
        })
      : [],
    prisma.task.findMany({
      where: { assigneeUserId: userId, status: { notIn: ["DONE", "CANCELLED"] } },
      select: { id: true, title: true, status: true, dueOn: true, clinic: { select: { name: true } } },
      orderBy: [{ dueOn: "asc" }],
      take: 30,
    }),
    employee
      ? prisma.leaveLedgerEntry.findMany({ where: { employeeUserId: userId }, orderBy: { effectiveOn: "desc" }, take: 30 })
      : [],
    prisma.securityLog.findMany({
      where: { details: { path: ["targetUserId"], equals: userId } },
      orderBy: { timestamp: "desc" },
      take: 20,
      select: { event: true, timestamp: true, userId: true },
    }),
    employee ? prisma.employeeSalary.findMany({ where: { employeeUserId: userId }, orderBy: { effectiveOn: "desc" } }) : [],
  ])
  const leave = employee ? await leaveBalance(userId) : null

  // 이번 달 근태 요약: 근무일, 지각(근무 시작 1분 이후 출근), 퇴근 미기록
  const late = employee
    ? attendance.filter((a) => {
        if (!a.clockInAt) return false
        const hm = new Date(a.clockInAt.getTime() + 9 * 3600_000).toISOString().slice(11, 16)
        return hm > employee.workStart
      }).length
    : 0
  const summary = {
    worked: attendance.filter((a) => a.clockInAt).length,
    late,
    noClockOut: attendance.filter((a) => a.clockInAt && !a.clockOutAt && a.workDate < dateOnly(new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10))).length,
    remoteVerified: remoteChecks.filter((r) => r.status === "VERIFIED").length,
    remoteMissed: remoteChecks.filter((r) => r.status === "MISSED").length,
  }

  return NextResponse.json({
    user: { id: u.id, name: u.name, email: u.email, role: u.role, locked: u.status !== "APPROVED", createdAt: u.createdAt },
    employee,
    clinics,
    month,
    attendance,
    remoteChecks,
    summary,
    leave,
    ledger: ledger.map((l) => ({ ...l, deltaDays: Number(l.deltaDays) })),
    tasks,
    logs,
    salaries,
  })
}

/** 기본정보 저장. 이름도 같이 바꾼다. 직원 행이 없으면(대표 등) 만든다. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const { userId } = await ctx.params
  const u = await target(g.actor.id, userId)
  if (!u) return fail("직원을 찾을 수 없습니다", 404)
  const b = await req.json().catch(() => ({}))
  const p = parseProfile(b)
  if ("error" in p) return fail(p.error!)
  const name = str(b.name, 40)
  if (!name) return fail("이름을 입력하세요")
  let email: string | undefined
  if (b.email !== undefined) {
    email = String(b.email).trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("로그인 이메일 형식이 잘못되었습니다")
    const other = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (other && other.id !== userId) return fail("다른 계정이 쓰는 이메일입니다", 409)
  }
  const before = await prisma.employee.findUnique({ where: { userId } })
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { name, ...(email ? { email } : {}) } }),
    prisma.employee.upsert({ where: { userId }, create: { userId, ...p.data }, update: p.data }),
  ])
  await audit(g.actor.id, "STAFF_PROFILE_CHANGED", null, {
    targetUserId: userId,
    before: before ? { hiredOn: before.hiredOn, leftOn: before.leftOn, workMode: before.workMode, workStart: before.workStart, workEnd: before.workEnd } : null,
    after: { hiredOn: p.data.hiredOn, leftOn: p.data.leftOn, workMode: p.data.workMode, workStart: p.data.workStart, workEnd: p.data.workEnd },
  })
  return NextResponse.json({ ok: true })
}

/**
 * 위험 동작. 화면에서 한 번 더 확인받은 뒤 보낸다.
 * clinics: 담당 치과 교체 { clinicIds }
 * resetPassword: 임시 비밀번호 발급(한 번만 보여줌)
 * lock / unlock: 로그인 막기·풀기(다음 요청부터 바로 막힘)
 * resign: 퇴사 처리 { leftOn, unassignTasks } — 계정 잠금 + 담당 치과 회수, 기록은 지우지 않는다
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const { userId } = await ctx.params
  const u = await target(g.actor.id, userId)
  if (!u) return fail("직원을 찾을 수 없습니다", 404)
  const b = await req.json().catch(() => ({}))
  const self = userId === g.actor.id

  if (b.action === "clinics") {
    if (u.role === "MASTER") return fail("대표는 모든 치과를 봅니다")
    const emp = await prisma.employee.findUnique({ where: { userId }, select: { userId: true } })
    if (!emp) return fail("기본정보를 먼저 저장하세요")
    const clinicIds = await ownClinicIds(u.agencyId, b.clinicIds)
    const before = await prisma.staffClinicAccess.findMany({ where: { employeeUserId: userId }, select: { clinicId: true } })
    await prisma.$transaction([
      prisma.staffClinicAccess.deleteMany({ where: { employeeUserId: userId, clinicId: { notIn: clinicIds } } }),
      prisma.staffClinicAccess.createMany({ data: clinicIds.map((clinicId) => ({ employeeUserId: userId, clinicId })), skipDuplicates: true }),
    ])
    await audit(g.actor.id, "STAFF_ACCESS_CHANGED", null, { targetUserId: userId, clinicsBefore: before.map((x) => x.clinicId), clinicsAfter: clinicIds })
    return NextResponse.json({ ok: true })
  }

  // 연봉 이력 추가·삭제 { effectiveOn, annualSalary, reason } / { salaryId }
  if (b.action === "salary") {
    const emp = await prisma.employee.findUnique({ where: { userId }, select: { userId: true } })
    if (!emp) return fail("기본정보를 먼저 저장하세요")
    if (!isYmd(b.effectiveOn)) return fail("적용일을 입력하세요")
    const amount = Math.round(Number(String(b.annualSalary ?? "").replace(/[^0-9]/g, "")))
    if (!(amount >= 1_000_000 && amount <= 1_000_000_000)) return fail("연봉(원)을 확인하세요")
    const row = await prisma.employeeSalary.create({
      data: { employeeUserId: userId, effectiveOn: dateOnly(b.effectiveOn), annualSalary: amount, reason: str(b.reason, 100), createdByUserId: g.actor.id },
    })
    await audit(g.actor.id, "STAFF_SALARY_ADDED", null, { targetUserId: userId, effectiveOn: b.effectiveOn, annualSalary: amount, reason: row.reason })
    return NextResponse.json(row)
  }
  if (b.action === "deleteSalary") {
    const row = await prisma.employeeSalary.findFirst({ where: { id: String(b.salaryId ?? ""), employeeUserId: userId } })
    if (!row) return fail("기록을 찾을 수 없습니다", 404)
    await prisma.employeeSalary.delete({ where: { id: row.id } })
    await audit(g.actor.id, "STAFF_SALARY_DELETED", null, { targetUserId: userId, effectiveOn: row.effectiveOn, annualSalary: row.annualSalary })
    return NextResponse.json({ ok: true })
  }

  if (b.action === "resetPassword") {
    const pw = tempPassword()
    await prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(pw, 12) } })
    await audit(g.actor.id, "STAFF_PASSWORD_RESET", null, { targetUserId: userId })
    return NextResponse.json({ ok: true, tempPassword: pw })
  }

  if (b.action === "lock" || b.action === "unlock") {
    if (self) return fail("본인 계정은 잠글 수 없습니다")
    const reason = str(b.reason, 200)
    if (b.action === "lock" && !reason) return fail("잠금 사유를 입력하세요")
    await prisma.user.update({ where: { id: userId }, data: { status: b.action === "lock" ? "REJECTED" : "APPROVED" } })
    await audit(g.actor.id, b.action === "lock" ? "STAFF_LOCKED" : "STAFF_UNLOCKED", null, { targetUserId: userId, reason })
    return NextResponse.json({ ok: true })
  }

  if (b.action === "resign") {
    if (self || u.role === "MASTER") return fail("대표 계정은 퇴사 처리할 수 없습니다")
    if (!isYmd(b.leftOn)) return fail("퇴사일을 입력하세요")
    const emp = await prisma.employee.findUnique({ where: { userId }, select: { userId: true } })
    if (!emp) return fail("기본정보를 먼저 저장하세요")
    const open = await prisma.task.count({ where: { assigneeUserId: userId, status: { notIn: ["DONE", "CANCELLED"] } } })
    await prisma.$transaction([
      prisma.employee.update({ where: { userId }, data: { leftOn: dateOnly(b.leftOn) } }),
      prisma.user.update({ where: { id: userId }, data: { status: "REJECTED" } }),
      prisma.staffClinicAccess.deleteMany({ where: { employeeUserId: userId } }),
      ...(b.unassignTasks ? [prisma.task.updateMany({ where: { assigneeUserId: userId, status: { notIn: ["DONE", "CANCELLED"] } }, data: { assigneeUserId: null } })] : []),
    ])
    await audit(g.actor.id, "STAFF_RESIGNED", null, { targetUserId: userId, leftOn: b.leftOn, openTasks: open, unassigned: !!b.unassignTasks })
    return NextResponse.json({ ok: true })
  }

  return fail("알 수 없는 동작")
}
