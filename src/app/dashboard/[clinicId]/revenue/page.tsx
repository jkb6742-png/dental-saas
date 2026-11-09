export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import RevenuePageClient from "./RevenuePageClient"

export default async function RevenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { clinicId } = await params
  const sp = await searchParams

  // MonthlySummary에서 사용 가능한 년도/월 목록 조회
  const availableMonths = await prisma.monthlySummary.groupBy({
    by: ['year', 'month'],
    where: { clinicId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  }).catch(() => [])

  const latest = availableMonths[0]
  const now = new Date()
  const year = sp.year ? parseInt(sp.year) : (latest?.year ?? now.getFullYear())
  const month = sp.month ? parseInt(sp.month) : (latest?.month ?? now.getMonth() + 1)

  // MonthlySummary 테이블에서 데이터 직접 조회
  const rawSummaries = await getMonthlySummaries(prisma, clinicId)

  // 마스터가 입력한 월별 현금매출 조회 → 총매출에 가산
  const cashRows = await prisma.cashRevenue.findMany({
    where: { clinicId },
    select: { year: true, month: true, amount: true },
  }).catch(() => [] as Array<{ year: number; month: number; amount: number }>)
  const cashMap = new Map(cashRows.map((c) => [`${c.year}-${c.month}`, c.amount || 0]))
  const cashByMonth: Record<string, number> = Object.fromEntries(cashMap)

  // 총매출 = 기존 총매출 + 현금매출 (모든 하위 계산에 자동 반영)
  const monthlySummaries = rawSummaries.map((s: any) => ({
    ...s,
    totalRevenue: (s.totalRevenue || 0) + (cashMap.get(`${s.year}-${s.month}`) ?? 0),
  }))

  const userRole = (session.user as any).role as string

  // 매출 데이터가 없어도 페이지는 렌더한다(현금매출 입력·안내는 클라이언트에서 처리).

  return (
    <RevenuePageClient
      clinicId={clinicId}
      initialYear={year}
      initialMonth={month}
      monthlySummaries={monthlySummaries}
      availableMonths={availableMonths}
      cashByMonth={cashByMonth}
      userRole={userRole}
    />
  )
}

// MonthlySummary 테이블에서 데이터 직접 조회 함수
async function getMonthlySummaries(prisma: any, clinicId: string) {
  try {
    // MonthlySummary 테이블에서 데이터 직접 조회
    const monthlySummaries = await prisma.monthlySummary.findMany({
      where: { clinicId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 24 // 최근 24개월만
    })

    // 데이터 포맷 조정
    return monthlySummaries.map((summary: any) => ({
      id: summary.id,
      clinicId: summary.clinicId,
      year: summary.year,
      month: summary.month,
      totalRevenue: summary.totalRevenue || 0,
      totalExpense: summary.totalExpense || 0,
      netProfit: summary.netProfit || 0,
      cashIncome: summary.cashIncome || 0,
      cardIncome: summary.cardIncome || 0,
      insuranceClaim: summary.insuranceClaim || 0,
      nonInsuranceRevenue: summary.nonInsuranceRevenue || 0,
      newPatients: summary.newPatients || 0,
      totalPatients: summary.totalPatients || 0,
      workingDays: summary.workingDays || 0,
      avgDailyRevenue: summary.avgDailyRevenue || 0,
      newPatientRevenue: summary.newPatientRevenue || 0,
      revisitRate: summary.revisitRate || 0,
      nonInsuranceRatio: summary.nonInsuranceRatio || 0,
      revenueGrowth: summary.revenueGrowth || 0,
      newPatientGrowth: summary.newPatientGrowth || 0,
      totalArrears: summary.totalArrears || 0,
      arrearsRate: summary.arrearsRate || 0,
      treatmentCompleteRate: summary.treatmentCompleteRate || 0,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt
    }))

  } catch (error) {
    console.error('MonthlySummary 조회 오류:', error)
    return []
  }
}
