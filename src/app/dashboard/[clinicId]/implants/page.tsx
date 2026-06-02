export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"
import { resolveMonth } from "@/lib/utils/monthHelper"
import MonthSelector from "@/components/ui/MonthSelector"
import ImplantTrendChart from "@/components/charts/ImplantTrendChart"
import { Suspense } from "react"

export default async function ImplantsPage({
  params, searchParams,
}: {
  params: Promise<{ clinicId: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const { clinicId } = await params
  const sp = await searchParams
  const { year, month, availableMonths } = await resolveMonth(clinicId, sp, "implantStat")

  // 전체 기간 월별 수술 합계 (추이용)
  const monthlyTotals = await prisma.implantStat.groupBy({
    by: ["year", "month"],
    where: { clinicId },
    _sum: { surgeryCount: true, usageCount: true },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  })

  const trendData = monthlyTotals.map((r) => ({
    label: `${r.year}.${String(r.month).padStart(2, "0")}`,
    수술횟수: r._sum.surgeryCount ?? 0,
    사용개수: r._sum.usageCount ?? 0,
  }))

  // 선택 달 상세
  const current = await prisma.implantStat.findMany({
    where: { clinicId, year, month }, orderBy: { surgeryCount: "desc" },
  })

  const totalSurgeries = current.reduce((s, r) => s + (r.surgeryCount ?? 0), 0)
  const totalUsage = current.reduce((s, r) => s + (r.usageCount ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[14px] text-[#8b95a1]">월별 임플란트 수술 추이 · {year}년 {month}월 상세</p>
        <Suspense><MonthSelector availableMonths={availableMonths} currentYear={year} currentMonth={month} /></Suspense>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="이달 수술 횟수" value={totalSurgeries} unit="건" color="blue" />
        <KpiCard label="임플란트 사용 개수" value={totalUsage} unit="개" color="green" />
        <KpiCard label="가장 많이 사용" value={current[0]?.fixtureName?.split(" - ")[0] ?? "—"} changeLabel={current[0] ? `${current[0].surgeryCount}건` : undefined} color="yellow" />
      </div>

      <SectionCard title="월별 수술 횟수 추이" description="전체 기간 꺾은선">
        <ImplantTrendChart data={trendData} />
      </SectionCard>

      <SectionCard title={`${year}년 ${month}월 픽스처 상세`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#f2f4f6]">
                {["순위", "픽스처명", "수술횟수", "사용개수"].map((h) => (
                  <th key={h} className="text-left py-3 px-3 text-[#8b95a1] font-medium first:pl-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {current.map((r, i) => (
                <tr key={r.id} className="border-b border-[#f9fafb] hover:bg-[#f9fafb]">
                  <td className="py-3 px-3 pl-0 text-[#b0b8c1] font-bold">{i + 1}</td>
                  <td className="py-3 px-3 font-medium text-[#191f28]">{r.fixtureName}</td>
                  <td className="py-3 px-3 tabular-nums text-[#3182f6] font-semibold">{r.surgeryCount ?? "—"}건</td>
                  <td className="py-3 px-3 tabular-nums text-[#6b7684]">{r.usageCount ?? "—"}개</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
