export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { resolveMonth } from "@/lib/utils/monthHelper"
import { getDataCheck } from "@/lib/dashboard/insights"
import HomeCard from "@/components/dashboard/HomeCard"
import { DataTable, PageHead, rate, won } from "@/components/dashboard/ui"

// 운영자 전용: 월별 자료 누락과 컬럼 입력률을 한눈에 본다.
export default async function DataCheckPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if ((session.user as { role?: string }).role !== "MASTER") redirect("/dashboard")

  const { clinicId } = await params
  const { year, month, availableMonths } = await resolveMonth(clinicId, await searchParams, "monthlySummary")
  const s = await getDataCheck(clinicId, year, month)
  const total = s.fill?.total ?? 0
  const fields = Object.entries(s.fill ?? {}).filter(([k]) => k !== "total")

  return (
    <div className="space-y-3">
      <PageHead title="데이터 점검" note="최근 14개월" year={year} month={month} availableMonths={availableMonths} />

      <HomeCard title="월별 자료 유무" note="칸의 숫자는 적재된 행 수, 빈 칸은 누락">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] tabular-nums">
            <thead>
              <tr className="border-b border-[#d1d1cc] text-[11px] text-[#6f6f6a]">
                <th className="py-1.5 pr-2 text-left font-normal">자료</th>
                {s.months.map((m) => (
                  <th key={`${m.year}-${m.month}`} className="py-1.5 px-1 text-right font-normal whitespace-nowrap">
                    {String(m.year).slice(2)}.{String(m.month).padStart(2, "0")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.coverage.map((row) => (
                <tr key={row.name} className="border-b border-[#ecece9] last:border-b-0">
                  <td className="py-1.5 pr-2 text-[#0a0a0a] whitespace-nowrap">{row.name}</td>
                  {row.counts.map((c, i) => (
                    <td key={i} className={`py-1.5 px-1 text-right ${c === 0 ? "bg-[#fdecec] text-[#e0383b]" : "text-[#222220]"}`}>
                      {c === 0 ? "없음" : c.toLocaleString("ko-KR")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HomeCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <HomeCard title="접수수납 컬럼 입력률" note={`${year}년 ${month}월 ${total.toLocaleString("ko-KR")}건`}>
          <DataTable
            head={["컬럼", "값 있는 건", "입력률"]}
            rows={fields.map(([k, v]) => [k, v.toLocaleString("ko-KR"), rate(total ? (v / total) * 100 : null)])}
          />
        </HomeCard>
        <HomeCard title="접수수납 진료비와 장부 수입 차이" note="큰 차이가 나면 원본 확인">
          <DataTable
            head={["월", "접수 진료비", "장부 수입", "차이", "차이율"]}
            rows={s.gap.map((g) => [
              `${g.y}.${String(g.m).padStart(2, "0")}`,
              won(g.billed),
              won(g.ledger),
              g.billed != null && g.ledger != null ? won(g.billed - g.ledger) : "—",
              g.billed != null && g.ledger ? rate(((g.billed - g.ledger) / g.ledger) * 100) : "—",
            ])}
          />
        </HomeCard>
      </div>
    </div>
  )
}
