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

  // 데이터가 있는 월 목록 조회 (현재 날짜 이후 제외)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const availableMonths = await prisma.monthlySummary.findMany({
    where: {
      clinicId,
      OR: [
        { year: { lt: currentYear } },
        {
          year: currentYear,
          month: { lte: currentMonth }
        }
      ]
    },
    select: { year: true, month: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  })

  // 선택된 월 (없으면 가장 최근 데이터 월, 없으면 현재 월)
  const latest = availableMonths[0]
  let year = sp.year ? parseInt(sp.year) : (latest?.year ?? currentYear)
  let month = sp.month ? parseInt(sp.month) : (latest?.month ?? currentMonth)

  // 선택된 날짜가 미래인 경우 현재 월로 제한
  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    year = currentYear
    month = currentMonth
  }

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  // Goals API 데이터 가져오기
  const goals = await prisma.revenueGoal.findMany({
    where: {
      clinicId,
      year,
      month: month
    }
  })

  const yearlyGoals = await prisma.revenueGoal.findMany({
    where: {
      clinicId,
      year,
      month: null
    }
  })

  const monthlyGoal = goals[0]
  const yearlyGoal = yearlyGoals[0]

  // 실제 액션플랜 데이터 가져오기
  const rawActionPlans = await prisma.actionPlan.findMany({
    where: { clinicId },
    include: {
      attachments: true,
      comments: {
        include: {
          user: {
            select: { name: true, role: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      },
      user: {
        select: { name: true, role: true }
      }
    },
    orderBy: [
      { priority: 'asc' }, // HIGH(0) > MEDIUM(1) > LOW(2)
      { createdAt: 'desc' }
    ]
  })

  // Enum 값을 한국어로 변환하여 actionPlans 생성
  const actionPlans = rawActionPlans.map(plan => ({
    id: plan.id,
    goal: plan.goal,
    targetDate: plan.targetDate,
    description: plan.description,
    status: plan.status === 'PENDING' ? '시작전' : plan.status === 'IN_PROGRESS' ? '진행중' : '완료' as const,
    createdAt: plan.createdAt,
    progress: plan.progress || 0,
    priority: plan.priority === 'HIGH' ? '상' : plan.priority === 'MEDIUM' ? '중' : '하' as const,
    attachments: plan.attachments || [],
    comments: plan.comments?.map(comment => ({
      id: comment.id,
      content: comment.content,
      author: comment.user?.name || '알 수 없음',
      authorRole: comment.user?.role || 'USER',
      createdAt: comment.createdAt
    })) || []
  }))

  // 마스터가 입력한 월별 현금매출 → 총매출에 가산
  const cashRows = await prisma.cashRevenue.findMany({
    where: { clinicId },
    select: { year: true, month: true, amount: true },
  }).catch(() => [] as Array<{ year: number; month: number; amount: number }>)
  const cashMap = new Map(cashRows.map((c) => [`${c.year}-${c.month}`, c.amount || 0]))
  const cashOf = (y: number, m: number) => cashMap.get(`${y}-${m}`) ?? 0

  // 실제 월간장부 데이터(DailyLedger)에서 집계
  const [currentLedger, previousLedger] = await Promise.all([
    prisma.dailyLedger.findMany({ where: { clinicId, year, month } }),
    prisma.dailyLedger.findMany({ where: { clinicId, year: prevYear, month: prevMonth } }),
  ])

  // DailyLedger에서 월간 집계 계산
  const calculateMonthlyTotal = (ledgerData: any[]) => {
    if (ledgerData.length === 0) return null

    const totals = ledgerData.reduce((acc, day) => ({
      totalRevenue: acc.totalRevenue + (day.cashIncome || 0) + (day.cardIncome || 0) + (day.onlineIncome || 0) + (day.insuranceClaim || 0), // 매출=청구포함총수입(현금+카드+온라인+공단부담)
      totalExpense: acc.totalExpense + (day.cashExpense || 0) + (day.cardExpense || 0),
      cashIncome: acc.cashIncome + (day.cashIncome || 0),
      cardIncome: acc.cardIncome + (day.cardIncome || 0),
      insuranceClaim: acc.insuranceClaim + (day.insuranceClaim || 0),
    }), {
      totalRevenue: 0,
      totalExpense: 0,
      cashIncome: 0,
      cardIncome: 0,
      insuranceClaim: 0,
    })

    return totals
  }

  const current = calculateMonthlyTotal(currentLedger)
  const previous = calculateMonthlyTotal(previousLedger)

  // 현금매출 가산 (총매출 = 장부매출 + 현금매출)
  if (current) current.totalRevenue += cashOf(year, month)
  if (previous) previous.totalRevenue += cashOf(prevYear, prevMonth)

  // 환자 수 정보는 ReceptionRecord에서 별도 조회
  const [currentPatients, previousPatients] = await Promise.all([
    prisma.receptionRecord.findMany({ where: { clinicId, year, month } }),
    prisma.receptionRecord.findMany({ where: { clinicId, year: prevYear, month: prevMonth } }),
  ])

  const calculatePatientStats = (records: any[]) => {
    if (records.length === 0) return { newPatients: 0, totalPatients: 0, newPatientRevenue: 0 }

    // 올바른 환자 분류: 환자별로 신환/구환 판단 (중복 방지)
    const patientGroups = new Map()
    records.forEach(record => {
      const chartNumber = record.chartNumber
      if (!patientGroups.has(chartNumber)) {
        patientGroups.set(chartNumber, [])
      }
      patientGroups.get(chartNumber).push(record)
    })

    let newPatientCount = 0

    // 각 환자별로 신환/구환 판단
    patientGroups.forEach((visits, chartNumber) => {
      // 이 환자의 모든 방문 중에서 신환 타입이 있는지 확인
      const hasNewPatientVisit = visits.some(visit => {
        const type = String(visit.patientType || '').trim().toLowerCase()
        return type.includes('신환') || type === 'new' || type === '신'
      })

      if (hasNewPatientVisit) {
        newPatientCount++
      }
    })

    // 신환 매출 계산
    const newPatientRecords = records.filter(record => {
      const type = String(record.patientType || '').trim().toLowerCase()
      return type.includes('신환') || type === 'new' || type === '신'
    })
    const newPatientRevenue = newPatientRecords.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)

    return {
      newPatients: newPatientCount,
      totalPatients: patientGroups.size,
      newPatientRevenue
    }
  }

  const currentPatientStats = calculatePatientStats(currentPatients)
  const previousPatientStats = calculatePatientStats(previousPatients)

  // MonthlySummary가 없는 경우 ReceptionRecord에서 직접 계산
  let currentData = current
  if (!current) {
    const receptionRecords = await prisma.receptionRecord.findMany({
      where: {
        clinicId,
        year,
        month
      }
    })

    if (receptionRecords.length > 0) {
      // 신환/구환 분류 (환자통계와 동일한 로직)
      const newPatients = receptionRecords.filter(record => {
        const type = String(record.patientType || '').trim().toLowerCase()
        return type.includes('신환') || type === 'new' || type === '신'
      })

      const returningPatients = receptionRecords.filter(record => {
        const type = String(record.patientType || '').trim().toLowerCase()
        return type.includes('구환') || type === 'returning' || type === '구' ||
               type.includes('재진') || type === 'return'
      })

      // chartNumber 기준으로 중복 제거 (환자통계와 동일)
      const uniqueNewPatients = Array.from(
        new Map(newPatients.map(p => [p.chartNumber, p])).values()
      )

      const allUniquePatients = Array.from(
        new Map(receptionRecords.map(p => [p.chartNumber, p])).values()
      )

      const totalBilledRevenue = receptionRecords.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)
      const newPatientRevenue = newPatients.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)

      currentData = {
        totalRevenue: totalBilledRevenue + cashOf(year, month),
        totalBilledRevenue: totalBilledRevenue,
        newPatientRevenue: newPatientRevenue,
        newPatients: uniqueNewPatients.length,
        totalPatients: allUniquePatients.length,
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

  // 최근 6개월 실제 월간장부 데이터 조회 및 집계
  const last6Months = []
  for (let i = 5; i >= 0; i--) {
    let targetMonth = month - i
    let targetYear = year

    if (targetMonth <= 0) {
      targetMonth += 12
      targetYear -= 1
    }

    const monthlyLedger = await prisma.dailyLedger.findMany({
      where: { clinicId, year: targetYear, month: targetMonth }
    })

    const monthlyPatients = await prisma.receptionRecord.findMany({
      where: { clinicId, year: targetYear, month: targetMonth }
    })

    const totalRevenue = monthlyLedger.reduce((sum, day) =>
      sum + (day.cashIncome || 0) + (day.cardIncome || 0) + (day.onlineIncome || 0) + (day.insuranceClaim || 0), 0 // 매출=청구포함총수입
    )

    const patientStats = calculatePatientStats(monthlyPatients)

    last6Months.push({
      year: targetYear,
      month: targetMonth,
      totalRevenue: totalRevenue + cashOf(targetYear, targetMonth),
      newPatients: patientStats.newPatients,
      totalPatients: patientStats.totalPatients
    })
  }

  const sortedLast6 = last6Months

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
    if (amount >= 100000000) {
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
    } else {
      const thousands = Math.round(amount / 10000);
      if (thousands === 0) {
        return "0원";
      }
      return `${thousands.toLocaleString()}만원`;
    }
  }

  // 월별 집계를 위한 데이터 변환 (실제 지표 반영)
  const dashboardData = {
    revenue: {
      // 총매출 = (장부 또는 접수수납 매출) + 현금매출. 데이터 없어도 현금은 반영.
      current: current?.totalRevenue ?? currentData?.totalRevenue ?? cashOf(year, month),
      previous: previous?.totalRevenue ?? cashOf(prevYear, prevMonth),
      target: monthlyGoal?.revenueGoal,
      monthlyData: sortedLast6.map(s => s.totalRevenue ?? 0) // 실제 월별 매출 데이터
    },
    patients: {
      total: currentPatientStats.totalPatients,
      new: currentPatientStats.newPatients,
      returning: currentPatientStats.totalPatients - currentPatientStats.newPatients,
      growth: pct(currentPatientStats.totalPatients, previousPatientStats.totalPatients) ?? 0,
      newGrowth: pct(currentPatientStats.newPatients, previousPatientStats.newPatients),
      returningGrowth: pct(
        currentPatientStats.totalPatients - currentPatientStats.newPatients,
        previousPatientStats.totalPatients - previousPatientStats.newPatients
      ),
      monthlyData: sortedLast6.map(s => s.totalPatients ?? 0) // 실제 월별 환자수 데이터
    },
    performance: {
      satisfaction: 4.5, // 추후 실제 만족도 데이터 연결
      efficiency: goalAnalysis.monthlyRevenueRate || 0,
      growth: pct(currentData?.totalRevenue, previous?.totalRevenue) ?? 0
    },
    // 실제 데이터 반영을 위한 추가 데이터
    revenueHistory: sortedLast6.length > 0 ? sortedLast6.map(s => s.totalRevenue ?? 0) : [0, current?.totalRevenue ?? 0], // 매출 추이
    newPatientHistory: sortedLast6.length > 0 ? sortedLast6.map(s => s.newPatients ?? 0) : [0, currentPatientStats.newPatients], // 신환 추이
    returningPatientHistory: sortedLast6.length > 0 ? sortedLast6.map(s => (s.totalPatients ?? 0) - (s.newPatients ?? 0)) : [0, currentPatientStats.totalPatients - currentPatientStats.newPatients], // 구환 추이
    lastUpdateDate: current ?
      `${year}년 ${month}월 월간장부 데이터` :
      new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
  }

  return (
    <ProfessionalDashboard
      data={dashboardData}
      clinicName={clinic?.name ?? "치과"}
      period={{ year, month }}
      monthSelector={
        <Suspense>
          <MonthSelector
            availableMonths={availableMonths}
            currentYear={year}
            currentMonth={month}
          />
        </Suspense>
      }
    >
      {/* 데이터 없음 안내 */}
      {!current && (
        <div className="bg-[#fff9ec] border border-[#ffe3a3] rounded-2xl px-5 py-4">
          <h3 className="text-[14px] font-semibold text-[#b25e00] mb-0.5">데이터 없음</h3>
          <p className="text-[13px] text-[#a06a1b]">
            {year}년 {month}월 월간장부 데이터가 없습니다. 월간장부 엑셀을 업로드하거나 다른 월을 선택하세요.
          </p>
        </div>
      )}

      {/* 매출 트렌드 차트 */}
      <div className="bg-white rounded-2xl border border-[#e5e8eb] p-6">
        <h2 className="text-[15px] font-bold text-[#191f28] mb-4">
          매출 트렌드
        </h2>
        {sortedLast6.length > 0 ? (
          <RevenueChart data={sortedLast6.map((s) => ({
            label: `${s.year}.${String(s.month).padStart(2, "0")}`,
            revenue: s.totalRevenue ?? 0,
            net: s.netProfit ?? 0,
          }))} />
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-slate-600">데이터가 없습니다. 엑셀 업로드 후 차트가 표시됩니다.</p>
          </div>
        )}
      </div>

      {/* 리뷰 대시보드 */}
      <Suspense fallback={
        <div className="bg-white rounded-2xl border border-[#e5e8eb] p-6">
          <div className="animate-pulse">
            <div className="h-5 bg-[#f2f4f6] rounded w-1/3 mb-4"></div>
            <div className="h-32 bg-[#f2f4f6] rounded"></div>
          </div>
        </div>
      }>
        <div className="bg-white rounded-2xl border border-[#e5e8eb] p-6">
          <h2 className="text-[15px] font-bold text-[#191f28] mb-4">
            리뷰 분석
          </h2>
          <ReviewDashboard
            clinicId={clinicId}
            year={year}
            month={month}
          />
        </div>
      </Suspense>

      {/* 실행계획 대시보드 */}
      <div className="bg-white rounded-2xl border border-[#e5e8eb] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-[#191f28]">
            실행계획 현황
          </h2>
          <a
            href={`/dashboard/${clinicId}/action-plans`}
            className="text-[13px] text-[#3182f6] hover:underline font-medium"
          >
            전체 보기 →
          </a>
        </div>

        {actionPlans.length > 0 ? (
          <div className="space-y-4">
            {/* 진행 중인 계획들 먼저 표시 */}
            {actionPlans
              .filter(plan => plan.status === "진행중")
              .slice(0, 2)
              .map((plan) => (
                <div key={plan.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                      plan.priority === "상" ? "bg-red-500 text-white" :
                      plan.priority === "중" ? "bg-yellow-500 text-white" :
                      "bg-green-500 text-white"
                    }`}>
                      {plan.priority === "상" ? "🔥" : plan.priority === "중" ? "⚡" : "📋"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-slate-900">{plan.goal}</h4>
                        <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-700 border border-blue-200">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          진행중
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">{plan.description}</p>

                      <div className="flex items-center justify-between text-sm text-slate-500 mb-3">
                        <span>목표일: {plan.targetDate.toLocaleDateString('ko-KR')}</span>
                        <span>진행률: {plan.progress}%</span>
                      </div>

                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${plan.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

            {/* 최근 완료된 계획 1개 */}
            {actionPlans
              .filter(plan => plan.status === "완료")
              .slice(0, 1)
              .map((plan) => (
                <div key={plan.id} className="bg-white rounded-xl border border-slate-200 p-4 opacity-75">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                      plan.priority === "상" ? "bg-red-500 text-white" :
                      plan.priority === "중" ? "bg-yellow-500 text-white" :
                      "bg-green-500 text-white"
                    }`}>
                      {plan.priority === "상" ? "🔥" : plan.priority === "중" ? "⚡" : "📋"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-slate-900">{plan.goal}</h4>
                        <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-green-100 text-green-700 border border-green-200">
                          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                          완료
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{plan.description}</p>
                      <div className="text-xs text-slate-500">
                        완료일: {plan.targetDate.toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

            {/* 통계 요약 */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-200">
              <div className="text-center">
                <div className="text-lg font-bold text-slate-900">
                  {actionPlans.filter(p => p.status === "완료").length}
                </div>
                <div className="text-xs text-slate-600">완료</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  {actionPlans.filter(p => p.status === "진행중").length}
                </div>
                <div className="text-xs text-slate-600">진행중</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-500">
                  {actionPlans.filter(p => p.status === "시작전").length}
                </div>
                <div className="text-xs text-slate-600">시작전</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🎯</div>
            <p className="text-slate-600 mb-2">설정된 실행계획이 없습니다.</p>
            <p className="text-slate-500 text-sm mb-4">목표를 설정하고 실행 현황을 관리해보세요.</p>
            <a
              href={`/dashboard/${clinicId}/action-plans`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm"
            >
              실행계획 만들기
            </a>
          </div>
        )}
      </div>
    </ProfessionalDashboard>
  )
}