export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"
import RouteTrendChart from "@/components/charts/RouteTrendChart"
import MonthSelector from "@/components/ui/MonthSelector"
import { resolveMonth } from "@/lib/utils/monthHelper"
import { MapPin } from "lucide-react"
import { Suspense } from "react"

export default async function RegionPage({
  params, searchParams,
}: {
  params: Promise<{ clinicId: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const { clinicId } = await params
  const sp = await searchParams
  const { year, month, availableMonths } = await resolveMonth(clinicId, sp, "regionDist")

  // 전체 기간 — 신환 합계 기준 TOP 6 지역
  const all = await prisma.regionDist.findMany({ where: { clinicId }, orderBy: [{ year: "asc" }, { month: "asc" }] })

  const regionTotals = new Map<string, number>()
  for (const r of all) regionTotals.set(r.region, (regionTotals.get(r.region) ?? 0) + (r.newPatients ?? 0))
  const topRegions = [...regionTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k)

  const labels = [...new Set(all.map((r) => `${r.year}.${String(r.month).padStart(2, "0")}`))].sort()
  const trendData = labels.map((label) => {
    const [y, m] = label.split(".").map(Number)
    const row: Record<string, number | string> = { label }
    for (const region of topRegions) {
      const found = all.find((r) => r.year === y && r.month === m && r.region === region)
      row[region.split(" ").slice(-1)[0]] = found?.newPatients ?? 0
    }
    return row
  })
  const shortRegionNames = topRegions.map((r) => r.split(" ").slice(-1)[0])

  // 이달 상세
  const stats = await prisma.regionDist.findMany({ where: { clinicId, year, month }, orderBy: { totalPatients: "desc" } })
  const totalNew = stats.reduce((s, r) => s + (r.newPatients ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[14px] text-[#8b95a1]">주요 지역 신환 수 월별 추이 · {year}년 {month}월 상세</p>
        <Suspense><MonthSelector availableMonths={availableMonths} currentYear={year} currentMonth={month} /></Suspense>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard label="이달 신환 수" value={totalNew} unit="명" icon={<MapPin className="w-4 h-4" />} color="blue" />
        <KpiCard label="1위 지역" value={stats[0]?.region?.split(" ").slice(-1)[0] ?? "—"} changeLabel={stats[0] ? `${stats[0].totalPatients}명` : undefined} color="green" />
        <KpiCard label="등록 지역 수" value={stats.length} unit="개" color="yellow" />
      </div>

      <SectionCard title="주요 지역 신환 수 월별 추이" description="상위 6개 지역 꺾은선">
        <RouteTrendChart data={trendData} channels={shortRegionNames} yLabel="신환 수 (명)" />
      </SectionCard>

      <SectionCard title={`${year}년 ${month}월 지역별 상세 (상위 30)`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#f2f4f6]">
                {["순위", "지역", "내원환자", "신환", "구환", "총내원횟수", "평균진료비"].map((h) => (
                  <th key={h} className="text-left py-3 px-3 text-[#8b95a1] font-medium first:pl-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.slice(0, 30).map((r, i) => (
                <tr key={r.id} className="border-b border-[#f9fafb] hover:bg-[#f9fafb]">
                  <td className="py-3 px-3 pl-0 text-[#b0b8c1] font-bold">{i + 1}</td>
                  <td className="py-3 px-3 font-medium text-[#191f28]">{r.region}</td>
                  <td className="py-3 px-3 tabular-nums font-semibold">{r.totalPatients ?? "—"}명</td>
                  <td className="py-3 px-3 tabular-nums text-[#05c072]">{r.newPatients ?? "—"}명</td>
                  <td className="py-3 px-3 tabular-nums text-[#6b7684]">{r.returningPatients ?? "—"}명</td>
                  <td className="py-3 px-3 tabular-nums text-[#6b7684]">{r.totalVisits ?? "—"}회</td>
                  <td className="py-3 px-3 tabular-nums text-[#3182f6]">{(r.avgRevenue ?? 0).toLocaleString("ko-KR")}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
