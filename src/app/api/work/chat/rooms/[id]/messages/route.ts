import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, str } from "@/lib/work/common"
import { roomFor, messageSelect, serializeMessage } from "@/lib/work/chat"
import { staffCanSee } from "@/lib/work/files"
import { createNotifications } from "@/lib/notifications"

type Ctx = { params: Promise<{ id: string }> }

// 메시지 읽기: ?before=<id> 이전 50개, ?after=<id> 이후 전부(최대 200)
export async function GET(req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const room = await roomFor(g.actor, (await params).id)
  if (!room) return fail("찾을 수 없습니다", 404)
  const q = req.nextUrl.searchParams
  const before = q.get("before")
  const after = q.get("after")
  const toBig = (s: string | null) => (s && /^\d+$/.test(s) ? BigInt(s) : null)
  const rows = await prisma.chatMessage.findMany({
    where: { roomId: room.id, ...(toBig(after) ? { id: { gt: toBig(after)! } } : toBig(before) ? { id: { lt: toBig(before)! } } : {}) },
    select: messageSelect,
    orderBy: { id: after ? "asc" : "desc" },
    take: after ? 200 : 50,
  })
  const list = after ? rows : rows.reverse()
  return NextResponse.json({ messages: list.map(serializeMessage), lastRead: room.members[0]?.lastReadMessageId?.toString() ?? null })
}

// 보내기: { body, clientNonce, fileVersionIds? }. 같은 nonce 로 다시 보내면 처음 것을 돌려준다.
export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const room = await roomFor(actor, (await params).id)
  if (!room) return fail("찾을 수 없습니다", 404)
  const b = await req.json().catch(() => ({}))
  const body = str(b.body, 4000)
  const nonce = str(b.clientNonce, 64)
  const versionIds: string[] = Array.isArray(b.fileVersionIds) ? b.fileVersionIds.map(String).slice(0, 10) : []
  if (!body && !versionIds.length) return fail("내용을 입력하세요")

  if (nonce) {
    const dup = await prisma.chatMessage.findUnique({ where: { senderUserId_clientNonce: { senderUserId: actor.id, clientNonce: nonce } }, select: messageSelect })
    if (dup) return NextResponse.json(serializeMessage(dup))
  }
  // 첨부는 내가 볼 수 있는 파일만
  if (versionIds.length) {
    const vs = await prisma.sharedFileVersion.findMany({ where: { id: { in: versionIds } }, select: { file: { select: { clinicId: true, deletedAt: true } } } })
    if (vs.length !== versionIds.length || vs.some((v) => v.file.deletedAt || !staffCanSee(actor, v.file))) return fail("첨부할 수 없는 파일입니다")
  }
  const msg = await prisma.chatMessage.create({
    data: { roomId: room.id, senderUserId: actor.id, clientNonce: nonce, body, files: versionIds.length ? { create: versionIds.map((fileVersionId) => ({ fileVersionId })) } : undefined },
    select: messageSelect,
  })
  await prisma.chatRoom.update({ where: { id: room.id }, data: { lastMessageAt: msg.createdAt } })
  await prisma.chatMember.update({ where: { roomId_userId: { roomId: room.id, userId: actor.id } }, data: { lastReadMessageId: msg.id } })

  // @이름 언급 알림(앱 + 메일)
  if (body && body.includes("@")) {
    const members = await prisma.chatMember.findMany({ where: { roomId: room.id, leftAt: null, userId: { not: actor.id } }, select: { userId: true, user: { select: { name: true } } } })
    const hit = members.filter((m) => body.includes(`@${m.user.name}`)).map((m) => m.userId)
    if (hit.length) {
      await createNotifications({
        type: "CHAT_MENTION",
        title: `${actor.name}: ${body.slice(0, 80)}`,
        link: `/work/messages?room=${room.id}`,
        audience: "masters",
        userIds: hit,
        dedupKey: `mention:${msg.id}`,
      })
    }
  }
  return NextResponse.json(serializeMessage(msg), { status: 201 })
}
