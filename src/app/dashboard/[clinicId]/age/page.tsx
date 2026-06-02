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

  const year = sp.year ? parseInt(sp.year) : new Date().getFullYear()
  const month = sp.month ? parseInt(sp.month) : new Date().getMonth() + 1

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