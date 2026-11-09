import { prisma } from "@/lib/db"
import type { CompareRow } from "@/components/charts/MonthlyCompare"

// 분석 화면의 "총환자·신환·구환 월별 비교"에 넘길 행. 환자 개인정보는 없고 월·항목별 합계뿐이다.
type Raw = { year: number; month: number | null; name: string; total: number; new: number; returning: number }

const ageOrder = (name: string) => {
  const m = /^(\d+)/.exec(name)
  return m ? Number(m[1]) : 999
}

function shape(raw: Raw[], year: number, opts: { sort: "age" | "value"; limit?: number; allOnly?: boolean }): {
  rows: CompareRow[]
  items: string[]
} {
  const valid = raw.filter((r) => r.month != null && !r.name.includes("평균"))
  const totals = new Map<string, number>()
  for (const r of valid) {
    if (r.year === year) totals.set(r.name, (totals.get(r.name) ?? 0) + r.total)
  }
  let items = [...new Set(valid.map((r) => r.name))]
  if (opts.sort === "age") items.sort((a, b) => ageOrder(a) - ageOrder(b))
  else items.sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0))
  items = items.filter((n) => valid.some((r) => r.name === n && r.total > 0))
  if (opts.limit) items = items.slice(0, opts.limit)

  // "전체"는 항목 제한과 상관없이 모든 행을 더한다
  const all = new Map<string, CompareRow>()
  for (const r of valid) {
    const key = `${r.year}-${r.month}`
    const row = all.get(key) ?? { year: r.year, month: r.month!, name: "전체", total: 0, new: 0, returning: 0 }
    row.total += r.total
    row.new += r.new
    row.returning += r.returning
    all.set(key, row)
  }
  const keep = new Set(items)
  const detail = opts.allOnly
    ? []
    : valid
        .filter((r) => keep.has(r.name))
        .map((r) => ({ year: r.year, month: r.month!, name: r.name, total: r.total, new: r.new, returning: r.returning }))
  return { rows: [...all.values(), ...detail], items: opts.allOnly ? [] : items }
}

const years = (year: number) => ({ in: [year - 1, year] })

export async function getAgeCompare(clinicId: string, year: number) {
  const rows = await prisma.ageDist.findMany({
    where: { clinicId, year: years(year) },
    select: { year: true, month: true, ageGroup: true, totalPatients: true, newPatients: true, returningPatients: true },
  })
  return shape(
    rows.map((r) => ({ year: r.year, month: r.month, name: r.ageGroup, total: r.totalPatients ?? 0, new: r.newPatients ?? 0, returning: r.returningPatients ?? 0 })),
    year,
    { sort: "age" }
  )
}

export async function getRegionCompare(clinicId: string, year: number) {
  const rows = await prisma.regionDist.findMany({
    where: { clinicId, year: years(year) },
    select: { year: true, month: true, region: true, totalPatients: true, newPatients: true, returningPatients: true },
  })
  // 지역은 수백 곳이라 선택 연도 환자 수 상위만 고를 수 있게 한다
  return shape(
    rows.map((r) => ({ year: r.year, month: r.month, name: r.region, total: r.totalPatients ?? 0, new: r.newPatients ?? 0, returning: r.returningPatients ?? 0 })),
    year,
    { sort: "value", limit: 30 }
  )
}

export async function getRouteCompare(clinicId: string, year: number) {
  const rows = await prisma.visitRoute.findMany({
    where: { clinicId, year: years(year) },
    select: { year: true, month: true, routeName: true, newPatients: true, returningPatients: true },
  })
  return shape(
    rows.map((r) => ({ year: r.year, month: r.month, name: r.routeName, total: (r.newPatients ?? 0) + (r.returningPatients ?? 0), new: r.newPatients ?? 0, returning: r.returningPatients ?? 0 })),
    year,
    { sort: "value" }
  )
}

// 환자 통계 화면은 연·월을 화면 안에서 바꾸므로 전 연도의 "전체" 합계를 넘긴다
export async function getPatientCompare(clinicId: string) {
  const rows = await prisma.ageDist.groupBy({
    by: ["year", "month"],
    where: { clinicId, month: { gte: 1, lte: 12 }, NOT: { ageGroup: { contains: "평균" } } },
    _sum: { totalPatients: true, newPatients: true, returningPatients: true },
  })
  return rows.map((r) => ({
    year: r.year,
    month: r.month!,
    name: "전체",
    total: r._sum.totalPatients ?? 0,
    new: r._sum.newPatients ?? 0,
    returning: r._sum.returningPatients ?? 0,
  }))
}
