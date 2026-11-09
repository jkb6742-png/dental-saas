export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { resolveMonth } from "@/lib/utils/monthHelper"
import { getCollectionStats } from "@/lib/dashboard/insights"
import YearCompareChart from "@/components/charts/YearCompareChart"
import HomeCard from "@/components/dashboard/HomeCard"
import { DataTable, MetricRow, NeedData, PageHead, rate, won } from "@/components/dashboard/ui"

export default async function CollectionsPage({
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
  const s = await getCollectionStats(clinicId, year, month)
  const c = s.current

  return (
    <div className="space-y-3">
      <PageHead title={`${year}년 ${month}월 수납·미수`} note="접수수납목록 기준" year={year} month={month} availableMonths={availableMonths} />

      {!s.hasData ? (
        <NeedData title="접수수납 자료 없음">이 기간의 접수수납목록을 올리면 표시됩니다.</NeedData>
      ) : (
        <>
          <MetricRow
            items={[
              { label: "진료비", value: won(c?.billed), note: "공단부담 포함" },
              { label: "공단부담", value: won(c?.ins), note: "실제 입금액 아님" },
              { label: "환자 부담액", value: won(c?.due), note: "본인부담 + 비급여" },
              { label: "환자 수납액", value: won(c?.paid), note: "카드 + 현금 + 온라인" },
              { label: "당월 수납 비율", value: rate(c?.paidRate), note: "환자 수납 ÷ 환자 부담" },
              { label: "당월 미수 증감", value: c?.arrears != null ? won(c.arrears) : "자료 없음", note: "접수 건별 일미수 합계" },
            ]}
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <HomeCard title="진료비와 환자 수납" note={`${year}년 1~${month}월`}>
              <YearCompareChart
                data={s.monthly}
                series={[
                  { key: "due", name: "환자 부담액", color: "#a3a39d" },
                  { key: "paid", name: "환자 수납액", color: "#0062ff" },
                ]}
                unit="원"
                height={280}
              />
            </HomeCard>
            <HomeCard title="당월 수납 비율" note={`${year}년 vs ${year - 1}년`}>
              <YearCompareChart
                data={s.monthly.map((m) => ({ label: m.label, cur: m.paidRate, prev: m.prevPaidRate }))}
                series={[
                  { key: "cur", name: `${year}년`, color: "#0062ff" },
                  { key: "prev", name: `${year - 1}년`, color: "#a3a39d" },
                ]}
                unit="%"
                height={280}
                showValues
              />
            </HomeCard>
          </div>

          <HomeCard title="월별 상세">
            <DataTable
              head={["월", "진료비", "공단부담", "환자 부담", "환자 수납", "수납 비율", "미수 증감", "신환 기여도", "비급여 비중"]}
              rows={s.monthly
                .filter((m) => m.billed != null)
                .map((m) => [
                  `${m.month}월`,
                  won(m.billed),
                  won(m.ins),
                  won(m.due),
                  won(m.paid),
                  rate(m.paidRate),
                  m.arrears != null ? won(m.arrears) : "—",
                  rate(m.newShare),
                  rate(m.nonInsShare),
                ])}
            />
          </HomeCard>

          <NeedData title="이 화면에 없는 값">
            수납 비율은 같은 달의 수납과 부담액을 비교한 값이라 다른 달 진료비의 수납이 섞일 수 있습니다. 현재 미수 잔액과 경과 기간은 미수채권 원장,
            공단 실제 입금과 삭감은 공단 정산 자료가 있어야 합니다.
            {!s.anyArrears && " 이 치과는 일미수 값이 비어 있습니다."}
          </NeedData>
        </>
      )}
    </div>
  )
}
