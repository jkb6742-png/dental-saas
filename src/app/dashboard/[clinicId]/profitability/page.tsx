export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { resolveMonth } from "@/lib/utils/monthHelper"
import { getLedgerStats } from "@/lib/dashboard/insights"
import YearCompareChart from "@/components/charts/YearCompareChart"
import HomeCard from "@/components/dashboard/HomeCard"
import { DataTable, MetricRow, NeedData, PageHead, rate, won } from "@/components/dashboard/ui"

export default async function ProfitabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const { clinicId } = await params
  const { year, month, availableMonths } = await resolveMonth(clinicId, await searchParams, "monthlySummary")
  const rows = await getLedgerStats(clinicId, year, month)
  const cur = rows.find((r) => r.m === month)
  const sum = (key: "income" | "paidIn" | "fee" | "direct") => rows.reduce((a, r) => a + r[key], 0)

  return (
    <div className="space-y-3">
      <PageHead title={`${year}년 ${month}월 비용·수익성`} note="월간장부 기준" year={year} month={month} availableMonths={availableMonths} />

      <NeedData title="이익은 표시하지 않습니다">
        장부에 기록된 지출이 카드 수수료 위주입니다. 인건비·임대료·재료비·기공료·광고비 자료를 받으면 운영이익을 계산할 수 있습니다.
      </NeedData>

      {!rows.length ? (
        <NeedData title="장부 자료 없음">이 기간의 월간장부를 올리면 표시됩니다.</NeedData>
      ) : (
        <>
          <MetricRow
            items={[
              { label: "장부 수입", value: won(cur?.income), note: "공단청구 포함" },
              { label: "실입금 수입", value: won(cur?.paidIn), note: "현금 + 카드 + 온라인" },
              { label: "공단청구", value: won(cur?.ins), note: "실제 입금액 아님" },
              { label: "카드 수수료", value: won(cur?.fee), note: `카드 수입의 ${rate(cur?.feeRate)}` },
              { label: "기록된 직접 지출", value: won(cur?.direct), note: "현금·카드·온라인 지출" },
            ]}
          />
          <HomeCard title="월별 수입 구성" note={`${year}년 1~${month}월`}>
            <YearCompareChart
              data={rows}
              series={[
                { key: "card", name: "카드", color: "#0062ff" },
                { key: "ins", name: "공단청구", color: "#191f28" },
                { key: "cash", name: "현금", color: "#6f6f6a" },
                { key: "online", name: "온라인", color: "#a3a39d" },
              ]}
              unit="원"
              height={300}
            />
          </HomeCard>
          <HomeCard title="월별 상세" note={`1~${month}월 수입 ${won(sum("income"))} · 수수료 ${won(sum("fee"))}`}>
            <DataTable
              head={["월", "장부 수입", "카드", "현금", "온라인", "공단청구", "카드 수수료", "수수료율", "직접 지출"]}
              rows={rows.map((r) => [`${r.m}월`, won(r.income), won(r.card), won(r.cash), won(r.online), won(r.ins), won(r.fee), rate(r.feeRate), won(r.direct)])}
            />
          </HomeCard>
        </>
      )}
    </div>
  )
}
