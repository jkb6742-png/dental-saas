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

  // 사용 가능한 년도/월 목록
  const availableMonths = await prisma.monthlySummary.findMany({
    where: { clinicId },
    select: { year: true, month: true },
    distinct: ['year', 'month'],
    orderBy: [{ year: "desc" }, { month: "desc" }],
  })

  const latest = availableMonths[0]
  const now = new Date()
  const year = sp.year ? parseInt(sp.year) : (latest?.year ?? now.getFullYear())
  const month = sp.month ? parseInt(sp.month) : (latest?.month ?? now.getMonth() + 1)

  // 전체 월간 요약 데이터 (최근 24개월)
  const monthlySummaries = await prisma.monthlySummary.findMany({
    where: { clinicId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 24,
  })

  // 데이터가 없는 경우
  if (monthlySummaries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[14px] text-[#8b95a1]">
        매출 데이터가 없습니다. 월간 요약 데이터를 생성해주세요.
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
