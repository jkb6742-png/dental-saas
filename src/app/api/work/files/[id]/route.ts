import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, audit, str } from "@/lib/work/common"
import { fileListSelect, serializeFile, staffCanSee } from "@/lib/work/files"
import { createNotifications } from "@/lib/notifications"

type Ctx = { params: Promise<{ id: string }> }

async function load(id: string) {
  return prisma.sharedFile.findFirst({ where: { id, deletedAt: null }, select: fileListSelect })
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const f = await load((await params).id)
  if (!f || !staffCanSee(g.actor, f)) return fail("찾을 수 없습니다", 404)
  return NextResponse.json(serializeFile(f))
}

// 제목·공개 범위 변경. 원장 공개로 바꾸면 원장에게 알림.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const f = await load((await params).id)
  if (!f || !staffCanSee(actor, f)) return fail("찾을 수 없습니다", 404)
  const b = await req.json().catch(() => ({}))
  const data: { title?: string; visibility?: "CLINIC" | "INTERNAL"; publishedAt?: Date | null } = {}
  if (b.title !== undefined) {
    const t = str(b.title, 200)
    if (!t) return fail("제목을 입력하세요")
    data.title = t
  }
  if (b.visibility === "CLINIC" || b.visibility === "INTERNAL") {
    if (b.visibility === "CLINIC" && !f.clinicId) return fail("회사 공통 자료는 원장에게 공개할 수 없습니다")
    data.visibility = b.visibility
    data.publishedAt = b.visibility === "CLINIC" ? f.publishedAt ?? new Date() : null
  }
  const row = await prisma.sharedFile.update({ where: { id: f.id }, data, select: fileListSelect })
  if (data.visibility && data.visibility !== f.visibility) {
    await audit(actor.id, data.visibility === "CLINIC" ? "FILE_PUBLISHED" : "FILE_UNPUBLISHED", f.clinicId, { fileId: f.id, title: row.title })
    if (data.visibility === "CLINIC" && f.clinicId) {
      await createNotifications({ type: "FILE_SHARED", title: `새 자료: ${row.title}`, link: `/dashboard/${f.clinicId}/files`, clinicId: f.clinicId, audience: "clinic", exclude: [actor.id] })
    }
  }
  return NextResponse.json(serializeFile(row))
}

// 삭제: 즉시 접근 차단, 실제 파일은 30일 뒤 정리
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const f = await load((await params).id)
  if (!f || !staffCanSee(g.actor, f)) return fail("찾을 수 없습니다", 404)
  await prisma.sharedFile.update({ where: { id: f.id }, data: { deletedAt: new Date() } })
  await audit(g.actor.id, "FILE_DELETED", f.clinicId, { fileId: f.id, title: f.title })
  return NextResponse.json({ ok: true })
}
