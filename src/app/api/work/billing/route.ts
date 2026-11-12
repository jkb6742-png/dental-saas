import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, isMonth, currentMonth, monthRange } from "@/lib/work/common"
import { ensureBillingCycles, billingState } from "@/lib/work/billing"

// 월별 청구·입금 현황(마스터 전용). 처음 열 때 진행 중 계약으로 청구 행을 만든다.
export async function GET(req: NextRequest) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const month = req.nextUrl.searchParams.get("month") ?? currentMonth()
  if (!isMonth(month)) return fail("월 형식이 잘못되었습니다")
  await ensureBillingCycles(month)
  const rows = await prisma.billingCycle.findMany({
    where: { serviceMonth: monthRange(month).start },
    include: {
      clinic: { select: { name: true } },
      contract: { select: { planName: true, vatTreatment: true } },
      receipts: { orderBy: { receivedOn: "asc" }, include: { recordedBy: { select: { name: true } } } },
    },
    orderBy: { dueOn: "asc" },
  })
  return NextResponse.json({
    month,
    cycles: rows.map((c) => {
      const paid = c.receipts.reduce((s, r) => s + r.amountKrw, 0)
      return { ...c, paid, state: billingState(c, paid) }
    }),
  })
}
