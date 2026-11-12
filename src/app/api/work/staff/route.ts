import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { guard, fail, audit, str, kstToday, dateOnly } from "@/lib/work/common"
import { leaveBalance } from "@/lib/work/leave"
import { masterAgency, parseProfile, ownClinicIds, tempPassword } from "@/lib/work/staff"

// 직원 관리(대표 전용): 목록·추가

export async function GET() {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const agencyId = await masterAgency(g.actor.id)
  if (!agencyId) return fail("소속 정보가 없습니다", 403)
  const [users, clinics, pendingLeave] = await Promise.all([
    prisma.user.findMany({
      where: { agencyId, role: { in: ["STAFF", "MASTER"] } },
      select: {
        id: true, name: true, email: true, role: true, status: true,
        employee: { select: { hiredOn: true, leftOn: true, jobTitle: true, workMode: true, clinicAccess: { select: { clinicId: true } } } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.clinic.findMany({ where: { agencyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.leaveRequest.count({ where: { status: "PENDING", employee: { user: { agencyId } } } }),
  ])
  const today = dateOnly(kstToday())
  const rows = await Promise.all(
    users.map(async (u) => {
      const e = u.employee
      const active = !!e && (!e.leftOn || e.leftOn >= today)
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        locked: u.status !== "APPROVED",
        registered: !!e,
        active,
        hiredOn: e?.hiredOn ?? null,
        leftOn: e?.leftOn ?? null,
        jobTitle: e?.jobTitle ?? null,
        workMode: e?.workMode ?? null,
        clinicCount: u.role === "MASTER" ? null : e?.clinicAccess.length ?? 0,
        leave: e ? (await leaveBalance(u.id)).balance : null,
      }
    })
  )
  return NextResponse.json({ staff: rows, clinics, pendingLeave })
}

/** 직원 추가: 계정 + 직원 정보 + 담당 치과. 초기 비밀번호는 비우면 임시 비밀번호를 만들어 한 번만 보여준다. */
export async function POST(req: NextRequest) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const agencyId = await masterAgency(g.actor.id)
  if (!agencyId) return fail("소속 정보가 없습니다", 403)
  const b = await req.json().catch(() => ({}))
  const name = str(b.name, 40)
  const email = String(b.email ?? "").trim().toLowerCase()
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("이름과 업무용 이메일을 입력하세요")
  const p = parseProfile(b)
  if ("error" in p) return fail(p.error!)
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return fail("이미 있는 이메일입니다", 409)
  const given = typeof b.password === "string" ? b.password : ""
  if (given && given.length < 8) return fail("비밀번호는 8자 이상입니다")
  const password = given || tempPassword()
  const clinicIds = await ownClinicIds(agencyId, b.clinicIds)

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        name, email, password: await bcrypt.hash(password, 12),
        role: "STAFF", status: "APPROVED", agencyId, clinicId: null,
        approvedAt: new Date(), approvedBy: g.actor.id,
      },
      select: { id: true },
    })
    await tx.employee.create({ data: { userId: u.id, ...p.data } })
    if (clinicIds.length) await tx.staffClinicAccess.createMany({ data: clinicIds.map((clinicId) => ({ employeeUserId: u.id, clinicId })) })
    return u
  })
  await audit(g.actor.id, "STAFF_CREATED", null, { targetUserId: user.id, clinics: clinicIds, workMode: p.data.workMode })
  return NextResponse.json({ ok: true, userId: user.id, tempPassword: given ? null : password })
}
