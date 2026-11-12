import { prisma } from "@/lib/db"
import { monthRange, shiftMonth, kstToday, dateOnly, ymdOf } from "@/lib/work/common"
import { billingState, BILLING_STATE_LABEL, type BillingState } from "@/lib/work/billing"
import { monthQuota, type QuotaRow } from "@/lib/work/contracts"
import { SALES_STAGE_LABEL } from "@/lib/work/sales"

// 경영 대시보드(/work/exec) 집계. 서버 전용. 대표(MASTER)만 호출한다.
// 금액 기준: 매출은 부가세 제외(VAT 별도 계약은 청구액 ÷ 1.1), 입금·미수금은 실제 받을 돈(청구액 그대로).

export type ExecData = {
  month: string
  today: string
  hasBilling: boolean
  kpi: {
    revenue: number // 부가세 제외
    revenueGross: number // 청구액 합
    revenueCount: number
    received: number
    receivedCount: number
    outstanding: number
    outstandingCount: number
    expiring: number
    payrollMonthly: number
    payrollHeadcount: number
    laborRatio: number | null // 0~1, 매출 0이면 null
  }
  trend: { month: string; label: string; revenue: number; received: number; outstanding: number }[]
  aging: { key: "d30" | "d60" | "d61"; label: string; amount: number; count: number }[]
  clinics: {
    clinicId: string
    name: string
    planName: string | null
    monthlyFee: number | null // 부가세 제외 월 금액
    vatNote: string | null
    billState: BillingState | null
    billLabel: string
    billAmount: number | null
    paid: number
    quotaDone: number
    quotaTarget: number
  }[]
  expiringContracts: { id: string; clinicName: string; planName: string; endsOn: string; daysLeft: number }[]
  overdue: { id: string; clinicName: string; serviceMonth: string; dueOn: string; daysOver: number; remaining: number }[]
  sales: { stage: string; label: string; count: number; expected: number; items: { id: string; name: string; expected: number | null; nextActionOn: string | null }[] }[]
}

const DAY = 86400_000
/** 청구액 → 부가세 제외. VAT 별도(EXCLUDED)는 청구 때 10%를 더했고, VAT 포함(INCLUDED)은 금액 안에 들어 있다. 미확인은 그대로. */
const net = (amountDue: number, vat: string) => (vat === "EXCLUDED" || vat === "INCLUDED" ? Math.round(amountDue / 1.1) : amountDue)
/** 계약 월 금액 → 부가세 제외. VAT 별도 계약 금액은 이미 공급가. */
const feeNet = (fee: number, vat: string) => (vat === "INCLUDED" ? Math.round(fee / 1.1) : fee)
const monthLabel = (m: string) => `${Number(m.slice(5, 7))}월`

export async function loadExecData(actorId: string, month: string): Promise<ExecData> {
  const today = kstToday()
  const t = dateOnly(today)
  const me = await prisma.user.findUnique({ where: { id: actorId }, select: { agencyId: true } })
  const agencyId = me?.agencyId ?? "__none__"
  const clinics = await prisma.clinic.findMany({ where: { agencyId }, select: { id: true, name: true }, orderBy: { name: "asc" } })
  const clinicIds = clinics.map((c) => c.id)
  const { start, next } = monthRange(month)

  const [cycles, receiptsInMonth, contracts, employees, salesRows] = await Promise.all([
    prisma.billingCycle.findMany({
      where: { clinicId: { in: clinicIds }, voidedAt: null },
      select: {
        id: true,
        clinicId: true,
        contractId: true,
        serviceMonth: true,
        dueOn: true,
        amountDueKrw: true,
        billedAt: true,
        voidedAt: true,
        contract: { select: { vatTreatment: true } },
        receipts: { select: { receivedOn: true, amountKrw: true } },
      },
    }),
    prisma.paymentReceipt.findMany({
      where: { clinicId: { in: clinicIds }, receivedOn: { gte: start, lt: next }, billingCycle: { voidedAt: null } },
      select: { amountKrw: true },
    }),
    prisma.clinicContract.findMany({
      where: { clinicId: { in: clinicIds }, status: "ACTIVE" },
      select: { id: true, clinicId: true, planName: true, monthlyFeeKrw: true, vatTreatment: true, startsOn: true, endsOn: true },
      orderBy: { startsOn: "desc" },
    }),
    prisma.employee.findMany({
      where: { user: { agencyId }, OR: [{ leftOn: null }, { leftOn: { gt: t } }] },
      select: { userId: true, salaries: { where: { effectiveOn: { lte: t } }, orderBy: { effectiveOn: "desc" }, take: 1, select: { annualSalary: true } } },
    }),
    prisma.salesOpportunity.findMany({
      where: { stage: { notIn: ["WON", "LOST"] }, OR: [{ clinicId: null }, { clinicId: { in: clinicIds } }] },
      select: { id: true, clinicName: true, stage: true, expectedMonthlyFeeKrw: true, nextActionOn: true },
      orderBy: [{ nextActionOn: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    }),
  ])

  const paidOf = (c: (typeof cycles)[number], until?: Date) =>
    c.receipts.filter((r) => !until || r.receivedOn < until).reduce((s, r) => s + r.amountKrw, 0)
  // 청구된 것으로 보는 시점: 청구 처리했거나 입금 예정일이 지남
  const isBilled = (c: (typeof cycles)[number], asOf: Date) => (c.billedAt && c.billedAt < asOf) || c.dueOn < asOf

  // 1. KPI
  const monthCycles = cycles.filter((c) => ymdOf(c.serviceMonth)!.slice(0, 7) === month)
  const revenue = monthCycles.reduce((s, c) => s + net(c.amountDueKrw, c.contract.vatTreatment), 0)
  const revenueGross = monthCycles.reduce((s, c) => s + c.amountDueKrw, 0)
  const received = receiptsInMonth.reduce((s, r) => s + r.amountKrw, 0)

  const tomorrow = new Date(t.getTime() + DAY)
  const open = cycles
    .filter((c) => isBilled(c, tomorrow))
    .map((c) => ({ c, remaining: Math.max(0, c.amountDueKrw - paidOf(c)) }))
    .filter((x) => x.remaining > 0)
  const outstanding = open.reduce((s, x) => s + x.remaining, 0)

  const in30 = new Date(t.getTime() + 30 * DAY)
  const expiringList = contracts.filter((c) => c.endsOn && c.endsOn >= t && c.endsOn <= in30)

  const salaries = employees.map((e) => e.salaries[0]?.annualSalary).filter((v): v is number => typeof v === "number")
  const payrollMonthly = Math.round(salaries.reduce((s, v) => s + v, 0) / 12)

  // 2. 추이: 최근 6개월(선택 월 포함). 미수금은 그 달 말 기준.
  const trend = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((m) => {
    const r = monthRange(m)
    const end = r.next.getTime() > tomorrow.getTime() ? tomorrow : r.next
    const rev = cycles.filter((c) => ymdOf(c.serviceMonth)!.slice(0, 7) === m).reduce((s, c) => s + net(c.amountDueKrw, c.contract.vatTreatment), 0)
    const rec = cycles.reduce((s, c) => s + c.receipts.filter((x) => x.receivedOn >= r.start && x.receivedOn < r.next).reduce((a, x) => a + x.amountKrw, 0), 0)
    const out =
      r.start > t ? 0 : cycles.filter((c) => isBilled(c, end)).reduce((s, c) => s + Math.max(0, c.amountDueKrw - paidOf(c, end)), 0)
    return { month: m, label: monthLabel(m), revenue: rev, received: rec, outstanding: out }
  })

  // 3. 미수금 경과(입금 예정일 기준, 예정일 전 청구분은 30일 이내에 포함)
  const aging: ExecData["aging"] = [
    { key: "d30", label: "30일 이내", amount: 0, count: 0 },
    { key: "d60", label: "31~60일", amount: 0, count: 0 },
    { key: "d61", label: "61일 이상", amount: 0, count: 0 },
  ]
  for (const x of open) {
    const age = Math.round((t.getTime() - x.c.dueOn.getTime()) / DAY)
    const b = aging[age <= 30 ? 0 : age <= 60 ? 1 : 2]
    b.amount += x.remaining
    b.count += 1
  }

  // 4. 치과별 표
  const clinicName = new Map(clinics.map((c) => [c.id, c.name]))
  const clinicRows = await Promise.all(
    clinics.map(async (cl) => {
      const contract =
        contracts.find((c) => c.clinicId === cl.id && c.startsOn < next && (!c.endsOn || c.endsOn >= start)) ??
        contracts.find((c) => c.clinicId === cl.id) ??
        null
      const cyc = monthCycles.filter((c) => c.clinicId === cl.id)
      const billAmount = cyc.length ? cyc.reduce((s, c) => s + c.amountDueKrw, 0) : null
      const paid = cyc.reduce((s, c) => s + paidOf(c), 0)
      let state: BillingState | null = null
      if (cyc.length) {
        // 여러 건이면 가장 급한 상태
        const order: BillingState[] = ["OVERDUE", "PARTIAL", "DUE", "PLANNED", "PAID", "VOID"]
        const states = cyc.map((c) => billingState(c, paidOf(c), today))
        state = order.find((s) => states.includes(s)) ?? null
      }
      const quota: QuotaRow[] = await monthQuota(cl.id, month).catch(() => [])
      return {
        clinicId: cl.id,
        name: cl.name,
        planName: contract?.planName ?? null,
        monthlyFee: contract ? feeNet(contract.monthlyFeeKrw, contract.vatTreatment) : null,
        vatNote: contract ? (contract.vatTreatment === "EXCLUDED" ? "VAT 별도" : contract.vatTreatment === "INCLUDED" ? "VAT 포함가에서 제외" : "VAT 미확인") : null,
        billState: state,
        billLabel: state ? BILLING_STATE_LABEL[state] : contract ? "청구 없음" : "-",
        billAmount,
        paid,
        quotaDone: quota.reduce((s, q) => s + Math.min(q.done, q.target), 0),
        quotaTarget: quota.reduce((s, q) => s + q.target, 0),
      }
    })
  )
  clinicRows.sort((a, b) => Number(!!b.planName) - Number(!!a.planName) || (b.monthlyFee ?? 0) - (a.monthlyFee ?? 0) || a.name.localeCompare(b.name, "ko"))

  // 5. 대표 확인
  const expiringContracts = expiringList
    .map((c) => ({
      id: c.id,
      clinicName: clinicName.get(c.clinicId) ?? "",
      planName: c.planName,
      endsOn: ymdOf(c.endsOn)!,
      daysLeft: Math.round((c.endsOn!.getTime() - t.getTime()) / DAY),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
  const overdue = open
    .filter((x) => ymdOf(x.c.dueOn)! < today)
    .map((x) => ({
      id: x.c.id,
      clinicName: clinicName.get(x.c.clinicId) ?? "",
      serviceMonth: ymdOf(x.c.serviceMonth)!.slice(0, 7),
      dueOn: ymdOf(x.c.dueOn)!,
      daysOver: Math.round((t.getTime() - x.c.dueOn.getTime()) / DAY),
      remaining: x.remaining,
    }))
    .sort((a, b) => b.daysOver - a.daysOver)
  const stageOrder = ["NEGOTIATION", "PROPOSAL", "MEETING", "CONTACTED", "NEW"] as const
  const sales = stageOrder
    .map((st) => {
      const items = salesRows.filter((r) => r.stage === st)
      return {
        stage: st,
        label: SALES_STAGE_LABEL[st],
        count: items.length,
        expected: items.reduce((s, r) => s + (r.expectedMonthlyFeeKrw ?? 0), 0),
        items: items.map((r) => ({ id: r.id, name: r.clinicName, expected: r.expectedMonthlyFeeKrw, nextActionOn: ymdOf(r.nextActionOn) })),
      }
    })
    .filter((g) => g.count > 0)

  return {
    month,
    today,
    hasBilling: cycles.length > 0,
    kpi: {
      revenue,
      revenueGross,
      revenueCount: monthCycles.length,
      received,
      receivedCount: receiptsInMonth.length,
      outstanding,
      outstandingCount: open.length,
      expiring: expiringList.length,
      payrollMonthly,
      payrollHeadcount: salaries.length,
      laborRatio: revenue > 0 ? payrollMonthly / revenue : null,
    },
    trend,
    aging,
    clinics: clinicRows,
    expiringContracts,
    overdue,
    sales,
  }
}
