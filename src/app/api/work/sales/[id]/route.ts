import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, audit } from "@/lib/work/common"
import { parseSales } from "@/lib/work/sales"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const cur = await prisma.salesOpportunity.findUnique({ where: { id: (await params).id } })
  if (!cur) return fail("찾을 수 없습니다", 404)
  const p = parseSales(await req.json().catch(() => ({})), true)
  if ("error" in p) return fail(p.error!)
  if (p.data.stage === "LOST" && !p.data.lostReason && !cur.lostReason) return fail("무산 사유를 적어 주세요")
  if (p.data.stage === "WON" && cur.stage === "WON") delete p.data.wonAt
  const row = await prisma.salesOpportunity.update({ where: { id: cur.id }, data: p.data as any })
  if (p.data.stage && p.data.stage !== cur.stage) await audit(g.actor.id, "SALES_STAGE_CHANGED", row.clinicId, { id: cur.id, from: cur.stage, to: p.data.stage })
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const id = (await params).id
  await prisma.salesOpportunity.delete({ where: { id } }).catch(() => null)
  return NextResponse.json({ ok: true })
}
