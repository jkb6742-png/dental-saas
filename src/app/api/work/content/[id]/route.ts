import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { canAccessClinic } from "@/lib/requests/access"
import { guard, fail, isMonth, dateOnly, audit, str } from "@/lib/work/common"
import { contentSelect, normalizeUrl, urlHash, markTaskFulfilled } from "@/lib/work/content"

type Ctx = { params: Promise<{ id: string }> }

async function load(id: string) {
  return prisma.publishedContent.findUnique({ where: { id }, select: { ...contentSelect, clinicId: true } })
}

// 수정: 제목·주소·대상월·확인 상태·내림·업무 연결
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const row = await load((await params).id)
  if (!row || !canAccessClinic(actor, row.clinicId)) return fail("찾을 수 없습니다", 404)
  const b = await req.json().catch(() => ({}))
  const data: Prisma.PublishedContentUncheckedUpdateInput = {}
  if (b.title !== undefined) {
    const t = str(b.title, 300)
    if (!t) return fail("제목을 입력하세요")
    data.title = t
  }
  if (b.url !== undefined) {
    try {
      const u = normalizeUrl(String(b.url))
      data.url = u
      data.urlSha256 = urlHash(u)
    } catch {
      return fail("주소가 올바르지 않습니다")
    }
  }
  if (b.serviceMonth !== undefined) {
    if (!isMonth(b.serviceMonth)) return fail("이행 대상월 형식이 잘못되었습니다")
    data.serviceMonth = dateOnly(`${b.serviceMonth}-01`)
  }
  if (b.kind === "BLOG" || b.kind === "COLUMN") data.kind = b.kind
  if (b.primaryKeyword !== undefined) data.primaryKeyword = str(b.primaryKeyword, 100)
  if (b.verification === "VERIFIED" || b.verification === "REJECTED" || b.verification === "PENDING") {
    data.verification = b.verification
    data.verifiedByUserId = b.verification === "PENDING" ? null : actor.id
    data.verifiedAt = b.verification === "PENDING" ? null : new Date()
  }
  if (b.unpublished !== undefined) data.unpublishedAt = b.unpublished ? new Date() : null
  if (b.taskId !== undefined) {
    const taskId = str(b.taskId, 40)
    if (taskId && !(await prisma.task.findFirst({ where: { id: taskId, clinicId: row.clinicId }, select: { id: true } }))) return fail("업무를 찾을 수 없습니다")
    data.taskId = taskId
  }
  try {
    const out = await prisma.publishedContent.update({ where: { id: row.id }, data, select: contentSelect })
    if (typeof data.taskId === "string") await markTaskFulfilled(data.taskId, row.clinicId, out.url, out.publishedAt)
    await audit(actor.id, "CONTENT_UPDATED", row.clinicId, { contentId: row.id, fields: Object.keys(data) })
    return NextResponse.json(out)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return fail("같은 주소나 같은 업무로 등록된 글이 이미 있습니다", 409)
    throw e
  }
}

// 잘못 넣은 기록 삭제(기록은 남긴다)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const row = await load((await params).id)
  if (!row || !canAccessClinic(g.actor, row.clinicId)) return fail("찾을 수 없습니다", 404)
  await prisma.publishedContent.delete({ where: { id: row.id } })
  await audit(g.actor.id, "CONTENT_DELETED", row.clinicId, { contentId: row.id, title: row.title, url: row.url, serviceMonth: row.serviceMonth })
  return NextResponse.json({ ok: true })
}
