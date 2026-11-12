import { prisma } from "@/lib/db"
import type { Actor } from "@/lib/requests/access"
import { canAccessClinic } from "@/lib/requests/access"

// 사내 메신저(직원·대표 전용). 원장 계정은 어떤 방에도 들어올 수 없다.
//  DIRECT : 1:1, 두 사람 id 를 정렬해 붙인 directKey 로 한 방만
//  GROUP  : 이름 있는 단체방
//  CLINIC : 치과당 1개, 그 치과 담당 직원 + 대표. 담당에서 빠지면 바로 못 읽는다.

export const isInternalRole = (role: string) => role === "MASTER" || role === "STAFF"

/** 이 사람이 볼 수 있는 치과 방을 만들고 자기를 멤버로 넣는다. */
export async function ensureClinicRooms(actor: Actor) {
  const me = await prisma.user.findUnique({ where: { id: actor.id }, select: { agencyId: true } })
  const clinics = await prisma.clinic.findMany({
    where: actor.isMaster ? { agencyId: me?.agencyId } : { id: { in: actor.clinicIds ?? [] } },
    select: { id: true, name: true },
  })
  for (const c of clinics) {
    const room = await prisma.chatRoom.upsert({
      where: { type_clinicId: { type: "CLINIC", clinicId: c.id } },
      create: { type: "CLINIC", clinicId: c.id, title: c.name, createdByUserId: actor.id },
      update: {},
      select: { id: true },
    })
    await prisma.chatMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId: actor.id } },
      create: { roomId: room.id, userId: actor.id },
      update: { leftAt: null },
    })
  }
}

/** 방 접근 확인: 멤버여야 하고, 치과 방이면 지금도 그 치과 권한이 있어야 한다. */
export async function roomFor(actor: Actor, roomId: string) {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    select: { id: true, type: true, clinicId: true, title: true, archivedAt: true, members: { where: { userId: actor.id, leftAt: null }, select: { lastReadMessageId: true } } },
  })
  if (!room || !room.members.length) return null
  if (room.type === "CLINIC" && (!room.clinicId || !canAccessClinic(actor, room.clinicId))) return null
  return room
}

/** 내가 들어 있는 방 id (치과 방은 권한 있는 것만) */
export async function myRoomIds(actor: Actor) {
  const rows = await prisma.chatMember.findMany({
    where: { userId: actor.id, leftAt: null, room: { archivedAt: null } },
    select: { roomId: true, room: { select: { type: true, clinicId: true } } },
  })
  return rows.filter((r) => r.room.type !== "CLINIC" || (r.room.clinicId && canAccessClinic(actor, r.room.clinicId))).map((r) => r.roomId)
}

export const messageSelect = {
  id: true,
  roomId: true,
  senderUserId: true,
  clientNonce: true,
  body: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
  taskId: true,
  sender: { select: { name: true } },
  files: { select: { fileVersion: { select: { id: true, fileId: true, versionNo: true, originalName: true, mimeType: true, byteSize: true } } } },
} as const

export function serializeMessage(m: any) {
  return {
    ...m,
    id: m.id.toString(),
    body: m.deletedAt ? null : m.body,
    files: m.deletedAt ? [] : m.files.map((f: any) => ({ ...f.fileVersion, byteSize: Number(f.fileVersion.byteSize) })),
  }
}

/** 방별 안 읽은 수 */
export async function unreadCounts(actor: Actor, roomIds: string[]) {
  if (!roomIds.length) return {}
  const rows = await prisma.$queryRaw<{ roomId: string; n: bigint }[]>`
    SELECT m."roomId", COUNT(*)::bigint AS n
    FROM "ChatMessage" m
    JOIN "ChatMember" cm ON cm."roomId" = m."roomId" AND cm."userId" = ${actor.id}
    WHERE m."roomId" = ANY(${roomIds}) AND m."senderUserId" <> ${actor.id} AND m."deletedAt" IS NULL
      AND (cm."lastReadMessageId" IS NULL OR m.id > cm."lastReadMessageId")
    GROUP BY m."roomId"`
  return Object.fromEntries(rows.map((r) => [r.roomId, Number(r.n)])) as Record<string, number>
}
