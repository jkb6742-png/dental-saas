import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail } from "@/lib/work/common"
import { generateQuotaTasks } from "@/lib/work/contracts"

type Ctx = { params: Promise<{ id: string }> }

// 월 목표 수만큼 업무 만들기(담당 직원 누구나). 이미 만든 순번은 건너뛴다.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const c = await prisma.monthlyCommitment.findUnique({ where: { id: (await params).id }, select: { id: true, clinicId: true } })
  if (!c) return fail("찾을 수 없습니다", 404)
  const g = await guard({ clinicId: c.clinicId })
  if ("res" in g) return g.res
  const created = await generateQuotaTasks(c.id, g.actor.id)
  return NextResponse.json({ created })
}
