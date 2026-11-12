import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClinic, canAccessTask } from "@/lib/requests/access"
import { guard, fail, str } from "@/lib/work/common"

// 내 고정(별표): 치과·보드·업무. 한 사람 최대 5개.
// CLINIC/BOARD 의 refId 는 clinicId 또는 "internal"(THINKLAB 사내), TASK 는 taskId.

const KINDS = ["CLINIC", "BOARD", "TASK"] as const
type Kind = (typeof KINDS)[number]
const MAX_PINS = 5
const select = { id: true, kind: true, refId: true, label: true, sortOrder: true } as const

export async function GET() {
  const g = await guard()
  if ("res" in g) return g.res
  const pins = await prisma.workPin.findMany({ where: { userId: g.actor.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select })
  return NextResponse.json({ pins })
}

/** 고정 { kind, refId, label } — 이미 있으면 이름만 고친다 */
export async function POST(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const b = await req.json().catch(() => ({}))
  const kind = KINDS.includes(b.kind) ? (b.kind as Kind) : null
  const refId = str(b.refId, 40)
  const label = str(b.label, 100)
  if (!kind || !refId || !label) return fail("고정할 항목을 확인하세요")

  // 볼 수 있는 것만 고정
  if (kind === "TASK") {
    const t = await prisma.task.findUnique({ where: { id: refId }, select: { clinicId: true } })
    if (!t || !canAccessTask(actor, t.clinicId)) return fail("권한이 없습니다", 403)
  } else if (refId !== "internal" && !canAccessClinic(actor, refId)) return fail("권한이 없습니다", 403)

  const where = { userId_kind_refId: { userId: actor.id, kind, refId } }
  const exists = await prisma.workPin.findUnique({ where, select: { id: true } })
  if (exists) {
    const pin = await prisma.workPin.update({ where, data: { label }, select })
    return NextResponse.json(pin)
  }
  const count = await prisma.workPin.count({ where: { userId: actor.id } })
  if (count >= MAX_PINS) return fail(`고정은 ${MAX_PINS}개까지입니다. 하나를 풀고 다시 고정하세요`)
  const last = await prisma.workPin.aggregate({ where: { userId: actor.id }, _max: { sortOrder: true } })
  const pin = await prisma.workPin.create({
    data: { userId: actor.id, kind, refId, label, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    select,
  })
  return NextResponse.json(pin, { status: 201 })
}

/** 고정 풀기 ?id= 또는 ?kind=&refId= */
export async function DELETE(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const q = req.nextUrl.searchParams
  const id = q.get("id")
  const kind = q.get("kind")
  const refId = q.get("refId")
  if (id) await prisma.workPin.deleteMany({ where: { id, userId: g.actor.id } })
  else if (kind && refId) await prisma.workPin.deleteMany({ where: { userId: g.actor.id, kind, refId } })
  else return fail("풀 항목을 확인하세요")
  return NextResponse.json({ ok: true })
}
