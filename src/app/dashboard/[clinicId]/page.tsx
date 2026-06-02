export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import KpiCard from "@/components/ui/KpiCard"
import SectionCard from "@/components/ui/SectionCard"
import RevenueChart from "@/components/charts/RevenueChart"
import MonthSelector from "@/components/ui/MonthSelector"
import { TrendingUp, Users, Activity, DollarSign, Calendar, Target } from "lucide-react"
import { Suspense } from "react"

export default async function DashboardHome({
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

  // 데이터가 있는 월 목록 조회
  const availableMonths = await prisma.monthlySummary.findMany({
    where: { clinicId },
    select: { year: true, month: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  })

  // 선택된 월 (없으면 가장 최근 데이터 월, 없으면 현재 월)
  const latest = availableMonths[0]
  const now = new Date()
  const year = sp.year ? parseInt(sp.year) : (latest?.year ?? now.getFullYear())
  const month = sp.month ? parseInt(sp.month) : (latest?.month ?? now.getMonth() + 1)

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  const [current, previous] = await Promise.all([
    prisma.monthlySummary.findUnique({ where: { clinicId_year_month: { clinicId, year, month } } }),
    prisma.monthlySummary.findUnique({ where: { clinicId_year_month: { clinicId, year: prevYear, month: prevMonth } } }),
  ])

  const last6 = await prisma.monthlySummary.findMany({
    where: { clinicId },
    orderBy: [{ year: "asc" }, { month: "asc" }],
    take: 6,
  })

  function pct(a?: number | null, b?: number | null) {
    if (!b || b === 0) return undefined
    return (((a ?? 0) - b) / b) * 100
  }

  // 금액 포맷팅 함수
  const formatAmount = (amount: number): string => {
    if (amount >= 100000000) { // 1억 이상
      const billions = Math.floor(amount / 100000000);
      const remainder = amount % 100000000;
      if (remainder === 0) {
        return `${billions}억원`;
      } else {
        const thousands = Math.round(remainder / 10000);
        if (thousands === 0) {
          return `${billions}억원`;
        }
        return `${billions}억 ${thousands.toLocaleString()}만원`;
      }
    } else { // 1억 미만
      const thousands = Math.round(amount / 10000);
      if (thousands === 0) {
        return "0원";
      }
      return `${thousands.toLocaleString()}만원`;
    }
  }

  return (
    <div className="space-y-6">
      {/* 년도 헤더 */}
      <div className="text-center border-b border-[#e5e8eb] pb-6">
        <h1 className="text-[32px] font-bold text-[#191f28] mb-2">{year}년</h1>
        <p className="text-[16px] text-[#6b7280]">종합 경영 대시보드</p>
      </div>

      {/* 월 선택 */}
      <div className="flex items-center justify-between">
        <p className="text-[14px] text-[#8b95a1]">
          {year}년 {month}월 경영지표
        </p>
        <Suspense>
          <MonthSelector
            availableMonths={availableMonths}
            currentYear={year}
            currentMonth={month}
          />
        </Suspense>
      </div>

      {/* 데이터 없음 안내 */}
      {!current && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-[14px] text-amber-700">
          {year}년 {month}월 데이터가 없습니다. 엑셀을 업로드하거나 다른 월을 선택하세요.
        </div>
      )}

      {/* 핵심 지표 */}
      <SectionCard title={`${year}년 ${month}월 핵심 지표`} description="필수 지표 요약">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <KpiCard
            label="총 매출"
            value={formatAmount(current?.totalRevenue ?? 0)}
            unit=""
            change={pct(current?.totalRevenue, previous?.totalRevenue)}
            icon={<TrendingUp className="w-4 h-4" />}
            color="blue"
          />
          <KpiCard
            label="신환 수"
            value={current?.newPatients ?? 0}
            unit="명"
            change={pct(current?.newPatients, previous?.newPatients)}
            icon={<Users className="w-4 h-4" />}
            color="green"
          />
          <KpiCard
            label="1인 객단가"
            value={current?.newPatientRevenue && current?.newPatients ?
              formatAmount(current.newPatientRevenue / current.newPatients) : "—"}
            unit=""
            icon={<DollarSign className="w-4 h-4" />}
            color="yellow"
          />
        </div>

        {/* 추가 분석 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] text-blue-600 font-medium">일평균 매출</div>
                <div className="text-[24px] font-bold text-blue-700 mt-1">
                  {current?.avgDailyRevenue ?
                    `${Math.round(current.avgDailyRevenue / 10000).toLocaleString()}만원` : "—"}
                </div>
                <div className="text-[12px] text-blue-600 mt-1">근무일 기준</div>
              </div>
              <div className="text-[32px] text-blue-500">💰</div>
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] text-green-600 font-medium">재방문율</div>
                <div className="text-[24px] font-bold text-green-700 mt-1">
                  {current?.revisitRate ? `${current.revisitRate.toFixed(1)}%` : "—"}
                </div>
                <div className="text-[12px] text-green-600 mt-1">환자 충성도 지표</div>
              </div>
              <div className="text-[32px] text-green-500">🔄</div>
            </div>
          </div>
          <div className="bg-yellow-50 rounded-xl p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] text-yellow-600 font-medium">비급여 비율</div>
                <div className="text-[24px] font-bold text-yellow-700 mt-1">
                  {current?.nonInsuranceRatio ? `${current.nonInsuranceRatio.toFixed(1)}%` : "—"}
                </div>
                <div className="text-[12px] text-yellow-600 mt-1">수익성 지표</div>
              </div>
              <div className="text-[32px] text-yellow-500">📈</div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 매출 트렌드 */}
      <SectionCard title="매출 트렌드" description={`최근 ${last6.length}개월`}>
        {last6.length > 0 ? (
          <RevenueChart data={last6.map((s) => ({
            label: `${s.year}.${String(s.month).padStart(2, "0")}`,
            revenue: s.totalRevenue ?? 0,
            net: s.netProfit ?? 0,
          }))} />
        ) : (
          <div className="text-center py-12 text-[14px] text-[#8b95a1]">
            데이터가 없습니다. 엑셀 업로드 후 차트가 표시됩니다.
          </div>
        )}
      </SectionCard>

      {/* 경영 성과 요약 */}
      {current && (
        <SectionCard title="경영 성과 요약" description="월별 성장률 및 운영 지표">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-blue-600 font-medium">매출 성장률</div>
                  <div className={`text-[24px] font-bold mt-1 tabular-nums ${
                    (current.revenueGrowth ?? 0) >= 0 ? "text-blue-700" : "text-red-600"
                  }`}>
                    {(current.revenueGrowth ?? 0) > 0 ? "+" : ""}{current.revenueGrowth?.toFixed(1) ?? "—"}%
                  </div>
                  <div className="text-[12px] text-blue-600 mt-1">전월 대비</div>
                </div>
                <div className="text-[32px] text-blue-500">
                  {(current.revenueGrowth ?? 0) >= 0 ? "📈" : "📉"}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-green-600 font-medium">신환 성장률</div>
                  <div className={`text-[24px] font-bold mt-1 tabular-nums ${
                    (current.newPatientGrowth ?? 0) >= 0 ? "text-green-700" : "text-red-600"
                  }`}>
                    {(current.newPatientGrowth ?? 0) > 0 ? "+" : ""}{current.newPatientGrowth?.toFixed(1) ?? "—"}%
                  </div>
                  <div className="text-[12px] text-green-600 mt-1">전월 대비</div>
                </div>
                <div className="text-[32px] text-green-500">
                  {(current.newPatientGrowth ?? 0) >= 0 ? "👥" : "👤"}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-yellow-600 font-medium">근무일수</div>
                  <div className="text-[24px] font-bold text-yellow-700 mt-1 tabular-nums">
                    {current.workingDays ?? "—"}일
                  </div>
                  <div className="text-[12px] text-yellow-600 mt-1">이번 달 총 근무일</div>
                </div>
                <div className="text-[32px] text-yellow-500">📅</div>
              </div>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
