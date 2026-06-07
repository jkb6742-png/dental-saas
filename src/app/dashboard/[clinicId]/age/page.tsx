export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import AgePageClient from "./AgePageClient"

export default async function AgePage({
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

  // 기본값을 전달로 설정 (월초에 전달 지표를 정리하므로)
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const defaultYear = lastMonth.getFullYear()
  const defaultMonth = lastMonth.getMonth() + 1

  const year = sp.year ? parseInt(sp.year) : defaultYear
  const month = sp.month ? parseInt(sp.month) : defaultMonth

  // 해당 년도 전체 데이터
  const yearlyData = await prisma.ageDist.findMany({
    where: {
      clinicId,
      year
    },
    orderBy: [{ month: "asc" }, { ageGroup: "asc" }]
  })

  // 해당 월의 상세 데이터
  const monthlyData = await prisma.ageDist.findMany({
    where: {
      clinicId,
      year,
      month
    },
    orderBy: { ageGroup: "asc" }
  })

  // 사용 가능한 년도/월 조합
  const availableData = await prisma.ageDist.findMany({
    where: { clinicId },
    select: { year: true, month: true },
    distinct: ['year', 'month'],
    orderBy: [{ year: "desc" }, { month: "desc" }]
  })

  return (
    <AgePageClient
      clinicId={clinicId}
      initialYear={year}
      initialMonth={month}
      yearlyData={yearlyData}
      monthlyData={monthlyData}
      availableData={availableData}
    />
  )
}