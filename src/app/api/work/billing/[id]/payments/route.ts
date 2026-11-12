import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, isYmd, dateOnly, kstToday, audit, str } from "@/lib/work/common"

type Ctx = { params: Promise<{ id: string }> }

// 입금 기록(마스터). 부분 입금은 여러 번 넣는다.
export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const c = await prisma.billingCycle.findUnique({ where: { id: (await params).id } })
  if (!c) return fail("찾을 수 없습니다", 404)
  const b = await req.json().catch(() => ({}))
  const amount = Number(b.amountKrw)
  if (!Number.isInteger(amount) || amount <= 0) return fail("입금액을 입력하세요")
  const on = b.receivedOn ?? kstToday()
  if (!isYmd(on)) return fail("입금일이 잘못되었습니다")
  const row = await prisma.paymentReceipt.create({
    data: { clinicId: c.clinicId, billingCycleId: c.id, receivedOn: dateOnly(on), amountKrw: amount, memo: str(b.memo, 300), recordedByUserId: g.actor.id },
  })
  await audit(g.actor.id, "PAYMENT_RECORDED", c.clinicId, { billingId: c.id, paymentId: row.id, amount, on })
  return NextResponse.json(row, { status: 201 })
}

// 잘못 넣은 입금 삭제 (?paymentId=)
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const id = (await params).id
  const pid = req.nextUrl.searchParams.get("paymentId") ?? ""
  const p = await prisma.paymentReceipt.findFirst({ where: { id: pid, billingCycleId: id } })
  if (!p) return fail("찾을 수 없습니다", 404)
  await prisma.paymentReceipt.delete({ where: { id: p.id } })
  await audit(g.actor.id, "PAYMENT_DELETED", p.clinicId, { billingId: id, paymentId: p.id, amount: p.amountKrw })
  return NextResponse.json({ ok: true })
}
