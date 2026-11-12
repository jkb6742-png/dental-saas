import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { fail, str } from "@/lib/work/common"
import { itemSelect, loadTask } from "../shared"

// 체크리스트 항목 하나: PATCH { title?, done?, sortOrder? } → 항목 · DELETE → { ok }

type Ctx = { params: Promise<{ id: string; itemId: string }> }

async function loadItem(ctx: Ctx) {
  const { id, itemId } = await ctx.params
  const r = await loadTask(id)
  if ("res" in r) return { res: r.res } as const
  const item = await prisma.taskChecklistItem.findUnique({ where: { id: itemId }, select: { id: true, taskId: true } })
  if (!item || item.taskId !== r.task.id) return { res: fail("항목을 찾을 수 없습니다", 404) } as const
  return { actor: r.actor, item } as const
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const r = await loadItem(ctx)
  if ("res" in r) return r.res
  const b = await req.json().catch(() => ({}))
  const data: { title?: string; doneAt?: Date | null; doneByUserId?: string | null; sortOrder?: number } = {}
  if (b.title !== undefined) {
    const title = str(b.title, 200)
    if (!title) return fail("항목 이름을 입력하세요")
    data.title = title
  }
  if (typeof b.done === "boolean") {
    data.doneAt = b.done ? new Date() : null
    data.doneByUserId = b.done ? r.actor.id : null
  }
  if (typeof b.sortOrder === "number" && Number.isFinite(b.sortOrder)) data.sortOrder = Math.round(b.sortOrder)
  if (!Object.keys(data).length) return fail("바꿀 내용이 없습니다")
  const item = await prisma.taskChecklistItem.update({ where: { id: r.item.id }, data, select: itemSelect })
  return NextResponse.json(item)
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const r = await loadItem(ctx)
  if ("res" in r) return r.res
  await prisma.taskChecklistItem.delete({ where: { id: r.item.id } })
  return NextResponse.json({ ok: true })
}
