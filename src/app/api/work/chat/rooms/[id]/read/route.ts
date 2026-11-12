import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail } from "@/lib/work/common"
import { roomFor } from "@/lib/work/chat"

type Ctx = { params: Promise<{ id: string }> }

// 읽음 표시: { messageId }. 뒤로 돌아가지 않는다.
export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const room = await roomFor(g.actor, (await params).id)
  if (!room) return fail("찾을 수 없습니다", 404)
  const b = await req.json().catch(() => ({}))
  if (!/^\d+$/.test(String(b.messageId ?? ""))) return fail("잘못된 요청")
  const id = BigInt(b.messageId)
  const cur = room.members[0]?.lastReadMessageId
  if (!cur || id > cur) {
    const exists = await prisma.chatMessage.findFirst({ where: { id, roomId: room.id }, select: { id: true } })
    if (exists) await prisma.chatMember.update({ where: { roomId_userId: { roomId: room.id, userId: g.actor.id } }, data: { lastReadMessageId: id } })
  }
  return NextResponse.json({ ok: true })
}
