import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, audit, str } from "@/lib/work/common"

type Ctx = { params: Promise<{ id: string }> }

// 그 달 목표 조정(마스터). 사유가 반드시 남는다. 예: 원장 휴가로 이번 달 블로그 6편.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const c = await prisma.monthlyCommitment.findUnique({ where: { id: (await params).id } })
  if (!c) return fail("찾을 수 없습니다", 404)
  const b = await req.json().catch(() => ({}))
  const target = Number(b.targetCount)
  if (!Number.isInteger(target) || target < 0 || target > 200) return fail("목표 수가 잘못되었습니다")
  const reason = str(b.adjustmentReason, 300)
  if (!reason) return fail("조정 사유를 입력하세요")
  const row = await prisma.monthlyCommitment.update({
    where: { id: c.id },
    data: { targetCount: target, adjustmentReason: reason, adjustedByUserId: g.actor.id, adjustedAt: new Date() },
  })
  await audit(g.actor.id, "COMMITMENT_ADJUSTED", c.clinicId, { commitmentId: c.id, from: c.targetCount, to: target, reason })
  return NextResponse.json(row)
}
