import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { eventScope, parseEventInput } from "@/lib/work/calendar"

type Ctx = { params: Promise<{ id: string }> }

async function load(id: string) {
  const actor = await getActor()
  if (!actor || !(actor.isMaster || actor.isStaff)) return { error: NextResponse.json({ error: "권한이 없습니다" }, { status: 403 }) }
  const ev = await prisma.calendarEvent.findFirst({
    where: { AND: [{ id }, eventScope(actor)] },
    include: { participants: { select: { userId: true, user: { select: { name: true } } } }, organizer: { select: { name: true } }, clinic: { select: { name: true } } },
  })
  if (!ev) return { error: NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 }) }
  return { actor, ev }
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const r = await load((await params).id)
  if ("error" in r) return r.error
  return NextResponse.json(r.ev)
}

// 수정·삭제: 만든 사람 또는 마스터
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const r = await load((await params).id)
  if ("error" in r) return r.error
  if (!r.actor.isMaster && r.ev.organizerUserId !== r.actor.id) return NextResponse.json({ error: "만든 사람만 고칠 수 있습니다" }, { status: 403 })
  const b = await req.json().catch(() => null)
  if (b?.status === "CANCELLED") {
    await prisma.calendarEvent.update({ where: { id: r.ev.id }, data: { status: "CANCELLED" } })
    return NextResponse.json({ ok: true })
  }
  const v = parseEventInput(b)
  if (typeof v === "string") return NextResponse.json({ error: v }, { status: 400 })
  if (v.clinicId && !canAccessClinic(r.actor, v.clinicId)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  const participants = await prisma.user.findMany({ where: { id: { in: v.participantIds }, role: { in: ["STAFF", "MASTER"] } }, select: { id: true } })
  const { participantIds: _ignored, ...data } = v
  await prisma.$transaction([
    prisma.calendarEventParticipant.deleteMany({ where: { eventId: r.ev.id } }),
    prisma.calendarEvent.update({
      where: { id: r.ev.id },
      data: { ...data, participants: { create: participants.map((p) => ({ userId: p.id })) } },
    }),
  ])
  return NextResponse.json({ ok: true })
}
