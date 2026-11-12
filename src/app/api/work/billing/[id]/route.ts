import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { guard, fail, isYmd, dateOnly, audit, str } from "@/lib/work/common"

type Ctx = { params: Promise<{ id: string }> }

// 청구 처리(마스터): 청구함·세금계산서 발행·금액·예정일·취소·메모
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const c = await prisma.billingCycle.findUnique({ where: { id: (await params).id } })
  if (!c) return fail("찾을 수 없습니다", 404)
  const b = await req.json().catch(() => ({}))
  const data: Prisma.BillingCycleUncheckedUpdateInput = {}
  if (b.billed !== undefined) data.billedAt = b.billed ? c.billedAt ?? new Date() : null
  if (b.taxInvoice !== undefined) {
    if (b.taxInvoice) {
      data.taxInvoiceIssuedAt = c.taxInvoiceIssuedAt ?? new Date()
      data.taxInvoiceNumber = str(b.taxInvoiceNumber, 60) ?? c.taxInvoiceNumber
      data.taxCheckedByUserId = g.actor.id
    } else {
      data.taxInvoiceIssuedAt = null
      data.taxInvoiceNumber = null
      data.taxCheckedByUserId = null
    }
  }
  if (b.amountDueKrw !== undefined) {
    const v = Number(b.amountDueKrw)
    if (!Number.isInteger(v) || v < 0) return fail("금액이 잘못되었습니다")
    data.amountDueKrw = v
  }
  if (b.dueOn !== undefined) {
    if (!isYmd(b.dueOn)) return fail("입금 예정일이 잘못되었습니다")
    data.dueOn = dateOnly(b.dueOn)
  }
  if (b.void !== undefined) data.voidedAt = b.void ? new Date() : null
  if (b.memo !== undefined) data.memo = str(b.memo, 300)
  const row = await prisma.billingCycle.update({ where: { id: c.id }, data })
  await audit(g.actor.id, "BILLING_UPDATED", c.clinicId, { billingId: c.id, fields: Object.keys(data) })
  return NextResponse.json(row)
}
