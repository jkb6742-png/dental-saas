export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getRouteCompare } from "@/lib/dashboard/compare-rows"
import RoutesPageClient from "./RoutesPageClient.client"

export default async function RoutesPage({
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

  const compare = await getRouteCompare(clinicId, year)

  // 해당 년도 전체 데이터
  const yearlyData = await prisma.visitRoute.findMany({
    where: {
      clinicId,
      year
    },
    orderBy: [{ month: "asc" }, { routeName: "asc" }]
  })

  // 해당 월의 상세 데이터
  const monthlyData = await prisma.visitRoute.findMany({
    where: {
      clinicId,
      year,
      month
    },
    orderBy: { routeName: "asc" }
  })

  // 사용 가능한 년도/월 조합
  const availableData = await prisma.visitRoute.findMany({
    where: { clinicId },
    select: { year: true, month: true },
    distinct: ['year', 'month'],
    orderBy: [{ year: "desc" }, { month: "desc" }]
  })

  // 데이터가 없는 경우
  if (yearlyData.length === 0 && monthlyData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[14px] text-[#8b95a1]">
        내원경로 데이터가 없습니다. 엑셀을 업로드해주세요.
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div className="">
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-[#d1d1cc] p-4">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">내원경로별 분석</h1>
            <p className="text-slate-600">차트를 불러오는 중...</p>
          </div>
        </div>
      </div>
    }>
      <RoutesPageClient
        clinicId={clinicId}
        initialYear={year}
        initialMonth={month}
        yearlyData={yearlyData}
        monthlyData={monthlyData}
        availableData={availableData}
        compare={compare}
      />
    </Suspense>
  )
}