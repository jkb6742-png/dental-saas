import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { parseEventInput } from "@/lib/work/calendar"
import { createNotifications } from "@/lib/notifications"

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor || !(actor.isMaster || actor.isStaff)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  const v = parseEventInput(await req.json().catch(() => null))
  if (typeof v === "string") return NextResponse.json({ error: v }, { status: 400 })
  if (v.clinicId && !canAccessClinic(actor, v.clinicId)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })

  // 참석자는 내부 계정(직원·마스터)만
  const participants = await prisma.user.findMany({
    where: { id: { in: v.participantIds }, role: { in: ["STAFF", "MASTER"] } },
    select: { id: true },
  })
  const { participantIds: _ignored, ...data } = v
  const ev = await prisma.calendarEvent.create({
    data: { ...data, organizerUserId: actor.id, participants: { create: participants.map((p) => ({ userId: p.id })) } },
    select: { id: true, title: true, startAt: true },
  })
  const others = participants.map((p) => p.id).filter((id) => id !== actor.id)
  if (others.length) {
    await createNotifications({
      type: "SYSTEM", audience: "masters", userIds: others, clinicId: v.clinicId,
      title: `일정 초대 · ${ev.title.slice(0, 80)}`, body: `${actor.name} · ${new Date(ev.startAt.getTime() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ")}`,
      link: `/work/calendar?event=${ev.id}`,
    }).catch(() => {})
  }
  return NextResponse.json({ id: ev.id }, { status: 201 })
}
