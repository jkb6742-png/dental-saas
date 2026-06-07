import { prisma } from "@/lib/db"

export async function recalcMonthlySummary(clinicId: string, year: number, month: number) {
  const [ledgers, patients, treatmentStats, routes, plans, receptionRecords] = await Promise.all([
    prisma.dailyLedger.findMany({ where: { clinicId, year, month } }),
    prisma.patientStat.findMany({ where: { clinicId, year, month } }),
    prisma.treatmentStat.findMany({ where: { clinicId, year, month } }),
    prisma.visitRoute.findMany({ where: { clinicId, year, month } }),
    prisma.treatmentPlan.findMany({ where: { clinicId, year, month } }),
    // ReceptionRecord에서 직접 매출 데이터 가져오기
    prisma.receptionRecord.findMany({
      where: {
        clinicId,
        receptionTime: {
          gte: new Date(year, month - 1, 1), // 해당 월 첫날
          lt: new Date(year, month, 1)       // 다음 월 첫날
        },
        totalRevenue: { gt: 0 }
      }
    })
  ])

  // 아무 데이터도 없으면 집계하지 않음
  if (ledgers.length === 0 && patients.length === 0 && treatmentStats.length === 0 && receptionRecords.length === 0) return

  // Revenue (DailyLedger 실제 수금 기준)
  const cashIncome = ledgers.reduce((s, l) => s + (l.cashIncome ?? 0), 0)
  const cardIncome = ledgers.reduce((s, l) => s + (l.cardIncome ?? 0), 0)
  const onlineIncome = ledgers.reduce((s, l) => s + (l.onlineIncome ?? 0), 0)
  const totalRevenue = cashIncome + cardIncome + onlineIncome // 실제 수금 합계

  // 신환 매출은 ReceptionRecord에서 가져오기 (청구 기준)
  const newPatientRevenue = receptionRecords
    .filter(r => r.patientType === '신환')
    .reduce((s, r) => s + (r.totalRevenue ?? 0), 0)

  // 전체 청구 기준 매출 (객단가 계산용)
  const totalBilledRevenue = receptionRecords
    .reduce((s, r) => s + (r.totalRevenue ?? 0), 0)

  // 근무일 수는 DailyLedger 기준
  const workingDays = ledgers.length > 0 ? ledgers.length : 1
  const avgDailyRevenue = workingDays > 0 ? totalRevenue / workingDays : 0

  // 기타 DailyLedger 기반 데이터
  const totalExpense = ledgers.reduce((s, l) => s + (l.totalExpense ?? 0), 0)
  const netProfit = totalRevenue - totalExpense
  const insuranceClaim = ledgers.reduce((s, l) => s + (l.insuranceClaim ?? 0), 0)

  // 비급여 (TreatmentStat 기반)
  const nonInsuranceRevenue = treatmentStats
    .filter((t) => t.category === "NON_INSURANCE")
    .reduce((s, t) => s + (t.revenue ?? 0), 0)
  const nonInsuranceRatio = totalRevenue > 0 ? (nonInsuranceRevenue / totalRevenue) * 100 : null

  // 환자 (ReceptionRecord 기반으로 변경)
  const hasReceptionData = receptionRecords.length > 0
  const newPatients = hasReceptionData
    ? receptionRecords.filter(r => r.patientType === '신환').length
    : (patients.length > 0 ? Math.round(patients.reduce((s, p) => s + (p.newPatients ?? 0), 0)) : null)

  const totalPatients = hasReceptionData
    ? receptionRecords.length
    : (patients.length > 0 ? Math.round(patients.reduce((s, p) => s + (p.totalVisits ?? 0), 0)) : null)

  const revisitRate = (totalPatients && totalPatients > 0 && newPatients !== null)
    ? ((totalPatients - newPatients) / totalPatients) * 100 : null

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
    totalBilledRevenue, // 객단가 계산용 청구 기준 전체 매출
  }

  await prisma.monthlySummary.upsert({
    where: { clinicId_year_month: { clinicId, year, month } },
    create: payload,
    update: payload,
  })
}
