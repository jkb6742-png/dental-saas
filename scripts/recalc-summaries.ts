/**
 * MonthlySummary 재계산 (매출 정의 확정본과 동일: 매출 = sum(DailyLedger.totalIncome), 없으면 접수수납 청구액)
 * 실행: npx tsx scripts/recalc-summaries.ts [clinicId]
 * src/lib/analytics/monthly.ts 의 recalcMonthlySummary 와 동일 로직 (해당 파일은 @/ 별칭 때문에 tsx 직접 임포트 불가).
 */
import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const DEFAULT_CLINIC = "cmqalpa2j0001dflwapu9its8" // 중산사과나무치과

async function recalc(clinicId: string, year: number, month: number) {
  const [ledgers, patients, treatmentStats, plans, receptionRecords] = await Promise.all([
    prisma.dailyLedger.findMany({ where: { clinicId, year, month } }),
    prisma.patientStat.findMany({ where: { clinicId, year, month } }),
    prisma.treatmentStat.findMany({ where: { clinicId, year, month } }),
    prisma.treatmentPlan.findMany({ where: { clinicId, year, month } }),
    prisma.receptionRecord.findMany({ where: { clinicId, year, month, totalRevenue: { gt: 0 } } }),
  ])
  if (ledgers.length === 0 && patients.length === 0 && treatmentStats.length === 0 && receptionRecords.length === 0) return null

  const cashIncome = ledgers.reduce((s, l) => s + (l.cashIncome ?? 0), 0)
  const cardIncome = ledgers.reduce((s, l) => s + (l.cardIncome ?? 0), 0)
  const onlineIncome = ledgers.reduce((s, l) => s + (l.onlineIncome ?? 0), 0)
  const insuranceClaim = ledgers.reduce((s, l) => s + (l.insuranceClaim ?? 0), 0)
  const totalBilledRevenue = receptionRecords.reduce((s, r) => s + (r.totalRevenue ?? 0), 0)
  // 매출=청구포함총수입=현금+카드+온라인+공단부담(청구액). 월간장부 없으면 청구액.
  const ledgerRevenue = cashIncome + cardIncome + onlineIncome + insuranceClaim
  const totalRevenue = ledgers.length > 0 ? ledgerRevenue : totalBilledRevenue
  const newPatientRevenue = receptionRecords.filter(r => r.patientType === "신환").reduce((s, r) => s + (r.totalRevenue ?? 0), 0)

  const workingDays = ledgers.length > 0 ? ledgers.length : 1
  const avgDailyRevenue = workingDays > 0 ? totalRevenue / workingDays : 0
  const totalExpense = ledgers.reduce((s, l) => s + (l.totalExpense ?? 0), 0)
  const netProfit = totalRevenue - totalExpense
  const nonInsuranceRevenue = treatmentStats.filter(t => t.category === "NON_INSURANCE").reduce((s, t) => s + (t.revenue ?? 0), 0)
  const nonInsuranceRatio = totalRevenue > 0 ? (nonInsuranceRevenue / totalRevenue) * 100 : null

  const hasRec = receptionRecords.length > 0
  const newPatients = hasRec
    ? receptionRecords.filter(r => r.patientType === "신환").length
    : (patients.length > 0 ? Math.round(patients.reduce((s, p) => s + (p.newPatients ?? 0), 0)) : null)
  const totalPatients = hasRec
    ? receptionRecords.length
    : (patients.length > 0 ? Math.round(patients.reduce((s, p) => s + (p.totalVisits ?? 0), 0)) : null)
  const revisitRate = (totalPatients && totalPatients > 0 && newPatients !== null) ? ((totalPatients - newPatients) / totalPatients) * 100 : null

  const totalArrears = plans.filter(p => p.paymentStatus === "INCOMPLETE").reduce((s, p) => s + (p.remainingAmount ?? 0), 0)
  const totalContract = plans.reduce((s, p) => s + (p.contractAmount ?? 0), 0)
  const arrearsRate = totalContract > 0 ? (totalArrears / totalContract) * 100 : null
  const completedPlans = plans.filter(p => p.status === "COMPLETED").length
  const activePlans = plans.filter(p => p.status === "COMPLETED" || p.status === "IN_PROGRESS").length
  const treatmentCompleteRate = activePlans > 0 ? (completedPlans / activePlans) * 100 : null

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prev = await prisma.monthlySummary.findUnique({ where: { clinicId_year_month: { clinicId, year: prevYear, month: prevMonth } } })
  const revenueGrowth = prev?.totalRevenue && prev.totalRevenue > 0 ? ((totalRevenue - prev.totalRevenue) / prev.totalRevenue) * 100 : null
  const newPatientGrowth = prev?.newPatients && prev.newPatients > 0 && newPatients ? ((newPatients - prev.newPatients) / prev.newPatients) * 100 : null

  const payload = {
    clinicId, year, month, totalRevenue, totalExpense, netProfit, cashIncome, cardIncome, insuranceClaim,
    nonInsuranceRevenue, nonInsuranceRatio, newPatients, totalPatients, workingDays, avgDailyRevenue,
    newPatientRevenue, revisitRate, revenueGrowth, newPatientGrowth, totalArrears, arrearsRate,
    treatmentCompleteRate, totalBilledRevenue,
  }
  await prisma.monthlySummary.upsert({
    where: { clinicId_year_month: { clinicId, year, month } }, create: payload, update: payload,
  })
  return { year, month, totalRevenue }
}

async function main() {
  const clinicId = process.argv[2] || DEFAULT_CLINIC
  const url = process.env.DATABASE_URL || ""
  if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error(`안전장치: DATABASE_URL 이 로컬 아님 → ${url}`)

  // DailyLedger + ReceptionRecord 에 존재하는 모든 (year,month)
  const [l, r] = await Promise.all([
    prisma.dailyLedger.groupBy({ by: ["year", "month"], where: { clinicId } }),
    prisma.receptionRecord.groupBy({ by: ["year", "month"], where: { clinicId } }),
  ])
  const set = new Map<string, { year: number; month: number }>()
  for (const x of [...l, ...r]) set.set(`${x.year}-${x.month}`, { year: x.year, month: x.month })
  const months = [...set.values()].sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month))

  console.log(`🔁 재계산: ${clinicId}, ${months.length}개월`)
  for (const { year, month } of months) {
    const res = await recalc(clinicId, year, month)
    if (res) console.log(`  ${res.year}-${String(res.month).padStart(2, "0")}  매출 ${res.totalRevenue.toLocaleString()}`)
  }
  console.log("✅ 완료")
}
main().then(() => prisma.$disconnect()).catch(async e => { console.error("❌", e); await prisma.$disconnect(); process.exit(1) })
