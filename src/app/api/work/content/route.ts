import { NextRequest, NextResponse } from "next/server"
import { Prisma, type ContentKind } from "@prisma/client"
import { prisma } from "@/lib/db"
import { canAccessClinic } from "@/lib/requests/access"
import { guard, fail, forbidden, clinicWhere, isMonth, monthRange, audit, str } from "@/lib/work/common"
import { contentData, contentSelect, markTaskFulfilled } from "@/lib/work/content"

// 발행 기록 목록·직접 등록. month 는 계약 이행 대상월(serviceMonth).

export async function GET(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const q = req.nextUrl.searchParams
  const clinicId = q.get("clinicId")
  if (clinicId && !canAccessClinic(g.actor, clinicId)) return forbidden()
  const where: Prisma.PublishedContentWhereInput = clinicId ? { clinicId } : clinicWhere(g.actor)
  const month = q.get("month")
  if (isMonth(month)) where.serviceMonth = monthRange(month).start
  const kind = q.get("kind")
  if (kind === "BLOG" || kind === "COLUMN") where.kind = kind
  const rows = await prisma.publishedContent.findMany({ where, select: contentSelect, orderBy: { publishedAt: "desc" }, take: 500 })
  return NextResponse.json({ items: rows })
}

export async function POST(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const b = await req.json().catch(() => null)
  if (!b) return fail("잘못된 요청")
  const clinicId = String(b.clinicId ?? "")
  if (!clinicId || !canAccessClinic(actor, clinicId)) return forbidden()
  const kind: ContentKind = b.kind === "COLUMN" ? "COLUMN" : "BLOG"
  const title = str(b.title, 300)
  if (!title) return fail("제목을 입력하세요")
  const publishedAt = new Date(b.publishedAt ?? "")
  if (isNaN(publishedAt.getTime())) return fail("발행일을 입력하세요")
  if (b.serviceMonth && !isMonth(b.serviceMonth)) return fail("이행 대상월 형식이 잘못되었습니다")
  const taskId = str(b.taskId, 40)
  if (taskId && !(await prisma.task.findFirst({ where: { id: taskId, clinicId }, select: { id: true } }))) return fail("업무를 찾을 수 없습니다")

  let data
  try {
    data = contentData({
      clinicId,
      kind,
      source: "MANUAL",
      title,
      url: String(b.url ?? ""),
      publishedAt,
      serviceMonth: b.serviceMonth,
      primaryKeyword: str(b.primaryKeyword, 100),
      taskId,
      authorUserId: actor.id,
      authorNameSnapshot: actor.name,
      verified: { byUserId: actor.id },
    })
  } catch (e) {
    return fail(e instanceof TypeError ? "주소가 올바르지 않습니다" : (e as Error).message)
  }
  try {
    const row = await prisma.publishedContent.create({ data, select: contentSelect })
    if (taskId) await markTaskFulfilled(taskId, clinicId, data.url, publishedAt)
    await audit(actor.id, "CONTENT_RECORDED", clinicId, { contentId: row.id, kind, url: data.url })
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail(taskId ? "이미 같은 주소나 같은 업무로 등록된 글이 있습니다" : "이미 등록된 주소입니다", 409)
    }
    throw e
  }
}
