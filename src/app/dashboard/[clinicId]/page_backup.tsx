export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import ProfessionalDashboard from "@/components/dashboard/ProfessionalDashboard"
import RevenueChart from "@/components/charts/RevenueChart"
import MonthSelector from "@/components/ui/MonthSelector"
import ReviewDashboard from "@/components/reviews/ReviewDashboard"
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

  // Goals API 데이터 가져오기
  const goals = await prisma.revenueGoal.findMany({
    where: {
      clinicId,
      year,
      month: month // 현재 월별 목표만
    }
  })

  const yearlyGoals = await prisma.revenueGoal.findMany({
    where: {
      clinicId,
      year,
      month: null // 연간 목표
    }
  })

  const monthlyGoal = goals[0]
  const yearlyGoal = yearlyGoals[0]

  const [current, previous] = await Promise.all([
    prisma.monthlySummary.findUnique({ where: { clinicId_year_month: { clinicId, year, month } } }),
    prisma.monthlySummary.findUnique({ where: { clinicId_year_month: { clinicId, year: prevYear, month: prevMonth } } }),
  ])

  // MonthlySummary가 없는 경우 ReceptionRecord에서 직접 계산
  let currentData = current
  if (!current) {
    const receptionRecords = await prisma.receptionRecord.findMany({
      where: {
        clinicId,
        receptionTime: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1)
        },
        totalRevenue: { gt: 0 }
      }
    })

    if (receptionRecords.length > 0) {
      const totalBilledRevenue = receptionRecords.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)
      const newPatientRecords = receptionRecords.filter(r => r.patientType === '신환')
      const newPatientRevenue = newPatientRecords.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)

      currentData = {
        totalRevenue: totalBilledRevenue, // 청구 기준으로 임시 설정
        totalBilledRevenue: totalBilledRevenue,
        newPatientRevenue: newPatientRevenue,
        newPatients: newPatientRecords.length,
        totalPatients: receptionRecords.length,
        // 다른 필드들은 null로 설정
        totalExpense: null,
        netProfit: null,
        cashIncome: null,
        cardIncome: null,
        insuranceClaim: null,
        nonInsuranceRevenue: null,
        workingDays: null,
        avgDailyRevenue: null,
        revisitRate: null,
        nonInsuranceRatio: null,
        revenueGrowth: null,
        newPatientGrowth: null
      }
    }
  }

  const last6 = await prisma.monthlySummary.findMany({
    where: { clinicId },
    orderBy: [{ year: "asc" }, { month: "asc" }],
    take: 6,
  })



  function pct(a?: number | null, b?: number | null) {
    if (!b || b === 0) return undefined
    return (((a ?? 0) - b) / b) * 100
  }

  // 목표 대비 달성률 계산
  const getGoalAnalysis = () => {
    const currentRevenue = currentData?.totalRevenue || 0
    const currentNewPatients = currentData?.newPatients || 0

    const monthlyRevenueGoal = monthlyGoal?.revenueGoal || 0
    const monthlyNewPatientGoal = monthlyGoal?.newPatientGoal || 0
    const yearlyRevenueGoal = yearlyGoal?.revenueGoal || 0

    const monthlyRevenueRate = monthlyRevenueGoal > 0 ? (currentRevenue / monthlyRevenueGoal) * 100 : 0
    const monthlyNewPatientRate = monthlyNewPatientGoal > 0 ? (currentNewPatients / monthlyNewPatientGoal) * 100 : 0

    // 연간 목표 진도율 (현재까지의 월 수 기준)
    const monthsElapsed = month
    const yearlyProgressRate = yearlyRevenueGoal > 0 ? (currentRevenue / (yearlyRevenueGoal / 12 * monthsElapsed)) * 100 : 0

    return {
      hasGoals: monthlyGoal || yearlyGoal,
      monthlyRevenueRate,
      monthlyNewPatientRate,
      yearlyProgressRate,
      monthlyRevenueGoal,
      monthlyNewPatientGoal,
      yearlyRevenueGoal
    }
  }

  const goalAnalysis = getGoalAnalysis()

  // 치과 정보 가져오기
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId }
  })

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

  // 새로운 대시보드를 위한 데이터 변환
  const dashboardData = {
    revenue: {
      current: currentData?.totalRevenue ?? 0,
      previous: previous?.totalRevenue ?? 0,
      target: monthlyGoal?.revenueGoal,
      monthlyData: last6.map(s => s.totalRevenue ?? 0)
    },
    patients: {
      total: currentData?.totalPatients ?? 0,
      new: currentData?.newPatients ?? 0,
      returning: (currentData?.totalPatients ?? 0) - (currentData?.newPatients ?? 0),
      growth: pct(currentData?.newPatients, previous?.newPatients) ?? 0,
      dailyData: [
        currentData?.newPatients ?? 0,
        Math.round((currentData?.newPatients ?? 0) * 1.2),
        Math.round((currentData?.newPatients ?? 0) * 0.8),
        Math.round((currentData?.newPatients ?? 0) * 1.1),
        Math.round((currentData?.newPatients ?? 0) * 0.9),
        Math.round((currentData?.newPatients ?? 0) * 1.3),
        currentData?.newPatients ?? 0
      ]
    },
    appointments: {
      today: Math.round((currentData?.totalPatients ?? 0) / (currentData?.workingDays ?? 20)),
      thisWeek: Math.round((currentData?.totalPatients ?? 0) * 0.25),
      completion: 85, // 임시값
      weeklyData: [15, 20, 18, 22, 19, 17, 21]
    },
    performance: {
      satisfaction: 4.5, // 임시값
      efficiency: Math.round((currentData?.workingDays ?? 0) / 30 * 100),
      growth: pct(currentData?.totalRevenue, previous?.totalRevenue) ?? 0
    }
  }

  return (
    <ProfessionalDashboard
      data={dashboardData}
      clinicName={clinic?.name ?? "치과"}
      period={{ year, month }}
    >
      {/* 월 선택 */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">기간 선택</h2>
            <p className="text-sm text-slate-600">
              {year}년 {month}월 경영지표
            </p>
          </div>
          <Suspense>
            <MonthSelector
              availableMonths={availableMonths}
              currentYear={year}
              currentMonth={month}
            />
          </Suspense>
        </div>

      {/* 데이터 없음 안내 */}
      {!currentData && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-[14px] text-amber-700">
          {year}년 {month}월 데이터가 없습니다. 엑셀을 업로드하거나 다른 월을 선택하세요.
        </div>
      )}

      {/* 핵심 지표 */}
      <SectionCard title={`${year}년 ${month}월 핵심 지표`} description="필수 지표 요약">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="총 매출"
            value={formatAmount(currentData?.totalRevenue ?? 0)}
            unit=""
            change={pct(currentData?.totalRevenue, previous?.totalRevenue)}
            icon={<TrendingUp className="w-4 h-4" />}
            color="blue"
          />
          <KpiCard
            label="신환 수"
            value={currentData?.newPatients ?? 0}
            unit="명"
            change={pct(currentData?.newPatients, previous?.newPatients)}
            icon={<Users className="w-4 h-4" />}
            color="green"
          />
          {goalAnalysis.hasGoals && (
            <KpiCard
              label="월 목표 달성률"
              value={goalAnalysis.monthlyRevenueRate.toFixed(1)}
              unit="%"
              icon={<Target className="w-4 h-4" />}
              color={goalAnalysis.monthlyRevenueRate >= 100 ? "green" :
                     goalAnalysis.monthlyRevenueRate >= 80 ? "blue" : "red"}
            />
          )}
        </div>

        {/* 추가 분석 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] text-blue-600 font-medium">일평균 매출</div>
                <div className="text-[24px] font-bold text-blue-700 mt-1">
                  {currentData?.avgDailyRevenue ?
                    `${Math.round(currentData.avgDailyRevenue / 10000).toLocaleString()}만원` : "—"}
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
                  {currentData?.revisitRate ? `${currentData.revisitRate.toFixed(1)}%` : "—"}
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
                  {currentData?.nonInsuranceRatio ? `${currentData.nonInsuranceRatio.toFixed(1)}%` : "—"}
                </div>
                <div className="text-[12px] text-yellow-600 mt-1">수익성 지표</div>
              </div>
              <div className="text-[32px] text-yellow-500">📈</div>
            </div>
          </div>
          <div className="bg-purple-50 rounded-xl p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] text-purple-600 font-medium">신환 객단가</div>
                <div className="text-[24px] font-bold text-purple-700 mt-1">
                  {currentData?.newPatientRevenue && currentData?.newPatients && currentData.newPatients > 0 ?
                    formatAmount(currentData.newPatientRevenue / currentData.newPatients) : "—"}
                </div>
                <div className="text-[12px] text-purple-600 mt-1">신환 평균 진료비</div>
              </div>
              <div className="text-[32px] text-purple-500">👤</div>
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
      {currentData && (
        <SectionCard title="경영 성과 요약" description="월별 성장률 및 운영 지표">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-blue-600 font-medium">매출 성장률</div>
                  <div className={`text-[24px] font-bold mt-1 tabular-nums ${
                    (pct(currentData?.totalRevenue, previous?.totalRevenue) ?? 0) >= 0 ? "text-blue-700" : "text-red-600"
                  }`}>
                    {(() => {
                      const growth = pct(currentData?.totalRevenue, previous?.totalRevenue)
                      if (growth === undefined) return "—"
                      return `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%`
                    })()}
                  </div>
                  <div className="text-[12px] text-blue-600 mt-1">전월 대비</div>
                </div>
                <div className="text-[32px] text-blue-500">
                  {(pct(currentData?.totalRevenue, previous?.totalRevenue) ?? 0) >= 0 ? "📈" : "📉"}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-green-600 font-medium">신환 성장률</div>
                  <div className={`text-[24px] font-bold mt-1 tabular-nums ${
                    (pct(currentData?.newPatients, previous?.newPatients) ?? 0) >= 0 ? "text-green-700" : "text-red-600"
                  }`}>
                    {(() => {
                      const growth = pct(currentData?.newPatients, previous?.newPatients)
                      if (growth === undefined) return "—"
                      return `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%`
                    })()}
                  </div>
                  <div className="text-[12px] text-green-600 mt-1">전월 대비</div>
                </div>
                <div className="text-[32px] text-green-500">
                  {(pct(currentData?.newPatients, previous?.newPatients) ?? 0) >= 0 ? "👥" : "👤"}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-yellow-600 font-medium">근무일수</div>
                  <div className="text-[24px] font-bold text-yellow-700 mt-1 tabular-nums">
                    {currentData?.workingDays ?? "—"}일
                  </div>
                  <div className="text-[12px] text-yellow-600 mt-1">이번 달 총 근무일</div>
                </div>
                <div className="text-[32px] text-yellow-500">📅</div>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* 목표 관리 및 달성 현황 */}
      {goalAnalysis.hasGoals ? (
        <SectionCard title="목표 달성 현황" description="월별 및 연간 목표 대비 실적">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 월 매출 목표 */}
            {monthlyGoal?.revenueGoal && (
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[16px] font-semibold text-[#191f28]">월 매출 목표</h4>
                  <Target className="w-5 h-5 text-blue-600" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] text-[#6b7280]">목표</span>
                    <span className="text-[16px] font-bold text-blue-700">
                      {formatAmount(monthlyGoal.revenueGoal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] text-[#6b7280]">달성</span>
                    <span className="text-[16px] font-bold text-green-700">
                      {formatAmount(currentData?.totalRevenue ?? 0)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        goalAnalysis.monthlyRevenueRate >= 100 ? 'bg-green-500' :
                        goalAnalysis.monthlyRevenueRate >= 80 ? 'bg-blue-500' :
                        goalAnalysis.monthlyRevenueRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{width: `${Math.min(100, goalAnalysis.monthlyRevenueRate)}%`}}
                    ></div>
                  </div>
                  <div className="text-center">
                    <span className="text-[20px] font-bold text-blue-700">
                      {goalAnalysis.monthlyRevenueRate.toFixed(1)}%
                    </span>
                    <p className="text-[12px] text-[#6b7280] mt-1">
                      {goalAnalysis.monthlyRevenueRate >= 100 ? '🎉 목표 달성!' :
                       `${(100 - goalAnalysis.monthlyRevenueRate).toFixed(1)}% 남음`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 월 신환 목표 */}
            {monthlyGoal?.newPatientGoal && (
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[16px] font-semibold text-[#191f28]">월 신환 목표</h4>
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] text-[#6b7280]">목표</span>
                    <span className="text-[16px] font-bold text-green-700">
                      {monthlyGoal.newPatientGoal}명
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] text-[#6b7280]">달성</span>
                    <span className="text-[16px] font-bold text-blue-700">
                      {currentData?.newPatients ?? 0}명
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        goalAnalysis.monthlyNewPatientRate >= 100 ? 'bg-green-500' :
                        goalAnalysis.monthlyNewPatientRate >= 80 ? 'bg-blue-500' :
                        goalAnalysis.monthlyNewPatientRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{width: `${Math.min(100, goalAnalysis.monthlyNewPatientRate)}%`}}
                    ></div>
                  </div>
                  <div className="text-center">
                    <span className="text-[20px] font-bold text-green-700">
                      {goalAnalysis.monthlyNewPatientRate.toFixed(1)}%
                    </span>
                    <p className="text-[12px] text-[#6b7280] mt-1">
                      {goalAnalysis.monthlyNewPatientRate >= 100 ? '🎉 목표 달성!' :
                       `${Math.max(0, monthlyGoal.newPatientGoal - (currentData?.newPatients ?? 0))}명 남음`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 연간 목표 진도 */}
            {yearlyGoal?.revenueGoal && (
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[16px] font-semibold text-[#191f28]">연간 목표 진도</h4>
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] text-[#6b7280]">연간 목표</span>
                    <span className="text-[16px] font-bold text-purple-700">
                      {formatAmount(yearlyGoal.revenueGoal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] text-[#6b7280]">{month}월까지 기대</span>
                    <span className="text-[16px] font-bold text-blue-700">
                      {formatAmount(yearlyGoal.revenueGoal / 12 * month)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        goalAnalysis.yearlyProgressRate >= 100 ? 'bg-green-500' :
                        goalAnalysis.yearlyProgressRate >= 80 ? 'bg-blue-500' :
                        goalAnalysis.yearlyProgressRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{width: `${Math.min(100, goalAnalysis.yearlyProgressRate)}%`}}
                    ></div>
                  </div>
                  <div className="text-center">
                    <span className="text-[20px] font-bold text-purple-700">
                      {goalAnalysis.yearlyProgressRate.toFixed(1)}%
                    </span>
                    <p className="text-[12px] text-[#6b7280] mt-1">
                      {goalAnalysis.yearlyProgressRate >= 100 ? '🚀 목표 이상 달성!' :
                       goalAnalysis.yearlyProgressRate >= 80 ? '📈 순조로운 진행' : '⚡ 가속 필요'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 목표 설정 안내 */}
          <div className="mt-6 text-center">
            <a
              href="/admin/goals"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
            >
              <Target className="w-4 h-4 mr-2" />
              목표 관리하기
            </a>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="목표 관리" description="매출 목표를 설정하여 성과를 추적하세요">
          <div className="text-center py-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <Target className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">매출 목표를 설정하세요</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              월별 및 연간 매출 목표를 설정하면 실시간으로 달성률을 추적하고 성장을 관리할 수 있습니다.
            </p>
            <a
              href="/admin/goals"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Target className="w-4 h-4 mr-2" />
              목표 설정하기
            </a>
          </div>
        </SectionCard>
      )}

      {/* 온라인 리뷰 현황 */}
      <Suspense fallback={<div className="text-center py-8">리뷰 데이터를 불러오는 중...</div>}>
        <ReviewDashboard
          clinicId={clinicId}
          year={year}
          month={month}
        />
      </Suspense>
    </div>
  )
}
