import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessTask } from "@/lib/requests/access"
import { guard, fail, str } from "@/lib/work/common"
const memoSelect = { id: true, body: true, clinicId: true, convertedTaskId: true, archivedAt: true, createdAt: true } as const

// 메모 고치기: { body? , archive?: boolean, convertedTaskId? }
// "업무로 바꾸기"는 화면이 POST /api/work/tasks 로 업무를 만든 뒤 convertedTaskId 를 넘긴다(보관도 같이 된다).

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard()
  if ("res" in g) return g.res
  const { id } = await ctx.params
  const memo = await prisma.workMemo.findUnique({ where: { id }, select: { userId: true } })
  if (!memo || memo.userId !== g.actor.id) return fail("메모를 찾을 수 없습니다", 404)
  const b = await req.json().catch(() => ({}))
  const data: { body?: string; archivedAt?: Date | null; convertedTaskId?: string } = {}
  if (b.body !== undefined) {
    const body = str(b.body, 2000)
    if (!body) return fail("메모 내용을 입력하세요")
    data.body = body
  }
  if (b.archive === true) data.archivedAt = new Date()
  if (b.archive === false) data.archivedAt = null
  if (b.convertedTaskId) {
    const t = await prisma.task.findUnique({ where: { id: String(b.convertedTaskId) }, select: { id: true, clinicId: true } })
    if (!t || !canAccessTask(g.actor, t.clinicId)) return fail("업무를 찾을 수 없습니다", 400)
    data.convertedTaskId = t.id
    data.archivedAt = new Date()
  }
  const row = await prisma.workMemo.update({ where: { id }, data, select: memoSelect })
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard()
  if ("res" in g) return g.res
  const { id } = await ctx.params
  await prisma.workMemo.deleteMany({ where: { id, userId: g.actor.id } })
  return NextResponse.json({ ok: true })
}
