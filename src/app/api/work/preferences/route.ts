import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail } from "@/lib/work/common"

// 내 알림 설정: 메일 받기, 조용한 시간(KST, 분 단위)
export async function GET() {
  const g = await guard()
  if ("res" in g) return g.res
  const p = await prisma.notificationPreference.findUnique({ where: { userId: g.actor.id } })
  const me = await prisma.user.findUnique({ where: { id: g.actor.id }, select: { email: true } })
  return NextResponse.json({ email: me?.email, emailEnabled: p?.emailEnabled ?? true, quietStartMinute: p?.quietStartMinute ?? 1200, quietEndMinute: p?.quietEndMinute ?? 540 })
}

export async function PUT(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const b = await req.json().catch(() => ({}))
  const qs = Number(b.quietStartMinute)
  const qe = Number(b.quietEndMinute)
  if (![qs, qe].every((v) => Number.isInteger(v) && v >= 0 && v < 1440)) return fail("시간이 잘못되었습니다")
  const data = { emailEnabled: !!b.emailEnabled, quietStartMinute: qs, quietEndMinute: qe }
  await prisma.notificationPreference.upsert({ where: { userId: g.actor.id }, create: { userId: g.actor.id, ...data }, update: data })
  return NextResponse.json({ ok: true })
}
