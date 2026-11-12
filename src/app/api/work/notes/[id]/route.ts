import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClinic } from "@/lib/requests/access"
import { guard, fail, audit, str } from "@/lib/work/common"

type Ctx = { params: Promise<{ id: string }> }

// 메모 수정·삭제: 쓴 사람 또는 마스터만
async function load(id: string) {
  return prisma.clinicNote.findFirst({ where: { id, deletedAt: null }, select: { id: true, clinicId: true, authorUserId: true } })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const n = await load((await params).id)
  if (!n || !canAccessClinic(g.actor, n.clinicId)) return fail("찾을 수 없습니다", 404)
  if (n.authorUserId !== g.actor.id && !g.actor.isMaster) return fail("쓴 사람만 고칠 수 있습니다", 403)
  const b = await req.json().catch(() => ({}))
  const body = b.body !== undefined ? str(b.body, 5000) : undefined
  if (body === null) return fail("내용을 입력하세요")
  await prisma.clinicNote.update({ where: { id: n.id }, data: { body, title: b.title !== undefined ? str(b.title, 200) : undefined } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const n = await load((await params).id)
  if (!n || !canAccessClinic(g.actor, n.clinicId)) return fail("찾을 수 없습니다", 404)
  if (n.authorUserId !== g.actor.id && !g.actor.isMaster) return fail("쓴 사람만 지울 수 있습니다", 403)
  await prisma.clinicNote.update({ where: { id: n.id }, data: { deletedAt: new Date() } })
  await audit(g.actor.id, "NOTE_DELETED", n.clinicId, { noteId: n.id })
  return NextResponse.json({ ok: true })
}
