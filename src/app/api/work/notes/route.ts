import { NextRequest, NextResponse } from "next/server"
import type { ClinicNoteKind, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { canAccessClinic } from "@/lib/requests/access"
import { guard, fail, forbidden, clinicWhere, isMonth, monthRange, KST_MS, str } from "@/lib/work/common"

// 업체 메모(직원 내부). 원장에게는 보이지 않는다. 환자 이름·연락처는 적지 않는다.

const KINDS: ClinicNoteKind[] = ["CALL", "MEETING", "REQUEST", "SPECIAL", "OTHER"]
const select = {
  id: true,
  clinicId: true,
  kind: true,
  occurredAt: true,
  title: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  authorUserId: true,
  author: { select: { name: true } },
  clinic: { select: { name: true } },
  task: { select: { id: true, title: true } },
} satisfies Prisma.ClinicNoteSelect

export async function GET(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const q = req.nextUrl.searchParams
  const clinicId = q.get("clinicId")
  if (clinicId && !canAccessClinic(g.actor, clinicId)) return forbidden()
  const where: Prisma.ClinicNoteWhereInput = { deletedAt: null, ...(clinicId ? { clinicId } : clinicWhere(g.actor)) }
  const month = q.get("month")
  if (isMonth(month)) {
    const { start, next } = monthRange(month)
    where.occurredAt = { gte: new Date(start.getTime() - KST_MS), lt: new Date(next.getTime() - KST_MS) }
  }
  const rows = await prisma.clinicNote.findMany({ where, select, orderBy: { occurredAt: "desc" }, take: 300 })
  return NextResponse.json({ notes: rows })
}

export async function POST(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const b = await req.json().catch(() => null)
  if (!b) return fail("잘못된 요청")
  const clinicId = String(b.clinicId ?? "")
  if (!clinicId || !canAccessClinic(g.actor, clinicId)) return forbidden()
  const body = str(b.body, 5000)
  if (!body) return fail("내용을 입력하세요")
  const occurredAt = b.occurredAt ? new Date(b.occurredAt) : new Date()
  if (isNaN(occurredAt.getTime())) return fail("날짜가 잘못되었습니다")
  const taskId = str(b.taskId, 40)
  if (taskId && !(await prisma.task.findFirst({ where: { id: taskId, clinicId }, select: { id: true } }))) return fail("업무를 찾을 수 없습니다")
  const row = await prisma.clinicNote.create({
    data: {
      clinicId,
      kind: KINDS.includes(b.kind) ? b.kind : "OTHER",
      title: str(b.title, 200),
      body,
      occurredAt,
      taskId,
      authorUserId: g.actor.id,
    },
    select,
  })
  return NextResponse.json(row, { status: 201 })
}
