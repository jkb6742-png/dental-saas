import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard } from "@/lib/work/common"

// 대화 상대 목록: 승인된 직원·대표만(원장 제외)
export async function GET() {
  const g = await guard()
  if ("res" in g) return g.res
  const people = await prisma.user.findMany({
    where: { role: { in: ["MASTER", "STAFF"] }, status: "APPROVED", id: { not: g.actor.id }, OR: [{ role: "MASTER" }, { employee: { OR: [{ leftOn: null }, { leftOn: { gt: new Date() } }] } }] },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json({ people })
}
