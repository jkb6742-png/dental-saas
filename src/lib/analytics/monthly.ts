import { prisma } from "@/lib/db"

export async function recalcMonthlySummary(clinicId: string, year: number, month: number) {
  const [ledgers, patients, treatmentStats, routes, plans] = await Promise.all([
    prisma.dailyLedger.findMany({ where: { clinicId, year, month } }),
    prisma.patientStat.findMany({ where: { clinicId, year, month } }),
    prisma.treatmentStat.findMany({ where: { clinicId, year, month } }),
    prisma.visitRoute.findMany({ where: { clinicId, year, month } }),
    prisma.treatmentPlan.findMany({ where: { clinicId, year, month } }),
  ])

  // 아무 데이터도 없으면 집계하지 않음
  if (ledgers.length === 0 && patients.length === 0 && treatmentStats.length === 0) return

  // Revenue (DailyLedger 기반)
  const totalRevenue = ledgers.reduce((s, l) => s + (l.totalIncome ?? 0), 0)
  const totalExpense = ledgers.reduce((s, l) => s + (l.totalExpense ?? 0), 0)
  const netProfit = ledgers.reduce((s, l) => s + (l.netTotal ?? 0), 0)
  const cashIncome = ledgers.reduce((s, l) => s + (l.cashIncome ?? 0), 0)
  const cardIncome = ledgers.reduce((s, l) => s + (l.cardIncome ?? 0), 0)
  const insuranceClaim = ledgers.reduce((s, l) => s + (l.insuranceClaim ?? 0), 0)
  const workingDays = ledgers.filter((l) => (l.totalIncome ?? 0) > 0).length
  const avgDailyRevenue = workingDays > 0 ? totalRevenue / workingDays : 0

  // 비급여 (TreatmentStat 기반)
  const nonInsuranceRevenue = treatmentStats
    .filter((t) => t.category === "NON_INSURANCE")
    .reduce((s, t) => s + (t.revenue ?? 0), 0)
  const nonInsuranceRatio = totalRevenue > 0 ? (nonInsuranceRevenue / totalRevenue) * 100 : null

  // 환자 (PatientStat 기반 — 없으면 null 유지)
  const hasPatientData = patients.length > 0
  const newPatients = hasPatientData ? Math.round(patients.reduce((s, p) => s + (p.newPatients ?? 0), 0)) : null
  const totalPatients = hasPatientData ? Math.round(patients.reduce((s, p) => s + (p.totalVisits ?? 0), 0)) : null
  const revisitRate = (hasPatientData && totalPatients && totalPatients > 0 && newPatients !== null)
    ? ((totalPatients - newPatients) / totalPatients) * 100 : null
  const newPatientRevenue = (newPatients && newPatients > 0 && totalRevenue > 0)
    ? totalRevenue / newPatients : null

  // 미수금 (TreatmentPlan 기반)
  const totalArrears = plans.filter((p) => p.paymentStatus === "INCOMPLETE").reduce((s, p) => s + (p.remainingAmount ?? 0), 0)
  const totalContract = plans.reduce((s, p) => s + (p.contractAmount ?? 0), 0)
  const arrearsRate = totalContract > 0 ? (totalArrears / totalContract) * 100 : null
  const completedPlans = plans.filter((p) => p.status === "COMPLETED").length
  const activePlans = plans.filter((p) => p.status === "COMPLETED" || p.status === "IN_PROGRESS").length
  const treatmentCompleteRate = activePlans > 0 ? (completedPlans / activePlans) * 100 : null

  // 전월 대비 성장률
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prev = await prisma.monthlySummary.findUnique({
    where: { clinicId_year_month: { clinicId, year: prevYear, month: prevMonth } },
  })
  const revenueGrowth = prev?.totalRevenue && prev.totalRevenue > 0
    ? ((totalRevenue - prev.totalRevenue) / prev.totalRevenue) * 100 : null
  const newPatientGrowth = prev?.newPatients && prev.newPatients > 0 && newPatients
    ? ((newPatients - prev.newPatients) / prev.newPatients) * 100 : null

  const payload = {
    clinicId, year, month,
    totalRevenue, totalExpense, netProfit,
    cashIncome, cardIncome, insuranceClaim,
    nonInsuranceRevenue, nonInsuranceRatio,
    newPatients, totalPatients,
    workingDays, avgDailyRevenue, newPatientRevenue, revisitRate,
    revenueGrowth, newPatientGrowth,
    totalArrears, arrearsRate, treatmentCompleteRate,
  }

  await prisma.monthlySummary.upsert({
    where: { clinicId_year_month: { clinicId, year, month } },
    create: payload,
    update: payload,
  })
}
