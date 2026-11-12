import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, audit } from "@/lib/work/common"
import { parseContract } from "@/lib/work/contracts"

type Ctx = { params: Promise<{ id: string }> }

// 계약 수정(마스터). 서비스 분량을 주면 그 목록으로 맞춘다. 이미 만든 지난 월 목표는 바뀌지 않는다.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const c = await prisma.clinicContract.findUnique({ where: { id: (await params).id }, include: { lines: true } })
  if (!c) return fail("찾을 수 없습니다", 404)
  const b = await req.json().catch(() => ({}))
  const p = parseContract(b, true)
  if ("error" in p) return fail(p.error!)

  const row = await prisma.$transaction(async (tx) => {
    await tx.clinicContract.update({ where: { id: c.id }, data: p.data as any })
    if (p.lines) {
      const keep = new Set(p.lines.map((l) => l.kind))
      for (const old of c.lines) if (!keep.has(old.kind)) await tx.contractLine.delete({ where: { id: old.id } })
      for (const l of p.lines) {
        await tx.contractLine.upsert({
          where: { contractId_kind: { contractId: c.id, kind: l.kind } },
          create: { ...l, contractId: c.id, clinicId: c.clinicId },
          update: { monthlyTarget: l.monthlyTarget, defaultDueDay: l.defaultDueDay },
        })
      }
    }
    return tx.clinicContract.findUniqueOrThrow({ where: { id: c.id }, include: { lines: true, clinic: { select: { name: true } } } })
  })
  await audit(g.actor.id, "CONTRACT_UPDATED", c.clinicId, { contractId: c.id, fields: Object.keys(p.data), lines: p.lines?.length })
  return NextResponse.json(row)
}
