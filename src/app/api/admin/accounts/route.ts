import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

// 마스터 전용: 특정 치과에 로그인 계정 생성/삭제.
// 생성된 계정은 role=VIEWER, clinicId 고정 → 해당 치과 외에는 접근 불가(격리).

async function requireMaster() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "인증 필요" }, { status: 401 }) }
  }
  if ((session.user as any).role !== "MASTER") {
    return { error: NextResponse.json({ error: "마스터 권한이 필요합니다." }, { status: 403 }) }
  }
  return { session, agencyId: (session.user as any).agencyId as string }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const ctx = await requireMaster()
  if ("error" in ctx) return ctx.error

  const { clinicId, name, email, password } = await req.json().catch(() => ({}))

  if (!clinicId || !name?.trim() || !email?.trim() || !password) {
    return NextResponse.json(
      { error: "치과, 이름, 이메일, 비밀번호를 모두 입력하세요." },
      { status: 400 }
    )
  }
  const normEmail = String(email).trim().toLowerCase()
  if (!EMAIL_RE.test(normEmail)) {
    return NextResponse.json({ error: "이메일 형식이 올바르지 않습니다." }, { status: 400 })
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 })
  }

  // 치과가 마스터의 에이전시 소속인지 확인 (다른 에이전시 치과에 계정 생성 차단)
  const clinic = await prisma.clinic.findFirst({
    where: { id: clinicId, agencyId: ctx.agencyId },
    select: { id: true, agencyId: true, name: true },
  })
  if (!clinic) {
    return NextResponse.json({ error: "해당 치과를 찾을 수 없습니다." }, { status: 404 })
  }

  // 이메일 중복 확인
  const dup = await prisma.user.findUnique({ where: { email: normEmail }, select: { id: true } })
  if (dup) {
    return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 })
  }

  const hashed = await bcrypt.hash(String(password), 12)
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: normEmail,
      password: hashed,
      role: "VIEWER",
      status: "APPROVED",
      approvedAt: new Date(),
      agencyId: clinic.agencyId,
      clinicId: clinic.id, // 소속 치과 고정 → 격리
    },
    select: { id: true, name: true, email: true, role: true, status: true },
  })

  return NextResponse.json({ success: true, user })
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireMaster()
  if ("error" in ctx) return ctx.error

  const { userId } = await req.json().catch(() => ({}))
  if (!userId) {
    return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 })
  }

  // 삭제 대상이 마스터의 에이전시 안, 특정 치과에 묶인 비마스터 계정인지 확인
  const target = await prisma.user.findFirst({
    where: {
      id: userId,
      agencyId: ctx.agencyId,
      role: { not: "MASTER" },
      clinicId: { not: null },
    },
    select: { id: true, name: true, email: true },
  })
  if (!target) {
    return NextResponse.json(
      { error: "삭제할 수 없는 계정입니다. (마스터 계정이거나 다른 에이전시 소속)" },
      { status: 404 }
    )
  }

  await prisma.user.delete({ where: { id: target.id } })
  return NextResponse.json({ success: true, deleted: target.email })
}
