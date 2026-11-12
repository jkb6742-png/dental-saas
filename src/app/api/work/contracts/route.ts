import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, audit } from "@/lib/work/common"
import { parseContract } from "@/lib/work/contracts"

// 계약 관리(마스터 전용). 금액이 들어 있어 직원에게는 열지 않는다.


export async function GET(req: NextRequest) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const clinicId = req.nextUrl.searchParams.get("clinicId")
  const rows = await prisma.clinicContract.findMany({
    where: clinicId ? { clinicId } : {},
    include: { clinic: { select: { name: true } }, lines: { orderBy: { kind: "asc" } } },
    orderBy: [{ status: "asc" }, { startsOn: "desc" }],
  })
  return NextResponse.json({ contracts: rows })
}

export async function POST(req: NextRequest) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const b = await req.json().catch(() => null)
  if (!b) return fail("잘못된 요청")
  const clinic = await prisma.clinic.findUnique({ where: { id: String(b.clinicId ?? "") }, select: { id: true } })
  if (!clinic) return fail("치과를 고르세요")
  const p = parseContract(b)
  if ("error" in p) return fail(p.error!)
  const row = await prisma.clinicContract.create({
    data: {
      ...(p.data as any),
      clinicId: clinic.id,
      creatorUserId: g.actor.id,
      lines: p.lines?.length ? { create: p.lines } : undefined,
    },
    include: { lines: true },
  })
  await audit(g.actor.id, "CONTRACT_CREATED", clinic.id, { contractId: row.id, planName: row.planName, fee: row.monthlyFeeKrw })
  return NextResponse.json(row, { status: 201 })
}
