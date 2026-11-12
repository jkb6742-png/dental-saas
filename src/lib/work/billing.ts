import { prisma } from "@/lib/db"
import { createNotifications } from "@/lib/notifications"
import { monthRange, dayInMonth, shiftMonth, kstToday, dateOnly, ymdOf } from "./common"

// 청구·입금. 청구는 진행 중 계약에서 달마다 한 번(계약·대상월 유일). 금액은 만들 때 고정.

export type BillingState = "VOID" | "PAID" | "PARTIAL" | "OVERDUE" | "DUE" | "PLANNED"
export const BILLING_STATE_LABEL: Record<BillingState, string> = {
  VOID: "취소",
  PAID: "입금 완료",
  PARTIAL: "일부 입금",
  OVERDUE: "연체",
  DUE: "입금 대기",
  PLANNED: "청구 전",
}

/** 그 달 청구 행을 만든다. 청구일이 없는 계약은 건너뛴다. VAT 별도 계약은 10%를 더한다. */
export async function ensureBillingCycles(month: string) {
  const { start, next } = monthRange(month)
  const contracts = await prisma.clinicContract.findMany({
    // 월 금액이 0(미입력)인 계약은 청구를 만들지 않는다(금액은 만들 때 고정되므로 0원 청구가 남지 않게)
    where: { status: "ACTIVE", billDayOfMonth: { not: null }, monthlyFeeKrw: { gt: 0 }, startsOn: { lt: next }, OR: [{ endsOn: null }, { endsOn: { gte: start } }] },
  })
  if (!contracts.length) return 0
  const r = await prisma.billingCycle.createMany({
    data: contracts.map((c) => ({
      clinicId: c.clinicId,
      contractId: c.id,
      serviceMonth: start,
      plannedBillOn: dayInMonth(month, c.billDayOfMonth!),
      dueOn: dayInMonth(shiftMonth(month, c.paymentDueMonthOffset), c.paymentDueDay ?? c.billDayOfMonth!),
      amountDueKrw: c.vatTreatment === "EXCLUDED" ? Math.round(c.monthlyFeeKrw * 1.1) : c.monthlyFeeKrw,
    })),
    skipDuplicates: true,
  })
  return r.count
}

export function billingState(c: { voidedAt: Date | null; billedAt: Date | null; dueOn: Date; amountDueKrw: number }, paid: number, today = kstToday()): BillingState {
  if (c.voidedAt) return "VOID"
  if (paid >= c.amountDueKrw) return "PAID"
  if (ymdOf(c.dueOn)! < today) return "OVERDUE"
  if (paid > 0) return "PARTIAL"
  return c.billedAt ? "DUE" : "PLANNED"
}

const DUE_OFFSETS: [number, string][] = [
  [3, "입금 예정 3일 전"],
  [0, "오늘 입금 예정"],
  [-1, "입금 예정일 하루 지남"],
  [-7, "입금 예정일 7일 지남"],
]

/** 결제일 알림: 입금 예정 D-3·당일·D+1·D+7, 청구일 당일. 마스터에게만. 같은 알림은 한 번만. */
export async function runBillingAlerts() {
  const today = kstToday()
  const t = dateOnly(today)
  const masters = (await prisma.user.findMany({ where: { role: "MASTER", status: "APPROVED" }, select: { id: true } })).map((u) => u.id)
  if (!masters.length) return 0
  const cycles = await prisma.billingCycle.findMany({
    where: { voidedAt: null, OR: [{ dueOn: { gte: new Date(t.getTime() - 8 * 86400_000), lte: new Date(t.getTime() + 4 * 86400_000) } }, { plannedBillOn: t, billedAt: null }] },
    include: { clinic: { select: { name: true } }, receipts: { select: { amountKrw: true } } },
  })
  let sent = 0
  for (const c of cycles) {
    const paid = c.receipts.reduce((s, r) => s + r.amountKrw, 0)
    const month = Number(ymdOf(c.serviceMonth)!.slice(5, 7))
    if (!c.billedAt && ymdOf(c.plannedBillOn) === today) {
      sent += await createNotifications({
        type: "BILLING_DUE",
        title: `${c.clinic.name} ${month}월 청구일입니다 (${c.amountDueKrw.toLocaleString("ko-KR")}원)`,
        body: "청구와 세금계산서 발행을 확인하세요.",
        link: `/work/billing?month=${ymdOf(c.serviceMonth)!.slice(0, 7)}`,
        clinicId: c.clinicId,
        audience: "masters",
        userIds: masters,
        dedupKey: `bill:${c.id}`,
      })
    }
    if (paid >= c.amountDueKrw) continue
    const days = Math.round((c.dueOn.getTime() - t.getTime()) / 86400_000)
    const hit = DUE_OFFSETS.find(([d]) => d === days)
    if (!hit) continue
    sent += await createNotifications({
      type: "BILLING_DUE",
      title: `${c.clinic.name} ${month}월 ${hit[1]}`,
      body: `미입금 ${(c.amountDueKrw - paid).toLocaleString("ko-KR")}원 · 예정일 ${ymdOf(c.dueOn)}`,
      link: `/work/billing?month=${ymdOf(c.serviceMonth)!.slice(0, 7)}`,
      clinicId: c.clinicId,
      audience: "masters",
      userIds: masters,
      dedupKey: `due:${c.id}:${days}`,
    })
  }
  return sent
}
