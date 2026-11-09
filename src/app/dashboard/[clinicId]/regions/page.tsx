export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getRegionGrowth } from "@/lib/dashboard/insights"
import HomeCard from "@/components/dashboard/HomeCard"
import { DataTable, Delta, num, won } from "@/components/dashboard/ui"
import { getRegionCompare } from "@/lib/dashboard/compare-rows"
import RegionsPageClient from "./RegionsPageClient"

export default async function RegionsPage({
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

  const [compare, growth] = await Promise.all([getRegionCompare(clinicId, year), getRegionGrowth(clinicId, year, month)])

  // 해당 년도 전체 데이터
  const yearlyData = await prisma.regionDist.findMany({
    where: {
      clinicId,
      year
    },
    orderBy: [{ month: "asc" }, { region: "asc" }]
  })

  // 해당 월의 상세 데이터
  const monthlyData = await prisma.regionDist.findMany({
    where: {
      clinicId,
      year,
      month
    },
    orderBy: { region: "asc" }
  })

  // 사용 가능한 년도/월 조합
  const availableData = await prisma.regionDist.findMany({
    where: { clinicId },
    select: { year: true, month: true },
    distinct: ['year', 'month'],
    orderBy: [{ year: "desc" }, { month: "desc" }]
  })

  // 데이터가 없는 경우
  if (yearlyData.length === 0 && monthlyData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[14px] text-[#8b95a1]">
        지역별 데이터가 없습니다. 엑셀을 업로드해주세요.
      </div>
    )
  }

  return (
    <div className="space-y-3">
    <RegionsPageClient
      clinicId={clinicId}
      initialYear={year}
      initialMonth={month}
      yearlyData={yearlyData}
      monthlyData={monthlyData}
        availableData={availableData}
        compare={compare}
    />
    {growth.length > 0 && (
      <HomeCard title="지역별 신환 전년 대비" note={`신환 상위 12곳 · 1~${month}월 합계`}>
        <DataTable
          head={["지역", `${year}년 신환`, `${year - 1}년 신환`, "증감", "평균 진료비"]}
          rows={growth.map((g) => [
            g.region,
            `${num(g.cur)}명`,
            `${num(g.prev)}명`,
            <Delta key={g.region} value={g.prev > 0 ? ((g.cur - g.prev) / g.prev) * 100 : null} />,
            won(g.avgRevenue),
          ])}
        />
      </HomeCard>
    )}
    </div>
  )
}