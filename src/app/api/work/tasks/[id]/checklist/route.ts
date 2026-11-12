import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { fail, str } from "@/lib/work/common"
import { itemSelect, listItems, loadTask } from "./shared"

// 업무 체크리스트(하위 단계: 원고 → 내부 확인 → 원장 검수 → 발행)
//  GET                       { items }
//  POST  { title }           항목 추가(맨 아래) → 항목
//  PATCH { order: string[] } 순서 다시 매기기 → { items }

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const r = await loadTask((await params).id)
  if ("res" in r) return r.res
  return NextResponse.json({ items: await listItems(r.task.id) })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const r = await loadTask((await params).id)
  if ("res" in r) return r.res
  const b = await req.json().catch(() => ({}))
  const title = str(b.title, 200)
  if (!title) return fail("항목 이름을 입력하세요")
  const agg = await prisma.taskChecklistItem.aggregate({ where: { taskId: r.task.id }, _max: { sortOrder: true }, _count: true })
  if (agg._count >= 50) return fail("체크리스트는 50개까지입니다")
  const item = await prisma.taskChecklistItem.create({
    data: { taskId: r.task.id, title, sortOrder: (agg._max.sortOrder ?? 0) + 1 },
    select: itemSelect,
  })
  return NextResponse.json(item, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const r = await loadTask((await params).id)
  if ("res" in r) return r.res
  const b = await req.json().catch(() => ({}))
  if (!Array.isArray(b.order)) return fail("순서를 보내세요")
  const cur = await listItems(r.task.id)
  const known = new Set(cur.map((i) => i.id))
  const order = Array.from(new Set((b.order as unknown[]).filter((x): x is string => typeof x === "string" && known.has(x))))
  // 빠진 항목은 원래 순서대로 뒤에
  for (const i of cur) if (!order.includes(i.id)) order.push(i.id)
  await prisma.$transaction(order.map((id, k) => prisma.taskChecklistItem.update({ where: { id }, data: { sortOrder: k + 1 } })))
  return NextResponse.json({ items: await listItems(r.task.id) })
}
