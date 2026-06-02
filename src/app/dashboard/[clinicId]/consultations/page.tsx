export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import ConsultationsPageClient from "./ConsultationsPageClient"

export default async function ConsultationsPage({
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
  const yearlyData = await prisma.consultationStat.findMany({
    where: {
      clinicId,
      year
    },
    orderBy: [{ month: "asc" }, { counselorName: "asc" }]
  })

  // 해당 월의 상세 데이터
  const monthlyData = await prisma.consultationStat.findMany({
    where: {
      clinicId,
      year,
      month
    },
    orderBy: { confirmedAmount: "desc" }
  })

  // 사용 가능한 년도/월 조합
  const availableData = await prisma.consultationStat.findMany({
    where: { clinicId },
    select: { year: true, month: true },
    distinct: ['year', 'month'],
    orderBy: [{ year: "desc" }, { month: "desc" }]
  })

  // 데이터가 없는 경우
  if (yearlyData.length === 0 && monthlyData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[14px] text-[#8b95a1]">
        상담 성과 데이터가 없습니다. 엑셀을 업로드해주세요.
      </div>
    )
  }

  return (
    <ConsultationsPageClient
      clinicId={clinicId}
      initialYear={year}
      initialMonth={month}
      yearlyData={yearlyData}
      monthlyData={monthlyData}
      availableData={availableData}
    />
  )
}
