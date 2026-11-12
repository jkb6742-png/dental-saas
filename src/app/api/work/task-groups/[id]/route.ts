import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessTask } from "@/lib/requests/access"
import { guard, fail, str } from "@/lib/work/common"

// 그룹 이름 바꾸기·순서·삭제. 삭제하면 안의 업무는 '그룹 없음'으로 남는다(업무는 지우지 않음).

type Ctx = { params: Promise<{ id: string }> }

type Loaded = { res: Response } | { res?: undefined; actor: import("@/lib/requests/access").Actor; row: import("@prisma/client").TaskGroup }

async function load(id: string): Promise<Loaded> {
  const g = await guard()
  if (!g.actor) return { res: g.res! }
  const row = await prisma.taskGroup.findUnique({ where: { id } })
  if (!row || row.archivedAt || !canAccessTask(g.actor, row.clinicId)) return { res: fail("그룹을 찾을 수 없습니다", 404) }
  return { actor: g.actor, row }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const r = await load((await params).id)
  if (!("row" in r)) return r.res
  const b = await req.json().catch(() => ({}))
  const data: { name?: string; sortOrder?: number } = {}
  if (b.name !== undefined) {
    const name = str(b.name, 60)
    if (!name) return fail("그룹 이름을 입력하세요")
    data.name = name
  }
  // 위·아래로 한 칸: { move: -1 | 1 } → 이웃 그룹과 순서 교환
  if (b.move === -1 || b.move === 1) {
    const sibs = await prisma.taskGroup.findMany({ where: { clinicId: r.row.clinicId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } })
    const i = sibs.findIndex((s) => s.id === r.row.id)
    const j = i + b.move
    if (j >= 0 && j < sibs.length) {
      const order = sibs.map((s) => s.id)
      ;[order[i], order[j]] = [order[j], order[i]]
      await prisma.$transaction(order.map((id, k) => prisma.taskGroup.update({ where: { id }, data: { sortOrder: k + 1 } })))
    }
  }
  const row = Object.keys(data).length ? await prisma.taskGroup.update({ where: { id: r.row.id }, data }) : r.row
  return NextResponse.json({ id: row.id, name: row.name })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const r = await load((await params).id)
  if (!("row" in r)) return r.res
  await prisma.$transaction([
    prisma.task.updateMany({ where: { groupId: r.row.id }, data: { groupId: null } }),
    prisma.taskGroup.delete({ where: { id: r.row.id } }),
  ])
  return NextResponse.json({ ok: true })
}
