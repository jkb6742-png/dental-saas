import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, str } from "@/lib/work/common"
import { ensureClinicRooms, myRoomIds, unreadCounts, isInternalRole } from "@/lib/work/chat"

// 방 목록(안 읽은 수·마지막 메시지)과 방 만들기
export async function GET() {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  await ensureClinicRooms(actor)
  const ids = await myRoomIds(actor)
  const [rooms, unread] = await Promise.all([
    prisma.chatRoom.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        type: true,
        title: true,
        clinicId: true,
        lastMessageAt: true,
        members: { where: { leftAt: null }, select: { userId: true, user: { select: { name: true } } } },
        messages: { orderBy: { id: "desc" }, take: 1, select: { body: true, deletedAt: true, sender: { select: { name: true } } } },
      },
    }),
    unreadCounts(actor, ids),
  ])
  const out = rooms
    .map((r) => ({
      id: r.id,
      type: r.type,
      clinicId: r.clinicId,
      // 1:1 방 이름은 상대 이름
      title: r.type === "DIRECT" ? r.members.find((m) => m.userId !== actor.id)?.user.name ?? "(나간 사람)" : r.title ?? "단체방",
      members: r.members.map((m) => ({ id: m.userId, name: m.user.name })),
      lastMessageAt: r.lastMessageAt,
      last: r.messages[0] ? { body: r.messages[0].deletedAt ? "(삭제된 메시지)" : r.messages[0].body, sender: r.messages[0].sender.name } : null,
      unread: unread[r.id] ?? 0,
    }))
    .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0) || a.title.localeCompare(b.title))
  return NextResponse.json({ rooms: out })
}

export async function POST(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const b = await req.json().catch(() => ({}))
  const ids: string[] = Array.from(new Set<string>((b.type === "DIRECT" ? [b.userId] : b.userIds ?? []).map(String))).filter((x) => x !== actor.id)
  const people = await prisma.user.findMany({ where: { id: { in: ids }, status: "APPROVED" }, select: { id: true, role: true } })
  if (!people.length || people.some((p) => !isInternalRole(p.role)) || people.length !== ids.length) return fail("직원만 초대할 수 있습니다")

  if (b.type === "DIRECT") {
    const other = people[0].id
    const directKey = [actor.id, other].sort().join(":")
    const room = await prisma.chatRoom.upsert({
      where: { directKey },
      create: { type: "DIRECT", directKey, createdByUserId: actor.id, members: { create: [{ userId: actor.id }, { userId: other }] } },
      update: {},
      select: { id: true },
    })
    await prisma.chatMember.updateMany({ where: { roomId: room.id }, data: { leftAt: null } })
    return NextResponse.json(room, { status: 201 })
  }
  const title = str(b.title, 100)
  if (!title) return fail("방 이름을 입력하세요")
  const room = await prisma.chatRoom.create({
    data: { type: "GROUP", title, createdByUserId: actor.id, members: { create: [{ userId: actor.id }, ...people.map((p) => ({ userId: p.id }))] } },
    select: { id: true },
  })
  return NextResponse.json(room, { status: 201 })
}
