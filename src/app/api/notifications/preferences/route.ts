import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail } from "@/lib/work/common"

// 내 알림 설정(직원·대표): 메일 받기, 하루 요약, 조용한 시간(KST, 분 단위)
export async function GET() {
  const g = await guard()
  if ("res" in g) return g.res
  const [p, me] = await Promise.all([
    prisma.notificationPreference.findUnique({ where: { userId: g.actor.id } }),
    prisma.user.findUnique({ where: { id: g.actor.id }, select: { email: true } }),
  ])
  return NextResponse.json({
    email: me?.email ?? null,
    isMaster: g.actor.isMaster,
    emailEnabled: p?.emailEnabled ?? true,
    dailyDigestEnabled: p?.dailyDigestEnabled ?? true,
    quietStartMinute: p?.quietStartMinute ?? 1140,
    quietEndMinute: p?.quietEndMinute ?? 540,
  })
}

export async function PUT(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const b = await req.json().catch(() => ({}))
  const qs = Number(b.quietStartMinute)
  const qe = Number(b.quietEndMinute)
  if (![qs, qe].every((v) => Number.isInteger(v) && v >= 0 && v < 1440)) return fail("시간이 잘못되었습니다")
  const data = { emailEnabled: !!b.emailEnabled, dailyDigestEnabled: b.dailyDigestEnabled !== false, quietStartMinute: qs, quietEndMinute: qe }
  await prisma.notificationPreference.upsert({ where: { userId: g.actor.id }, create: { userId: g.actor.id, ...data }, update: data })
  return NextResponse.json({ ok: true })
}
