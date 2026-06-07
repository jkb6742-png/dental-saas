export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import TreatmentsPageClient from "./TreatmentsPageClient"

export default async function TreatmentsPage({
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
  const yearlyData = await prisma.treatmentStat.findMany({
    where: {
      clinicId,
      year
    },
    orderBy: [{ month: "asc" }, { itemName: "asc" }]
  })

  // 해당 월의 상세 데이터
  const monthlyData = await prisma.treatmentStat.findMany({
    where: {
      clinicId,
      year,
      month
    },
    orderBy: { revenue: "desc" }
  })

  // 사용 가능한 년도/월 조합
  const availableData = await prisma.treatmentStat.findMany({
    where: { clinicId },
    select: { year: true, month: true },
    distinct: ['year', 'month'],
    orderBy: [{ year: "desc" }, { month: "desc" }]
  })

  // 데이터가 없는 경우
  if (yearlyData.length === 0 && monthlyData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[14px] text-[#8b95a1]">
        진료항목 데이터가 없습니다. 엑셀을 업로드해주세요.
      </div>
    )
  }

  return (
    <TreatmentsPageClient
      clinicId={clinicId}
      initialYear={year}
      initialMonth={month}
      yearlyData={yearlyData}
      monthlyData={monthlyData}
      availableData={availableData}
    />
  )
}