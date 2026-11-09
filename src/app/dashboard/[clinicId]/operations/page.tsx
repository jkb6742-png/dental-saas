export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { resolveMonth } from "@/lib/utils/monthHelper"
import { getOperationStats } from "@/lib/dashboard/insights"
import YearCompareChart from "@/components/charts/YearCompareChart"
import HomeCard from "@/components/dashboard/HomeCard"
import { DataTable, MetricRow, NeedData, PageHead, num, rate, won } from "@/components/dashboard/ui"

const DOW = ["일", "월", "화", "수", "목", "금", "토"]

export default async function OperationsPage({
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
  const s = await getOperationStats(clinicId, year, month)
  const series = [
    { key: "cur", name: `${year}년`, color: "#0062ff" },
    { key: "prev", name: `${year - 1}년`, color: "#a3a39d" },
  ]
  const totalBilled = s.doctors.reduce((a, d) => a + d.billed, 0)

  return (
    <div className="space-y-3">
      <PageHead title={`${year}년 ${month}월 진료 운영`} note="영업일은 접수가 있었던 날 기준" year={year} month={month} availableMonths={availableMonths} />

      <MetricRow
        items={[
          { label: "접수 발생일", value: num(s.current?.days), unit: "일" },
          { label: "영업일당 진료비", value: won(s.current?.revCur) },
          { label: "영업일당 환자", value: num(s.current?.visitCur, 1), unit: "명", note: "날짜별 실환자 기준" },
          { label: "평균 대기", value: s.wait?.avg != null ? num(s.wait.avg, 1) : "—", unit: "분", note: s.wait ? `기록 ${num(s.wait.n)}건 / ${rate(s.wait.rate)}` : undefined },
          { label: "30분 초과", value: rate(s.wait?.over30Rate), note: s.wait ? `${num(s.wait.over30)}건, 기록 건 중` : undefined },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <HomeCard title="영업일당 진료비" note={`${year}년 vs ${year - 1}년`}>
          <YearCompareChart data={s.trend.map((t) => ({ label: t.label, cur: t.revCur, prev: t.revPrev }))} series={series} unit="원" height={260} showValues />
        </HomeCard>
        <HomeCard title="영업일당 환자" note={`${year}년 vs ${year - 1}년`}>
          <YearCompareChart data={s.trend.map((t) => ({ label: t.label, cur: t.visitCur, prev: t.visitPrev }))} series={series} unit="명" height={260} showValues />
        </HomeCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <HomeCard title="요일별 환자·대기" note={`${month}월`}>
          <DataTable
            head={["요일", "진료일", "일평균 환자", "대기 기록", "평균 대기", "30분 초과"]}
            rows={s.weekday.map((d) => [
              DOW[d.dow],
              `${d.days}일`,
              `${num(d.days ? d.visits / d.days : null, 1)}명`,
              `${num(d.waitN)}건`,
              d.waitAvg != null ? `${num(d.waitAvg, 1)}분` : "—",
              d.waitN ? rate((d.over30 / d.waitN) * 100) : "—",
            ])}
          />
        </HomeCard>
        {s.hours.length > 1 ? (
          <HomeCard title="시간대별 접수" note={`${month}월 전체 접수 건`}>
            <YearCompareChart
              data={s.hours.map((h) => ({ label: `${h.h}시`, visits: h.visits }))}
              series={[{ key: "visits", name: "접수", color: "#0062ff" }]}
              unit="명"
              height={280}
              showValues
            />
          </HomeCard>
        ) : (
          <NeedData title="시간대별 접수">
            접수수납 자료의 접수 시각이 날짜만 저장되어 있어 시간대를 나눌 수 없습니다. 원본 엑셀에 시각이 있는지 확인이 필요합니다.
          </NeedData>
        )}
      </div>

      {s.doctors.length ? (
        <HomeCard title="진료의별 진료비·환자" note={`${month}월 · 접수 건에 기록된 담당 의사 기준`}>
          <DataTable
            head={["진료의", "진료비", "비중", "실환자", "환자당 진료비", "접수 건"]}
            rows={s.doctors.map((d) => [
              d.doctor,
              won(d.billed),
              rate(totalBilled ? (d.billed / totalBilled) * 100 : null),
              `${num(d.patients)}명`,
              won(d.patients ? d.billed / d.patients : null),
              `${num(d.visits)}건`,
            ])}
          />
        </HomeCard>
      ) : (
        <NeedData title="진료의 자료 없음">접수수납목록의 담당 의사 값이 비어 있어 진료의별 실적을 표시할 수 없습니다.</NeedData>
      )}

      {(s.fill?.chair ?? 0) === 0 || (s.fill?.times ?? 0) === 0 ? (
        <NeedData title="체어 가동률">
          체어 번호와 진료 시작·종료 시각이 없어 계산하지 않습니다. 원본 엑셀에 값이 있는지 먼저 확인해야 합니다.
        </NeedData>
      ) : null}
    </div>
  )
}
