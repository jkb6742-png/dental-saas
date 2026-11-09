export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import ProfessionalDashboard from "@/components/dashboard/ProfessionalDashboard"
import YearCompareChart from "@/components/charts/YearCompareChart"
import HomeCard from "@/components/dashboard/HomeCard"
import { getHomeStats } from "@/lib/dashboard/home-stats"
import { getHomeChecks } from "@/lib/dashboard/insights"
import Link from "next/link"
import MonthSelector from "@/components/ui/MonthSelector"
import { Suspense } from "react"

function won(v: number) {
  if (v >= 100_000_000) {
    const eok = Math.floor(v / 100_000_000)
    const man = Math.round((v % 100_000_000) / 10_000)
    return man ? `${eok}억 ${man.toLocaleString("ko-KR")}만` : `${eok}억`
  }
  return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만`
}

const deltaText = (v: number | null | undefined, digits = 0) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${digits ? v.toFixed(digits) : Math.round(v)}%`
const deltaTone = (v: number | null | undefined) =>
  v == null ? "text-[#9b9b95]" : v > 0 ? "text-[#0f9f55]" : v < 0 ? "text-[#e0383b]" : "text-[#555555]"

/** 그래프 아래에 숫자표를 둔다 */
function ChartRow({ chart, table }: { chart: React.ReactNode; table: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="min-w-0">{chart}</div>
      <div className="min-w-0">{table}</div>
    </div>
  )
}

function YearTable({ head, rows }: { head: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <table className="w-full mt-1 text-[13px] tabular-nums">
      <thead>
        <tr className="text-[12px] text-[#6f6f6a] border-b border-[#e0e0db]">
          {head.map((h, i) => (
            <th key={h} className={`py-1 font-normal ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="border-b border-[#ecece9] last:border-b-0">
            {r.map((c, i) => (
              <td key={i} className={`py-1 ${i === 0 ? "text-left text-[#0a0a0a]" : i === 1 ? "text-right font-semibold text-[#0a0a0a]" : "text-right text-[#555555]"}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EmptyChart() {
  return <div className="h-[230px] flex items-center justify-center text-[12px] text-[#6f6f6a]">자료 없음</div>
}

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

  // KPI 전월 대비용: 선택 월과 전월
  const recentWhere = { clinicId, OR: [{ year, month }, { year: prevYear, month: prevMonth }] }

  // 화면에 필요한 컬럼만, 한 번에 조회한다.
  const [goals, yearlyGoals, cashRows, ledgerRows, receptionRows, clinic, stats, home, sourcePatients] = await Promise.all([
    prisma.revenueGoal.findMany({ where: { clinicId, year, month } }),
    prisma.revenueGoal.findMany({ where: { clinicId, year, month: null } }),
    prisma.cashRevenue.findMany({
      where: { clinicId },
      select: { year: true, month: true, amount: true },
    }).catch(() => [] as Array<{ year: number; month: number; amount: number }>),
    prisma.dailyLedger.findMany({
      where: recentWhere,
      select: { year: true, month: true, cashIncome: true, cardIncome: true, onlineIncome: true, insuranceClaim: true, cashExpense: true, cardExpense: true },
    }),
    prisma.receptionRecord.findMany({
      where: recentWhere,
      select: { year: true, month: true, chartNumber: true, patientType: true, totalRevenue: true },
    }),
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } }),
    getHomeStats(clinicId, year, month),
    getHomeChecks(clinicId, year, month),
    // 환자 수 기준: 원본 엑셀(연령별 분포) 합계
    prisma.ageDist.groupBy({
      by: ["year", "month"],
      where: { clinicId, OR: [{ year, month }, { year: prevYear, month: prevMonth }], NOT: { ageGroup: { contains: "평균" } } },
      _sum: { totalPatients: true, newPatients: true, returningPatients: true },
    }),
  ])

  const groupByMonth = <T extends { year: number; month: number }>(rows: T[]) => {
    const map = new Map<string, T[]>()
    for (const row of rows) {
      const key = `${row.year}-${row.month}`
      const list = map.get(key)
      if (list) list.push(row)
      else map.set(key, [row])
    }
    return (y: number, m: number) => map.get(`${y}-${m}`) ?? []
  }
  const ledgerOf = groupByMonth(ledgerRows)
  const receptionOf = groupByMonth(receptionRows)

  const monthlyGoal = goals[0]
  const yearlyGoal = yearlyGoals[0]


  // 마스터가 입력한 월별 현금매출 → 총매출에 가산
  const cashMap = new Map(cashRows.map((c) => [`${c.year}-${c.month}`, c.amount || 0]))
  const cashOf = (y: number, m: number) => cashMap.get(`${y}-${m}`) ?? 0

  // 실제 월간장부 데이터(DailyLedger)에서 집계
  const currentLedger = ledgerOf(year, month)
  const previousLedger = ledgerOf(prevYear, prevMonth)

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
  const currentPatients = receptionOf(year, month)
  const previousPatients = receptionOf(prevYear, prevMonth)

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

  // 원본 엑셀 값을 쓰고, 그 달 파일이 없을 때만 접수 기록으로 계산한다
  const patientStatsOf = (y: number, m: number, records: any[]) => {
    const source = sourcePatients.find((r) => r.year === y && r.month === m)?._sum
    if (source && source.totalPatients != null) {
      return {
        totalPatients: Math.round(source.totalPatients),
        newPatients: Math.round(source.newPatients ?? 0),
        newPatientRevenue: 0,
      }
    }
    return calculatePatientStats(records)
  }
  const currentPatientStats = patientStatsOf(year, month, currentPatients)
  const previousPatientStats = patientStatsOf(prevYear, prevMonth, previousPatients)

  // MonthlySummary가 없는 경우 ReceptionRecord에서 직접 계산
  let currentData = current
  if (!current) {
    const receptionRecords = currentPatients

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
      monthlyData: [],
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
      monthlyData: [],
    },
    performance: {
      satisfaction: 4.5, // 추후 실제 만족도 데이터 연결
      efficiency: goalAnalysis.monthlyRevenueRate || 0,
      growth: pct(currentData?.totalRevenue, previous?.totalRevenue) ?? 0
    },
    lastUpdateDate: current ?
      `${year}년 ${month}월 월간장부 데이터` :
      new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
  }

  const detail = `/dashboard/${clinicId}`
  const query = `?year=${year}&month=${month}`
  const compareSeries = [
    { key: "cur", name: `${year}년`, color: "#0062ff" },
    { key: "prev", name: `${year - 1}년`, color: "#a3a39d" },
  ]
  const categoryNote = `총환자 · 1~${month}월 합계${stats.coverageNote ? ` · ${stats.coverageNote}` : ""}`

  return (
    <ProfessionalDashboard
      data={dashboardData}
      yoy={stats.kpiYoy}
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

      {/* 이번 달 점검 항목 + 전환 지표 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <HomeCard
          className="xl:col-span-2"
          title="이번 달 점검 항목"
          note={home.extra ? `외 ${home.extra}건` : "전년·최근 추세와 비교"}
        >
          {home.checks.length ? (
            <ul className="divide-y divide-[#ecece9]">
              {home.checks.map((c) => (
                <li key={c.text}>
                  <Link prefetch={false} href={c.href} className="flex items-baseline justify-between gap-3 py-1.5 hover:text-[#0062ff]">
                    <span className="text-[14px] font-semibold text-[#0a0a0a]">{c.text}</span>
                    <span className="text-[13px] text-[#555555] tabular-nums truncate">
                      {c.detail}
                      {c.change && (
                        <b className={`ml-1.5 font-semibold ${(c.upIsBad ? -c.change.value : c.change.value) > 0 ? "text-[#0f9f55]" : "text-[#e0383b]"}`}>
                          {c.change.value > 0 ? "+" : ""}
                          {c.change.value.toFixed(1)}
                          {c.change.unit}
                        </b>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-1.5 text-[14px] text-[#555555]">기준을 벗어난 항목이 없습니다.</p>
          )}
        </HomeCard>
        <HomeCard title="전환 지표">
          <div className="grid grid-cols-2 gap-3">
            <Link prefetch={false} href={`${detail}/retention${query}`} className="block hover:text-[#0062ff]">
              <div className="text-[13px] text-[#555555]">신환 90일 재내원</div>
              <div className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[#0a0a0a]">
                {home.retention90?.value != null ? `${home.retention90.value.toFixed(1)}%` : "—"}
              </div>
              <div className="mt-1 text-[12px] text-[#6f6f6a]">
                {home.retention90 ? `${home.retention90.label} 신환 ${home.retention90.n}명` : "관찰 완료 자료 없음"}
              </div>
            </Link>
            <Link prefetch={false} href={`${detail}/consultations${query}`} className="block hover:text-[#0062ff]">
              <div className="text-[13px] text-[#555555]">상담 확정률</div>
              <div className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[#0a0a0a]">
                {home.consultRate != null ? `${home.consultRate.toFixed(1)}%` : "—"}
              </div>
              <div className="mt-1 text-[12px] text-[#6f6f6a]">
                {home.consultRecent != null ? `최근 3개월 ${home.consultRecent.toFixed(1)}%` : "계획 건 기준"}
              </div>
            </Link>
          </div>
        </HomeCard>
      </div>

      {/* 섹터마다 한 줄. 숫자표는 그래프 아래 */}
      <HomeCard title="전년 대비 월 매출" note={`${year}년 vs ${year - 1}년`} href={`${detail}/revenue${query}`}>
        <YearCompareChart data={stats.monthlyRevenue} series={compareSeries} unit="원" height={340} showValues legendTop />
        {/* 전년 대비 증감: 그래프의 월 눈금 바로 아래에 맞춘다 (왼쪽 축 56 + 축 안쪽 22, 오른쪽 여백 16 + 22) */}
        <div className="relative mt-1 flex justify-between border-t border-[#e0e0db] pt-1.5 pb-1 pl-[78px] pr-[38px]">
          <span className="absolute left-0 top-1.5 text-[12px] text-[#6f6f6a]">전년 대비</span>
          {stats.monthlyRevenue.map((m) => (
            <span key={m.label} data-yoy-cell className="w-0 flex justify-center">
              <span className={`whitespace-nowrap text-[13px] font-semibold tabular-nums ${deltaTone(m.yoy)}`}>{deltaText(m.yoy)}</span>
            </span>
          ))}
        </div>
      </HomeCard>

      <HomeCard title="전년 대비 분기 매출" note="진행 중인 분기는 같은 달끼리 비교" href={`${detail}/revenue${query}`}>
        <ChartRow
          chart={<YearCompareChart data={stats.quarterlyRevenue} series={compareSeries} unit="원" height={270} showValues />}
          table={
            <YearTable
              head={["분기", `${year}년`, `${year - 1}년`, "증감"]}
              rows={stats.quarterlyRevenue.map((q) => [
                <>
                  {q.label}
                  {q.partial && <span className="ml-1 text-[12px] text-[#6f6f6a]">{q.months}</span>}
                </>,
                q.cur != null ? won(q.cur) : "—",
                q.prev != null ? won(q.prev) : "—",
                <span key="d" className={`font-semibold ${deltaTone(q.yoy)}`}>{deltaText(q.yoy, 1)}</span>,
              ])}
            />
          }
        />
      </HomeCard>

      <HomeCard title="연도별 매출" note={`1~${month}월 · 연간 합계`} href={`${detail}/revenue${query}`}>
        <ChartRow
          chart={
            <YearCompareChart
              data={stats.yearlyRevenue}
              series={[
                { key: "ytd", name: `1~${month}월`, color: "#0062ff" },
                { key: "total", name: "연간 합계", color: "#a3a39d" },
              ]}
              unit="원"
              height={270}
              showValues
            />
          }
          table={
            <YearTable
              head={["연도", `1~${month}월`, "연간 합계", "전년 동기 대비"]}
              rows={stats.yearlyRevenue.map((r, i, all) => {
                const before = all[i - 1]
                const d = before && before.months === r.months && before.ytd ? (((r.ytd ?? 0) - before.ytd) / before.ytd) * 100 : null
                return [
                  r.label,
                  r.ytd != null ? won(r.ytd) : "—",
                  r.total != null ? won(r.total) : "진행 중",
                  <span key="d" className={`font-semibold ${deltaTone(d)}`}>{deltaText(d, 1)}</span>,
                ]
              })}
            />
          }
        />
      </HomeCard>

      <HomeCard title="전년 대비 월별 환자" note={`총환자 ${year}년 vs ${year - 1}년`} href={`${detail}/patients${query}`}>
        <YearCompareChart
          data={stats.monthlyPatients.map((m) => ({ ...m, label: m.label.replace("월", "") }))}
          series={compareSeries}
          unit="명"
          height={310}
          showValues
        />
      </HomeCard>

      <HomeCard title="연도별 환자" note={`1~${month}월 합계`} href={`${detail}/patients${query}`}>
        <ChartRow
          chart={
            <YearCompareChart
              data={stats.yearlyPatients}
              series={[
                { key: "total", name: "총환자", color: "#0062ff" },
                { key: "new", name: "신환", color: "#a3a39d" },
              ]}
              unit="명"
              height={270}
              showValues
            />
          }
          table={
            <YearTable
              head={["연도", "총환자", "신환", "구환", "전년 대비"]}
              rows={stats.yearlyPatients.map((r, i, all) => {
                const before = all[i - 1]
                const d = before && before.months === r.months && before.total ? ((r.total - before.total) / before.total) * 100 : null
                return [
                  r.label,
                  r.total.toLocaleString("ko-KR"),
                  r.new.toLocaleString("ko-KR"),
                  r.returning.toLocaleString("ko-KR"),
                  <span key="d" className={`font-semibold ${deltaTone(d)}`}>{deltaText(d, 1)}</span>,
                ]
              })}
            />
          }
        />
      </HomeCard>

      <HomeCard title="연령별" note={categoryNote} href={`${detail}/age${query}`}>
        {stats.age.data.length ? (
          <YearCompareChart data={stats.age.data} series={stats.age.series} labelSeries={`y${year}`} unit="명" height={310} showValues />
        ) : <EmptyChart />}
      </HomeCard>

      <HomeCard title="지역별 상위 6곳" note={categoryNote} href={`${detail}/regions${query}`}>
        {stats.region.data.length ? (
          <YearCompareChart data={stats.region.data} series={stats.region.series} labelSeries={`y${year}`} unit="명" height={330} horizontal showValues />
        ) : <EmptyChart />}
      </HomeCard>

      <HomeCard title="내원경로 상위 6개" note={categoryNote} href={`${detail}/routes${query}`}>
        {stats.route.data.length ? (
          <YearCompareChart data={stats.route.data} series={stats.route.series} labelSeries={`y${year}`} unit="명" height={330} horizontal showValues />
        ) : <EmptyChart />}
      </HomeCard>
    </ProfessionalDashboard>
  )
}