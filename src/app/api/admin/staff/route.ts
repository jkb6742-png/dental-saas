import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { getActor } from "@/lib/requests/access"

// 직원 계정·담당 치과 관리 (마스터 전용; 프록시도 /api/admin 을 마스터로 제한)

const DATE = /^\d{4}-\d{2}-\d{2}$/
const toDate = (v: unknown) => (typeof v === "string" && DATE.test(v) ? new Date(`${v}T00:00:00Z`) : null)

async function master() {
  const actor = await getActor()
  if (!actor?.isMaster) return null
  const me = await prisma.user.findUnique({ where: { id: actor.id }, select: { agencyId: true } })
  return me ? { ...actor, agencyId: me.agencyId } : null
}

export async function GET() {
  const m = await master()
  if (!m) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  const [staff, clinics] = await Promise.all([
    prisma.user.findMany({
      where: { agencyId: m.agencyId, role: { in: ["STAFF", "MASTER"] } },
      select: {
        id: true, name: true, email: true, role: true, status: true,
        employee: { select: { hiredOn: true, leftOn: true, clinicAccess: { select: { clinicId: true } } } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.clinic.findMany({ where: { agencyId: m.agencyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ])
  return NextResponse.json({ staff, clinics })
}

/**
 * action=create : 새 직원 계정 { name, email, password, hiredOn, clinicIds }
 * action=save   : 기존 직원·마스터의 입사일·퇴사일·담당 치과 { userId, hiredOn, leftOn, clinicIds }
 * 원장 계정(소속 치과가 있는 계정)을 직원으로 바꾸는 경로는 두지 않는다.
 */
export async function POST(req: NextRequest) {
  const m = await master()
  if (!m) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") return NextResponse.json({ error: "잘못된 요청" }, { status: 400 })

  const hiredOn = toDate(body.hiredOn)
  if (!hiredOn) return NextResponse.json({ error: "입사일(YYYY-MM-DD)을 입력하세요" }, { status: 400 })
  const leftOn = body.leftOn ? toDate(body.leftOn) : null
  if (body.leftOn && !leftOn) return NextResponse.json({ error: "퇴사일 형식이 잘못되었습니다" }, { status: 400 })

  // 같은 에이전시 치과만 배정
  const requested: string[] = Array.isArray(body.clinicIds) ? body.clinicIds.filter((x: unknown) => typeof x === "string") : []
  const clinicIds = (
    await prisma.clinic.findMany({ where: { agencyId: m.agencyId, id: { in: requested } }, select: { id: true } })
  ).map((c) => c.id)

  let userId: string
  if (body.action === "create") {
    const name = String(body.name ?? "").trim()
    const email = String(body.email ?? "").trim().toLowerCase()
    const password = String(body.password ?? "")
    if (!name || !email.includes("@")) return NextResponse.json({ error: "이름과 이메일을 입력하세요" }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: "비밀번호는 8자 이상" }, { status: 400 })
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } }))
      return NextResponse.json({ error: "이미 있는 이메일입니다" }, { status: 409 })
    const user = await prisma.user.create({
      data: {
        name, email, password: await bcrypt.hash(password, 12),
        role: "STAFF", status: "APPROVED", agencyId: m.agencyId, clinicId: null,
        approvedAt: new Date(), approvedBy: m.id,
      },
      select: { id: true },
    })
    userId = user.id
  } else if (body.action === "save") {
    const target = await prisma.user.findFirst({
      where: { id: String(body.userId ?? ""), agencyId: m.agencyId, role: { in: ["STAFF", "MASTER"] } },
      select: { id: true },
    })
    if (!target) return NextResponse.json({ error: "직원을 찾을 수 없습니다" }, { status: 404 })
    userId = target.id
  } else {
    return NextResponse.json({ error: "알 수 없는 작업" }, { status: 400 })
  }

  const before = await prisma.staffClinicAccess.findMany({ where: { employeeUserId: userId }, select: { clinicId: true } })

  await prisma.$transaction([
    prisma.employee.upsert({
      where: { userId },
      create: { userId, hiredOn, leftOn },
      update: { hiredOn, leftOn },
    }),
    prisma.staffClinicAccess.deleteMany({ where: { employeeUserId: userId, clinicId: { notIn: clinicIds } } }),
    prisma.staffClinicAccess.createMany({
      data: clinicIds.map((clinicId) => ({ employeeUserId: userId, clinicId })),
      skipDuplicates: true,
    }),
    prisma.securityLog.create({
      data: {
        userId: m.id,
        event: body.action === "create" ? "STAFF_CREATED" : "STAFF_ACCESS_CHANGED",
        agencyId: m.agencyId,
        severity: "MEDIUM",
        details: {
          targetUserId: userId,
          clinicsBefore: before.map((b) => b.clinicId),
          clinicsAfter: clinicIds,
          hiredOn: body.hiredOn,
          leftOn: body.leftOn ?? null,
        },
      },
    }),
  ])

  return NextResponse.json({ ok: true, userId })
}
