export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import ConsultationsPageClient from "./ConsultationsPageClient"
import { getConsultStats } from "@/lib/dashboard/insights"
import YearCompareChart from "@/components/charts/YearCompareChart"
import HomeCard from "@/components/dashboard/HomeCard"
import { MetricRow, NeedData, num, rate, won } from "@/components/dashboard/ui"

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

  // 기본값을 전달로 설정 (월초에 전달 지표를 정리하므로)
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const defaultYear = lastMonth.getFullYear()
  const defaultMonth = lastMonth.getMonth() + 1

  const year = sp.year ? parseInt(sp.year) : defaultYear
  const month = sp.month ? parseInt(sp.month) : defaultMonth

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

  const flow = await getConsultStats(clinicId, year, month)

  // 데이터가 없는 경우
  if (yearlyData.length === 0 && monthlyData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[14px] text-[#8b95a1]">
        상담 성과 데이터가 없습니다. 엑셀을 업로드해주세요.
      </div>
    )
  }

  return (
    <div className="space-y-3">
    <ConsultationsPageClient
      clinicId={clinicId}
      initialYear={year}
      initialMonth={month}
      yearlyData={yearlyData}
      monthlyData={monthlyData}
      availableData={availableData}
    />
    <MetricRow
      items={[
        { label: "계획 기준 확정률", value: rate(flow.rate), note: `계획 ${num(flow.cur?.plan)}건 중 ${num(flow.cur?.done)}건` },
        { label: "환자 기준 확정률", value: rate(flow.patientRate), note: `환자 ${num(flow.cur?.pat)}명 중 ${num(flow.cur?.patDone)}명` },
        { label: "미확정 계획", value: num(flow.open), unit: "건", note: "금액은 계획 원장 필요" },
        { label: "확정 건당 금액", value: won(flow.avgAmount) },
        { label: "최근 3개월 확정률", value: rate(flow.recentRate), note: "계획 기준" },
      ]}
    />
    <HomeCard title="계획 기준 확정률" note={`${year}년 vs ${year - 1}년`}>
      <YearCompareChart
        data={flow.trend}
        series={[
          { key: "cur", name: `${year}년`, color: "#0062ff" },
          { key: "prev", name: `${year - 1}년`, color: "#a3a39d" },
        ]}
        unit="%"
        height={260}
        showValues
      />
    </HomeCard>
    <NeedData title="상담 이후 진행">
      {flow.planRows === 0
        ? "치료비용계획 자료가 적재되어 있지 않아 미확정 금액, 계약 잔액, 다음 예약 미등록 환자를 표시하지 않습니다. "
        : `치료비용계획 ${num(flow.planRows)}건이 적재되어 있습니다. `}
      치료 시작률과 완료율은 치료 진행 기록이 있어야 합니다.
    </NeedData>
    </div>
  )
}
