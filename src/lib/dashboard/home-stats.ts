import { prisma } from "@/lib/db"

// 홈 대시보드의 연도별·전년 대비 집계.
// 진행 중인 해와 비교가 왜곡되지 않도록 항목별 연도 비교는 모두 "1월~선택월" 같은 기간으로 맞춘다.

export type MonthCompareRow = { label: string; cur: number | null; prev: number | null; yoy: number | null }
export type QuarterRow = MonthCompareRow & { months: string; partial: boolean }
export type YearRevenueRow = { label: string; ytd: number | null; total: number | null; months: number }
export type YearPatientRow = { label: string; total: number; new: number; returning: number; months: number }
export type CategoryRow = { label: string; [yearKey: string]: number | string }
export type YearSeries = { key: string; name: string; color: string }

const YEAR_COLORS = ["#0062ff", "#a3a39d"]

export const yoyOf = (cur: number | null | undefined, prev: number | null | undefined) =>
  cur != null && prev != null && prev > 0 ? ((cur - prev) / prev) * 100 : null

const sum = (values: Array<number | null | undefined>) => values.reduce<number>((a, v) => a + (v ?? 0), 0)

// 연령대 정렬: "10~19세" 앞 숫자 기준
const ageOrder = (name: string) => {
  const m = /^(\d+)/.exec(name)
  return m ? Number(m[1]) : 999
}

// "서울 노원구 월계동" → "노원구 월계동", "청주시 흥덕구 오송읍" → "흥덕구 오송읍"
const shortRegion = (name: string) => {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 3 ? parts.slice(-2).join(" ") : name
}

function buildCategory(
  rows: Array<{ year: number; name: string; value: number }>,
  year: number,
  opts: { limit?: number; sort: "value" | "age"; label?: (name: string) => string }
) {
  const years = [...new Set(rows.filter((r) => r.year <= year && r.value > 0).map((r) => r.year))]
    .sort((a, b) => b - a)
    .slice(0, 2)
  const byName = new Map<string, Map<number, number>>()
  for (const r of rows) {
    if (!years.includes(r.year)) continue
    if (!byName.has(r.name)) byName.set(r.name, new Map())
    const m = byName.get(r.name)!
    m.set(r.year, (m.get(r.year) ?? 0) + r.value)
  }
  let names = [...byName.keys()].filter((n) => [...byName.get(n)!.values()].some((v) => v > 0))
  if (opts.sort === "age") names.sort((a, b) => ageOrder(a) - ageOrder(b))
  else names.sort((a, b) => (byName.get(b)!.get(year) ?? 0) - (byName.get(a)!.get(year) ?? 0))
  if (opts.limit) names = names.slice(0, opts.limit)

  const data: CategoryRow[] = names.map((n) => {
    const row: CategoryRow = { label: opts.label ? opts.label(n) : n }
    for (const y of years) row[`y${y}`] = Math.round(byName.get(n)!.get(y) ?? 0)
    return row
  })
  // 범례·막대는 오래된 해부터, 선택 연도가 파랑
  const series: YearSeries[] = years
    .map((y, i) => ({ key: `y${y}`, name: `${y}년`, color: YEAR_COLORS[i] }))
    .reverse()
  return { data, series }
}

export async function getHomeStats(clinicId: string, year: number, month: number) {
  const scope = { clinicId, year: { lte: year } }
  const sameSeason = { ...scope, month: { gte: 1, lte: month } }
  const noAverage = (field: string) => ({ NOT: { [field]: { contains: "평균" } } })

  const [summaries, cashRows, patientRows, ageRows, regionRows, routeRows] = await Promise.all([
    prisma.monthlySummary.findMany({ where: scope, select: { year: true, month: true, totalRevenue: true } }),
    prisma.cashRevenue
      .findMany({ where: { clinicId }, select: { year: true, month: true, amount: true } })
      .catch(() => [] as Array<{ year: number; month: number; amount: number }>),
    prisma.ageDist.groupBy({
      by: ["year", "month"],
      where: { ...scope, month: { gte: 1, lte: 12 }, ...noAverage("ageGroup") },
      _sum: { totalPatients: true, newPatients: true, returningPatients: true },
    }),
    prisma.ageDist.groupBy({
      by: ["year", "ageGroup"],
      where: { ...sameSeason, ...noAverage("ageGroup") },
      _sum: { totalPatients: true },
    }),
    prisma.regionDist.groupBy({
      by: ["year", "region"],
      where: { ...sameSeason, ...noAverage("region") },
      _sum: { totalPatients: true },
    }),
    prisma.visitRoute.groupBy({
      by: ["year", "routeName"],
      where: { ...sameSeason, ...noAverage("routeName") },
      _sum: { newPatients: true, returningPatients: true },
    }),
  ])

  // ---------- 매출 (월간 요약 + 현금매출: 매출 분석 화면과 같은 기준) ----------
  const cashOf = new Map(cashRows.map((c) => [`${c.year}-${c.month}`, c.amount || 0]))
  const revenue = new Map<string, number>()
  for (const s of summaries) {
    if (s.totalRevenue == null && !cashOf.get(`${s.year}-${s.month}`)) continue
    revenue.set(`${s.year}-${s.month}`, (s.totalRevenue ?? 0) + (cashOf.get(`${s.year}-${s.month}`) ?? 0))
  }
  // 선택 연도는 선택 월까지만 인정한다 (진행 중인 달 제외)
  const revOf = (y: number, m: number) => {
    if (y === year && m > month) return null
    return revenue.get(`${y}-${m}`) ?? null
  }

  const monthlyRevenue: MonthCompareRow[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const cur = revOf(year, m)
    const prev = revOf(year - 1, m)
    return { label: `${m}월`, cur, prev, yoy: yoyOf(cur, prev) }
  })

  const quarterlyRevenue: QuarterRow[] = [1, 2, 3, 4].map((q) => {
    const months = [q * 3 - 2, q * 3 - 1, q * 3]
    const curMonths = months.filter((m) => revOf(year, m) != null)
    const isOpen = curMonths.length > 0
    // 진행 중인 분기는 전년도 같은 달끼리만 비교한다
    const prevMonths = isOpen ? curMonths : months
    const prevValues = prevMonths.map((m) => revOf(year - 1, m))
    const cur = isOpen ? sum(curMonths.map((m) => revOf(year, m))) : null
    const prev = prevValues.some((v) => v != null) ? sum(prevValues) : null
    const partial = isOpen && curMonths.length < 3
    return {
      label: `${q}분기`,
      months: partial ? `${curMonths[0]}~${curMonths[curMonths.length - 1]}월` : `${months[0]}~${months[2]}월`,
      partial,
      cur,
      prev,
      yoy: yoyOf(cur, prev),
    }
  })

  const revenueYears = [...new Set([...revenue.keys()].map((k) => Number(k.split("-")[0])))]
    .filter((y) => y <= year)
    .sort((a, b) => a - b)
  const yearlyRevenue: YearRevenueRow[] = revenueYears.map((y) => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    const ytd = months.filter((m) => m <= month).map((m) => revOf(y, m))
    return {
      label: `${y}년`,
      ytd: ytd.some((v) => v != null) ? sum(ytd) : null,
      total: y === year ? null : sum(months.map((m) => revOf(y, m))),
      months: ytd.filter((v) => v != null).length,
    }
  })

  // ---------- 환자 (연령 분포 합계: 전 치과에 전년 자료가 있는 원본) ----------
  const patientsOf = (y: number, m: number) => patientRows.find((r) => r.year === y && r.month === m)?._sum
  const patientYears = [...new Set(patientRows.map((r) => r.year))].sort((a, b) => a - b)

  const yearlyPatients: YearPatientRow[] = patientYears.map((y) => {
    const rows = patientRows.filter((r) => r.year === y && (r.month ?? 0) <= month)
    return {
      label: `${y}년`,
      total: Math.round(sum(rows.map((r) => r._sum.totalPatients))),
      new: Math.round(sum(rows.map((r) => r._sum.newPatients))),
      returning: Math.round(sum(rows.map((r) => r._sum.returningPatients))),
      months: rows.length,
    }
  })

  const monthlyPatients: MonthCompareRow[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const cur = m <= month ? patientsOf(year, m)?.totalPatients ?? null : null
    const prev = patientsOf(year - 1, m)?.totalPatients ?? null
    return { label: `${m}월`, cur, prev, yoy: yoyOf(cur, prev) }
  })

  // 전년도 자료가 일부 달만 있는 경우 안내 문구에 쓴다
  const monthsIn = (y: number) => patientRows.filter((r) => r.year === y && (r.month ?? 0) <= month).length
  const curMonths = monthsIn(year)
  const coverageNote = patientYears
    .filter((y) => y < year && monthsIn(y) > 0 && monthsIn(y) < curMonths)
    .slice(-2)
    .map((y) => `${y}년은 ${monthsIn(y)}개월 자료`)
    .join(", ")

  // ---------- 연령·지역·내원경로 연도별 ----------
  const age = buildCategory(
    ageRows.map((r) => ({ year: r.year, name: r.ageGroup, value: r._sum.totalPatients ?? 0 })),
    year,
    { sort: "age", label: (n) => n.replace("세", "") }
  )
  const region = buildCategory(
    regionRows.map((r) => ({ year: r.year, name: r.region, value: r._sum.totalPatients ?? 0 })),
    year,
    { sort: "value", limit: 6, label: shortRegion }
  )
  const route = buildCategory(
    routeRows.map((r) => ({
      year: r.year,
      name: r.routeName,
      value: (r._sum.newPatients ?? 0) + (r._sum.returningPatients ?? 0),
    })),
    year,
    { sort: "value", limit: 6 }
  )

  return {
    monthlyRevenue,
    quarterlyRevenue,
    yearlyRevenue,
    yearlyPatients,
    monthlyPatients,
    // KPI 전년 동월 대비: 작년 같은 달 자료가 없으면 null
    kpiYoy: {
      revenue: yoyOf(revOf(year, month), revOf(year - 1, month)),
      total: yoyOf(patientsOf(year, month)?.totalPatients, patientsOf(year - 1, month)?.totalPatients),
      new: yoyOf(patientsOf(year, month)?.newPatients, patientsOf(year - 1, month)?.newPatients),
    },
    age,
    region,
    route,
    coverageNote,
  }
}
