export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { resolveMonth } from "@/lib/utils/monthHelper"
import { getRetentionStats } from "@/lib/dashboard/insights"
import YearCompareChart from "@/components/charts/YearCompareChart"
import HomeCard from "@/components/dashboard/HomeCard"
import { DataTable, MetricRow, NeedData, PageHead, num, rate } from "@/components/dashboard/ui"

export default async function RetentionPage({
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
  const s = await getRetentionStats(clinicId, year, month)

  return (
    <div className="space-y-3">
      <PageHead
        title="환자 유지"
        note={s ? `접수수납목록 ${s.dataFirst} ~ ${s.dataLast} 기준` : undefined}
        year={year}
        month={month}
        availableMonths={availableMonths}
      />

      {!s ? (
        <NeedData title="접수수납 자료 없음">접수수납목록을 올리면 재내원과 활성 환자를 계산합니다.</NeedData>
      ) : (
        <>
          <MetricRow
            items={[
              {
                label: "신환 90일 재내원율",
                value: rate(s.latest90?.r90),
                note: s.latest90 ? `${s.latest90.label} 신환 ${num(s.latest90.n90)}명 기준` : "관찰 완료 코호트 없음",
              },
              {
                label: "활성 환자",
                value: s.active != null ? num(s.active) : "자료 부족",
                unit: s.active != null ? "명" : undefined,
                note: s.active != null ? `${s.asOf} 기준 최근 12개월 내원` : "최근 12개월 자료 필요",
              },
              {
                label: "휴면 환자",
                value: s.dormant != null ? num(s.dormant) : "자료 부족",
                unit: s.dormant != null ? "명" : undefined,
                note: s.dormant != null ? "그 전 12개월 내원, 최근 12개월 미내원" : "24개월 자료 필요",
              },
              {
                label: "휴면 비율",
                value: s.dormantRate != null ? rate(s.dormantRate) : "자료 부족",
                note: s.prevBase != null ? `그 전 12개월 환자 ${num(s.prevBase)}명 중` : "24개월 자료 필요",
              },
            ]}
          />

          <HomeCard title="신환 코호트별 재내원율" note="첫 내원월 기준 · 코호트 전원의 관찰이 끝난 값만 표시">
            <YearCompareChart
              data={s.rows.map((r) => ({ label: r.label.slice(2), d30: r.r30, d90: r.r90, d180: r.r180 }))}
              series={[
                { key: "d30", name: "30일", color: "#a3a39d" },
                { key: "d90", name: "90일", color: "#0062ff" },
                { key: "d180", name: "180일", color: "#191f28" },
              ]}
              unit="%"
              height={300}
            />
          </HomeCard>

          <HomeCard title="코호트 상세" note="같은 날 복수 접수는 한 번의 방문으로 계산">
            <DataTable
              head={["첫 내원월", "신환", "30일", "90일", "180일", "재내원까지 중앙값"]}
              rows={s.rows.map((r) => [
                r.label,
                `${num(r.size)}명`,
                r.r30 != null ? rate(r.r30) : "관찰 중",
                r.r90 != null ? rate(r.r90) : "관찰 중",
                r.r180 != null ? rate(r.r180) : "관찰 중",
                r.medianGap != null ? `${num(r.medianGap)}일` : "—",
              ])}
            />
          </HomeCard>

          <NeedData title="해석할 때">
            자료 시작일 이전의 방문은 알 수 없어 활성·휴면은 자료 기간 안에서만 계산합니다. 리콜 재내원율은 리콜구분 값이 비어 있어 표시하지 않습니다.
          </NeedData>
        </>
      )}
    </div>
  )
}
