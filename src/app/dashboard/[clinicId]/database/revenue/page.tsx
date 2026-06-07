export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import RevenueDetailPage from "./RevenueDetailPage"

export default async function RevenuePage({
  params,
  searchParams
}: {
  params: Promise<{ clinicId: string }>
  searchParams: Promise<{ page?: string; year?: string; month?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { clinicId } = await params
  const sp = await searchParams

  const page = parseInt(sp.page || '1')
  const year = sp.year ? parseInt(sp.year) : 2026
  const month = sp.month ? parseInt(sp.month) : undefined

  const pageSize = 20

  // 필터 조건
  const where = {
    clinicId,
    ...(year && { year }),
    ...(month && { month })
  }

  // 매출 데이터 조회 (페이지네이션)
  const [revenueData, totalCount] = await Promise.all([
    prisma.revenue.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { day: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }).catch(() => []),
    prisma.revenue.count({ where }).catch(() => 0)
  ])

  // 통계 계산
  const stats = await calculateRevenueStats(prisma, where)

  // 사용 가능한 년도/월 조회
  const availablePeriods = await prisma.revenue.groupBy({
    by: ['year', 'month'],
    where: { clinicId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }]
  }).catch(() => [])

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <RevenueDetailPage
      clinicId={clinicId}
      revenueData={revenueData}
      stats={stats}
      pagination={{
        currentPage: page,
        totalPages,
        totalCount,
        pageSize
      }}
      filters={{ year, month }}
      availablePeriods={availablePeriods}
    />
  )
}

async function calculateRevenueStats(prisma: any, where: any) {
  try {
    const data = await prisma.revenue.findMany({ where })

    const totalIncome = data.reduce((sum: number, item: any) => sum + (item.totalIncome || 0), 0)
    const totalExpense = data.reduce((sum: number, item: any) => sum + (item.totalExpense || 0), 0)
    const netProfit = data.reduce((sum: number, item: any) => sum + (item.netProfit || 0), 0)
    const avgDailyIncome = data.length > 0 ? totalIncome / data.length : 0

    return {
      totalRecords: data.length,
      totalIncome,
      totalExpense,
      netProfit,
      avgDailyIncome
    }
  } catch (error) {
    return {
      totalRecords: 0,
      totalIncome: 0,
      totalExpense: 0,
      netProfit: 0,
      avgDailyIncome: 0
    }
  }
}