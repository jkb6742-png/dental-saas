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

  // 실제 월간장부(Revenue)에서 사용 가능한 년도/월 목록 조회
  const availableMonths = await prisma.revenue.groupBy({
    by: ['year', 'month'],
    where: { clinicId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  }).catch(() => [])

  const latest = availableMonths[0]
  const now = new Date()
  const year = sp.year ? parseInt(sp.year) : (latest?.year ?? now.getFullYear())
  const month = sp.month ? parseInt(sp.month) : (latest?.month ?? now.getMonth() + 1)

  // Revenue 테이블에서 월별 집계 계산
  const monthlySummaries = await calculateMonthlySummariesFromRevenue(prisma, clinicId)

  // 데이터가 없는 경우
  if (monthlySummaries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[14px] text-[#8b95a1]">
        매출 데이터가 없습니다. 월간장부 데이터를 업로드해주세요.
      </div>
    )
  }

  return (
    <RevenuePageClient
      clinicId={clinicId}
      initialYear={year}
      initialMonth={month}
      monthlySummaries={monthlySummaries}
      availableMonths={availableMonths}
    />
  )
}

// Revenue 테이블에서 월별 집계 계산 함수
async function calculateMonthlySummariesFromRevenue(prisma: any, clinicId: string) {
  try {
    // Revenue 테이블에서 모든 데이터 조회
    const revenueData = await prisma.revenue.findMany({
      where: { clinicId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    })

    // 년/월별 그룹화
    const monthlyGroups = new Map()

    revenueData.forEach((item: any) => {
      const key = `${item.year}-${item.month}`
      if (!monthlyGroups.has(key)) {
        monthlyGroups.set(key, {
          year: item.year,
          month: item.month,
          items: []
        })
      }
      monthlyGroups.get(key).items.push(item)
    })

    // 각 월별로 집계 계산
    const monthlySummaries = Array.from(monthlyGroups.values()).map((group: any) => {
      const items = group.items

      const totalRevenue = items.reduce((sum: number, item: any) => sum + (item.totalIncome || 0), 0)
      const totalExpense = items.reduce((sum: number, item: any) => sum + (item.totalExpense || 0), 0)
      const netProfit = totalRevenue - totalExpense
      const cashIncome = items.reduce((sum: number, item: any) => sum + (item.cashIncome || 0), 0)
      const cardIncome = items.reduce((sum: number, item: any) => sum + (item.cardIncome || 0), 0)
      const onlineIncome = items.reduce((sum: number, item: any) => sum + (item.onlineIncome || 0), 0)

      return {
        id: `${group.year}-${group.month}`,
        clinicId,
        year: group.year,
        month: group.month,
        totalRevenue,
        totalExpense,
        netProfit,
        cashIncome,
        cardIncome,
        insuranceClaim: 0, // Revenue 테이블에서는 별도 관리 안함
        nonInsuranceRevenue: totalRevenue, // 전체를 비보험으로 간주
        newPatients: null,
        totalPatients: null,
        workingDays: items.length, // 실제 매출이 있었던 일수
        avgDailyRevenue: items.length > 0 ? totalRevenue / items.length : 0,
        newPatientRevenue: null,
        revisitRate: null,
        nonInsuranceRatio: null,
        revenueGrowth: null,
        newPatientGrowth: null,
        totalArrears: null,
        arrearsRate: null,
        treatmentCompleteRate: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    // 최근 24개월만 반환
    return monthlySummaries
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        return b.month - a.month
      })
      .slice(0, 24)

  } catch (error) {
    console.error('월별 집계 계산 오류:', error)
    return []
  }
}
