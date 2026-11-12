import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail } from "@/lib/work/common"
import { parseSales } from "@/lib/work/sales"

// 영업 기회 목록·등록(대표 전용)
export async function GET() {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const rows = await prisma.salesOpportunity.findMany({
    include: { owner: { select: { name: true } }, clinic: { select: { name: true } } },
    orderBy: [{ nextActionOn: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
  })
  return NextResponse.json({ items: rows })
}

export async function POST(req: NextRequest) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const p = parseSales(await req.json().catch(() => ({})))
  if ("error" in p) return fail(p.error!)
  const row = await prisma.salesOpportunity.create({ data: { ...(p.data as any), ownerUserId: (p.data.ownerUserId as string) ?? g.actor.id } })
  return NextResponse.json(row, { status: 201 })
}
