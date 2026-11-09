import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

// 접수수납목록·장부·상담통계에서 뽑는 경영 지표. 결과는 집계값만 돌려주고 환자 개인정보는 내보내지 않는다.

const KST_DATE = Prisma.sql`date("receptionTime" + interval '9 hours')`
const IS_NEW = Prisma.sql`(lower(trim("patientType")) like '%신환%' or lower(trim("patientType")) in ('new','신'))`

const pct = (a: number | null | undefined, b: number | null | undefined) =>
  a != null && b != null && b > 0 ? (a / b) * 100 : null

const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0))
const iso = (d: Date) => d.toISOString().slice(0, 10)
const shiftMonths = (year: number, month: number, delta: number) => {
  const t = year * 12 + (month - 1) + delta
  return { year: Math.floor(t / 12), month: (t % 12) + 1 }
}

// ---------- 수납·미수 ----------
export async function getCollectionStats(clinicId: string, year: number, month: number) {
  const rows = await prisma.$queryRaw<
    Array<{ y: number; m: number; billed: number; ins: number; due: number; paid: number; arrears: number; arrearsRows: number; total: number }>
  >`
    select year::int y, month::int m,
      coalesce(sum("totalRevenue"),0)::float8 billed,
      coalesce(sum("insuranceCoverage"),0)::float8 ins,
      coalesce(sum(coalesce("patientPayment",0)+coalesce("nonInsurance",0)),0)::float8 due,
      coalesce(sum(coalesce("cardPayment",0)+coalesce("cashPayment",0)+coalesce("onlinePayment",0)),0)::float8 paid,
      coalesce(sum("dailyArrears"),0)::float8 arrears,
      count(*) filter (where coalesce("dailyArrears",0)<>0)::int "arrearsRows",
      count(*)::int total
    from "ReceptionRecord"
    where "clinicId"=${clinicId} and year in (${year},${year - 1})
    group by 1,2`

  // 신환 기여도: 그 달에 신환으로 접수된 적이 있는 환자의 그 달 진료비 (월 기준 환자 단위)
  const share = await prisma.$queryRaw<Array<{ m: number; newBilled: number; nonIns: number; total: number }>>`
    with n as (
      select distinct month m, "chartNumber" c from "ReceptionRecord"
      where "clinicId"=${clinicId} and year=${year} and ${IS_NEW}
    )
    select r.month::int m,
      coalesce(sum(r."totalRevenue") filter (where n.c is not null),0)::float8 "newBilled",
      coalesce(sum(r."nonInsurance"),0)::float8 "nonIns",
      coalesce(sum(r."totalRevenue"),0)::float8 total
    from "ReceptionRecord" r
    left join n on n.m=r.month and n.c=r."chartNumber"
    where r."clinicId"=${clinicId} and r.year=${year}
    group by 1`

  const find = (y: number, m: number) => rows.find((r) => r.y === y && r.m === m)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const monthly = months.map((m) => {
    const cur = m <= month ? find(year, m) : undefined
    const prev = find(year - 1, m)
    const s = m <= month ? share.find((x) => x.m === m) : undefined
    return {
      month: m,
      label: `${m}`,
      billed: cur?.billed ?? null,
      ins: cur?.ins ?? null,
      due: cur?.due ?? null,
      paid: cur?.paid ?? null,
      paidRate: pct(cur?.paid, cur?.due),
      prevPaidRate: pct(prev?.paid, prev?.due),
      arrears: cur && cur.arrearsRows > 0 ? cur.arrears : null,
      newShare: pct(s?.newBilled, s?.total),
      nonInsShare: pct(s?.nonIns, s?.total),
    }
  })
  const current = monthly.find((r) => r.month === month)
  const anyArrears = rows.some((r) => r.arrearsRows > 0)
  return { monthly, current, anyArrears, hasData: rows.some((r) => r.y === year && r.m <= month) }
}

// ---------- 환자 유지 ----------
export async function getRetentionStats(clinicId: string, year: number, month: number) {
  const range = await prisma.$queryRaw<Array<{ first: Date | null; last: Date | null }>>`
    select min(${KST_DATE}) "first", max(${KST_DATE}) "last"
    from "ReceptionRecord" where "clinicId"=${clinicId} and "receptionTime" is not null`
  const dataFirst = range[0]?.first ?? null
  const dataLast = range[0]?.last ?? null
  if (!dataFirst || !dataLast) return null

  const windowStart = shiftMonths(year, month, -11)
  const cohortFrom = `${windowStart.year}-${String(windowStart.month).padStart(2, "0")}-01`
  const cohortTo = iso(lastDay(year, month))

  // 날짜 비교 기준: 첫 내원일 뒤 N일까지 접수 자료가 있어야 관찰 완료로 친다. 같은 날 복수 접수는 한 방문.
  const cohorts = await prisma.$queryRaw<
    Array<{ ym: string; size: number; n30: number; k30: number; n90: number; k90: number; n180: number; k180: number; medianGap: number | null }>
  >`
    with v as (
      select distinct "chartNumber" c, ${KST_DATE} d from "ReceptionRecord"
      where "clinicId"=${clinicId} and "chartNumber" is not null and "receptionTime" is not null
    ), f as (
      select "chartNumber" c, min(${KST_DATE}) f0 from "ReceptionRecord"
      where "clinicId"=${clinicId} and "chartNumber" is not null and "receptionTime" is not null and ${IS_NEW}
      group by 1
    ), g as (
      select f.c, f.f0, min(v.d) filter (where v.d > f.f0) nx from f join v on v.c=f.c
      where f.f0 between ${cohortFrom}::date and ${cohortTo}::date
      group by 1,2
    )
    select to_char(f0,'YYYY-MM') ym, count(*)::int size,
      count(*) filter (where f0+30 <= ${dataLast}::date)::int n30,
      count(*) filter (where f0+30 <= ${dataLast}::date and nx <= f0+30)::int k30,
      count(*) filter (where f0+90 <= ${dataLast}::date)::int n90,
      count(*) filter (where f0+90 <= ${dataLast}::date and nx <= f0+90)::int k90,
      count(*) filter (where f0+180 <= ${dataLast}::date)::int n180,
      count(*) filter (where f0+180 <= ${dataLast}::date and nx <= f0+180)::int k180,
      (percentile_cont(0.5) within group (order by (nx-f0)) filter (where nx is not null))::float8 "medianGap"
    from g group by 1 order by 1`

  const rows = cohorts.map((c) => ({
    ...c,
    label: c.ym.replace("-", "."),
    r30: c.n30 === c.size ? pct(c.k30, c.n30) : null,
    r90: c.n90 === c.size ? pct(c.k90, c.n90) : null,
    r180: c.n180 === c.size ? pct(c.k180, c.n180) : null,
  }))
  const latest90 = [...rows].reverse().find((r) => r.r90 != null) ?? null
  const before90 = latest90 ? [...rows].reverse().filter((r) => r.r90 != null)[1] ?? null : null

  // 활성·휴면: 선택 월 말일 기준 직전 12개월 / 그 앞 12개월
  const asOf = lastDay(year, month)
  const a = shiftMonths(year, month, -12)
  const b = shiftMonths(year, month, -24)
  const y1 = iso(lastDay(a.year, a.month))
  const y2 = iso(lastDay(b.year, b.month))
  const hasActive = iso(dataFirst as Date) <= y1 + "" // 최근 12개월 전체를 덮는 자료
  const hasDormant = iso(dataFirst as Date) <= y2 + ""

  let active: number | null = null
  let dormant: number | null = null
  let prevBase: number | null = null
  if (hasActive) {
    const r = await prisma.$queryRaw<Array<{ active: number; base: number; dormant: number }>>`
      with v as (
        select distinct "chartNumber" c, ${KST_DATE} d from "ReceptionRecord"
        where "clinicId"=${clinicId} and "chartNumber" is not null and "receptionTime" is not null
      ), a as (select distinct c from v where d > ${y1}::date and d <= ${iso(asOf)}::date),
      b as (select distinct c from v where d > ${y2}::date and d <= ${y1}::date)
      select (select count(*) from a)::int active,
        (select count(*) from b)::int base,
        (select count(*) from b where c not in (select c from a))::int dormant`
    active = r[0]?.active ?? null
    if (hasDormant) {
      dormant = r[0]?.dormant ?? null
      prevBase = r[0]?.base ?? null
    }
  }

  return {
    dataFirst: iso(dataFirst as Date),
    dataLast: iso(dataLast as Date),
    rows,
    latest90,
    before90,
    active,
    dormant,
    prevBase,
    dormantRate: pct(dormant, prevBase),
    asOf: iso(asOf),
  }
}

// ---------- 지역별 신환 전년 대비 (같은 기간) ----------
export async function getRegionGrowth(clinicId: string, year: number, month: number) {
  return prisma.$queryRaw<Array<{ region: string; cur: number; prev: number; avgRevenue: number | null }>>`
    select region,
      coalesce(sum("newPatients") filter (where year=${year}),0)::float8 cur,
      coalesce(sum("newPatients") filter (where year=${year - 1}),0)::float8 prev,
      (sum("avgRevenue"*"totalPatients") filter (where year=${year})/nullif(sum("totalPatients") filter (where year=${year}),0))::float8 "avgRevenue"
    from "RegionDist"
    where "clinicId"=${clinicId} and year in (${year},${year - 1}) and month between 1 and ${month} and region not like '%평균%'
    group by 1 order by cur desc limit 12`
}

// ---------- 진료 운영 ----------
export async function getOperationStats(clinicId: string, year: number, month: number) {
  const WAIT = Prisma.sql`coalesce("waitingMinutes"::float8,"waitingTime")`
  const [doctors, daily, weekday, hours, wait, fill] = await Promise.all([
    prisma.$queryRaw<Array<{ doctor: string; visits: number; patients: number; billed: number }>>`
      select coalesce(nullif(trim("treatmentDoctor"),''),nullif(trim(doctor),'')) doctor,
        count(*)::int visits, count(distinct "chartNumber")::int patients, coalesce(sum("totalRevenue"),0)::float8 billed
      from "ReceptionRecord"
      where "clinicId"=${clinicId} and year=${year} and month=${month}
        and coalesce(nullif(trim("treatmentDoctor"),''),nullif(trim(doctor),'')) is not null
      group by 1 order by billed desc`,
    prisma.$queryRaw<Array<{ y: number; m: number; days: number; billed: number; visits: number }>>`
      select year::int y, month::int m, count(distinct ${KST_DATE})::int days, coalesce(sum("totalRevenue"),0)::float8 billed,
        count(distinct ("chartNumber", ${KST_DATE}))::int visits
      from "ReceptionRecord" where "clinicId"=${clinicId} and year in (${year},${year - 1}) and "receptionTime" is not null
      group by 1,2`,
    prisma.$queryRaw<Array<{ dow: number; days: number; visits: number; waitN: number; waitAvg: number | null; over30: number }>>`
      select extract(dow from ${KST_DATE})::int dow, count(distinct ${KST_DATE})::int days,
        count(distinct ("chartNumber", ${KST_DATE}))::int visits,
        count(${WAIT})::int "waitN", avg(${WAIT})::float8 "waitAvg", count(*) filter (where ${WAIT} > 30)::int over30
      from "ReceptionRecord" where "clinicId"=${clinicId} and year=${year} and month=${month} and "receptionTime" is not null
      group by 1 order by 1`,
    prisma.$queryRaw<Array<{ h: number; visits: number }>>`
      select extract(hour from "receptionTime" + interval '9 hours')::int h, count(*)::int visits
      from "ReceptionRecord" where "clinicId"=${clinicId} and year=${year} and month=${month} and "receptionTime" is not null
      group by 1 order by 1`,
    prisma.$queryRaw<Array<{ total: number; n: number; avg: number | null; over30: number }>>`
      select count(*)::int total, count(${WAIT})::int n, avg(${WAIT})::float8 avg, count(*) filter (where ${WAIT} > 30)::int over30
      from "ReceptionRecord" where "clinicId"=${clinicId} and year=${year} and month=${month}`,
    prisma.$queryRaw<Array<{ chair: number; times: number; total: number }>>`
      select count(*) filter (where nullif(trim(chair),'') is not null)::int chair,
        count(*) filter (where "treatmentStartTime" is not null and "treatmentEndTime" is not null)::int times,
        count(*)::int total
      from "ReceptionRecord" where "clinicId"=${clinicId} and year=${year} and month=${month}`,
  ])

  const dayOf = (y: number, m: number) => daily.find((d) => d.y === y && d.m === m)
  const trend = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const c = m <= month ? dayOf(year, m) : undefined
    const p = dayOf(year - 1, m)
    const perDay = (x?: { billed: number; days: number }) => (x && x.days ? x.billed / x.days : null)
    const visitsPerDay = (x?: { visits: number; days: number }) => (x && x.days ? x.visits / x.days : null)
    return { label: `${m}`, month: m, days: c?.days ?? null, revCur: perDay(c), revPrev: perDay(p), visitCur: visitsPerDay(c), visitPrev: visitsPerDay(p) }
  })
  const w = wait[0]
  return {
    doctors,
    trend,
    current: trend[month - 1],
    weekday,
    hours,
    wait: w ? { ...w, rate: pct(w.n, w.total), over30Rate: pct(w.over30, w.n) } : null,
    fill: fill[0],
  }
}

// ---------- 비용·수익성 (장부) ----------
export async function getLedgerStats(clinicId: string, year: number, month: number) {
  const rows = await prisma.$queryRaw<
    Array<{ m: number; days: number; cash: number; card: number; online: number; ins: number; expCash: number; expCard: number; expOnline: number; fee: number }>
  >`
    select month::int m, count(*)::int days,
      coalesce(sum("cashIncome"),0)::float8 cash, coalesce(sum("cardIncome"),0)::float8 card,
      coalesce(sum("onlineIncome"),0)::float8 online, coalesce(sum("insuranceClaim"),0)::float8 ins,
      coalesce(sum("cashExpense"),0)::float8 "expCash", coalesce(sum("cardExpense"),0)::float8 "expCard",
      coalesce(sum("onlineExpense"),0)::float8 "expOnline", coalesce(sum("cardFee"),0)::float8 fee
    from "DailyLedger" where "clinicId"=${clinicId} and year=${year} and month <= ${month} group by 1 order by 1`
  return rows.map((r) => {
    const income = r.cash + r.card + r.online + r.ins
    const paidIn = r.cash + r.card + r.online
    const direct = r.expCash + r.expCard + r.expOnline
    return { ...r, label: `${r.m}`, income, paidIn, direct, feeRate: pct(r.fee, r.card) }
  })
}

// ---------- 상담 ----------
export async function getConsultStats(clinicId: string, year: number, month: number) {
  const rows = await prisma.$queryRaw<Array<{ y: number; m: number; plan: number; done: number; pat: number; patDone: number; amount: number }>>`
    select year::int y, month::int m, coalesce(sum("planCount"),0)::float8 plan, coalesce(sum("confirmedCount"),0)::float8 done,
      coalesce(sum("patientCount"),0)::float8 pat, coalesce(sum("confirmedPatients"),0)::float8 "patDone", coalesce(sum("confirmedAmount"),0)::float8 amount
    from "ConsultationStat" where "clinicId"=${clinicId} and year in (${year},${year - 1}) and month is not null
    group by 1,2`
  const of = (y: number, m: number) => rows.find((r) => r.y === y && r.m === m)
  const cur = of(year, month)
  const recent = [1, 2, 3].map((d) => shiftMonths(year, month, -d)).map((p) => of(p.year, p.month)).filter(Boolean) as typeof rows
  const recentPlan = recent.reduce((a, r) => a + r.plan, 0)
  const recentDone = recent.reduce((a, r) => a + r.done, 0)
  const trend = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const c = m <= month ? of(year, m) : undefined
    const p = of(year - 1, m)
    return { label: `${m}`, cur: pct(c?.done, c?.plan), prev: pct(p?.done, p?.plan) }
  })
  const planRows = await prisma.treatmentPlan.count({ where: { clinicId } })
  return {
    cur: cur ?? null,
    rate: pct(cur?.done, cur?.plan),
    patientRate: pct(cur?.patDone, cur?.pat),
    open: cur ? Math.max(cur.plan - cur.done, 0) : null,
    avgAmount: cur && cur.done > 0 ? cur.amount / cur.done : null,
    recentRate: recent.length === 3 ? pct(recentDone, recentPlan) : null,
    trend,
    planRows,
  }
}

// ---------- 데이터 점검 ----------
export async function getDataCheck(clinicId: string, year: number, month: number) {
  const months = Array.from({ length: 14 }, (_, i) => shiftMonths(year, month, i - 13))
  const from = months[0]
  const key = from.year * 100 + from.month
  const tables = [
    { name: "월간장부", q: Prisma.sql`"DailyLedger"` },
    { name: "월간요약", q: Prisma.sql`"MonthlySummary"` },
    { name: "일별접수", q: Prisma.sql`"PatientStat"` },
    { name: "접수수납", q: Prisma.sql`"ReceptionRecord"` },
    { name: "진료항목", q: Prisma.sql`"TreatmentStat"` },
    { name: "내원경로", q: Prisma.sql`"VisitRoute"` },
    { name: "임플란트", q: Prisma.sql`"ImplantStat"` },
    { name: "상담통계", q: Prisma.sql`"ConsultationStat"` },
    { name: "연령분포", q: Prisma.sql`"AgeDist"` },
    { name: "지역분포", q: Prisma.sql`"RegionDist"` },
    { name: "치료계획", q: Prisma.sql`"TreatmentPlan"` },
  ]
  const coverage = await Promise.all(
    tables.map(async (t) => {
      const rows = await prisma.$queryRaw<Array<{ y: number; m: number; c: number }>>(
        Prisma.sql`select year::int y, month::int m, count(*)::int c from ${t.q} where "clinicId"=${clinicId} and year*100+month >= ${key} group by 1,2`
      )
      return { name: t.name, counts: months.map((p) => rows.find((r) => r.y === p.year && r.m === p.month)?.c ?? 0) }
    })
  )
  const fill = await prisma.$queryRaw<Array<Record<string, number>>>`
    select count(*)::int total,
      count(*) filter (where nullif(trim("chartNumber"),'') is not null)::int "차트번호",
      count(*) filter (where nullif(trim(doctor),'') is not null or nullif(trim("treatmentDoctor"),'') is not null)::int "진료의",
      count(*) filter (where nullif(trim("visitRoute"),'') is not null)::int "내원경로",
      count(*) filter (where "waitingMinutes" is not null or "waitingTime" is not null)::int "대기시간",
      count(*) filter (where coalesce("dailyArrears",0)<>0)::int "일미수",
      count(*) filter (where nullif(trim(chair),'') is not null)::int "체어",
      count(*) filter (where "treatmentStartTime" is not null)::int "진료시각",
      count(*) filter (where "reservationTime" is not null)::int "예약시각",
      count(*) filter (where nullif(trim("recallType"),'') is not null)::int "리콜구분"
    from "ReceptionRecord" where "clinicId"=${clinicId} and year=${year} and month=${month}`
  const gap = await prisma.$queryRaw<Array<{ y: number; m: number; billed: number | null; ledger: number | null }>>`
    with r as (select year y, month m, sum("totalRevenue") v from "ReceptionRecord" where "clinicId"=${clinicId} and year*100+month >= ${key} group by 1,2),
    l as (select year y, month m, sum(coalesce("cashIncome",0)+coalesce("cardIncome",0)+coalesce("onlineIncome",0)+coalesce("insuranceClaim",0)) v from "DailyLedger" where "clinicId"=${clinicId} and year*100+month >= ${key} group by 1,2)
    select coalesce(r.y,l.y)::int y, coalesce(r.m,l.m)::int m, r.v::float8 billed, l.v::float8 ledger from r full join l on r.y=l.y and r.m=l.m order by 1,2`
  return { months, coverage, fill: fill[0], gap: gap.filter((g) => g.y * 100 + g.m <= year * 100 + month) }
}

// ---------- 홈 점검 항목: 수치 사실만 표시한다 (기준값은 초기 설정값) ----------
/** change: 부호 있는 변화량 문구(색 표시). upIsBad: 늘어나는 것이 나쁜 지표(대기시간) */
export type HomeCheck = { text: string; detail: string; change?: { value: number; unit: string }; upIsBad?: boolean; href: string }

export async function getHomeChecks(clinicId: string, year: number, month: number) {
  const prevKey = { year: year - 1, month }
  const [newRows, revenueRows, consult, retention, ops, opsRecent, sources] = await Promise.all([
    prisma.ageDist.groupBy({
      by: ["year"],
      where: { clinicId, OR: [{ year, month }, prevKey], NOT: { ageGroup: { contains: "평균" } } },
      _sum: { newPatients: true },
    }),
    prisma.monthlySummary.findMany({
      where: { clinicId, OR: [{ year, month }, prevKey] },
      select: { year: true, totalRevenue: true },
    }),
    getConsultStats(clinicId, year, month),
    getRetentionStats(clinicId, year, month),
    prisma.$queryRaw<Array<{ avg: number | null }>>`
      select avg(coalesce("waitingMinutes"::float8,"waitingTime"))::float8 avg
      from "ReceptionRecord" where "clinicId"=${clinicId} and year=${year} and month=${month}`,
    prisma.$queryRaw<Array<{ avg: number | null }>>`
      select avg(coalesce("waitingMinutes"::float8,"waitingTime"))::float8 avg
      from "ReceptionRecord" where "clinicId"=${clinicId} and year*12+month between ${year * 12 + month - 3} and ${year * 12 + month - 1}`,
    getDataCheck(clinicId, year, month),
  ])

  const checks: HomeCheck[] = []
  const base = `/dashboard/${clinicId}`
  const q = `?year=${year}&month=${month}`

  const missing = sources.coverage
    .filter((c) => !["치료계획", "임플란트"].includes(c.name) && c.counts[c.counts.length - 1] === 0)
    .map((c) => c.name)
  if (missing.length) checks.push({ text: "자료 누락", detail: `${year}년 ${month}월 ${missing.join("·")} 없음`, href: `${base}/data-check${q}` })

  const revCur = revenueRows.find((r) => r.year === year)?.totalRevenue
  const revPrev = revenueRows.find((r) => r.year === year - 1)?.totalRevenue
  if (revCur != null && revPrev) {
    const d = ((revCur - revPrev) / revPrev) * 100
    if (d <= -10) checks.push({ text: "매출 감소", detail: "전년 동월 대비", change: { value: d, unit: "%" }, href: `${base}/revenue${q}` })
  }
  const newCur = newRows.find((r) => r.year === year)?._sum.newPatients
  const newPrev = newRows.find((r) => r.year === year - 1)?._sum.newPatients
  if (newCur != null && newPrev) {
    const d = ((newCur - newPrev) / newPrev) * 100
    if (d <= -10) checks.push({ text: "신환 감소", detail: "전년 동월 대비", change: { value: d, unit: "%" }, href: `${base}/patients${q}` })
  }
  if (consult.rate != null && consult.recentRate != null && consult.rate - consult.recentRate <= -5) {
    checks.push({ text: "상담 확정률 하락", detail: `최근 3개월 ${consult.recentRate.toFixed(1)}% → ${consult.rate.toFixed(1)}%`, change: { value: consult.rate - consult.recentRate, unit: "%p" }, href: `${base}/consultations${q}` })
  }
  const r = retention
  if (r?.latest90?.r90 != null && r.before90?.r90 != null && r.latest90.r90 - r.before90.r90 <= -5) {
    checks.push({ text: "재내원율 하락", detail: `${r.before90.label} ${r.before90.r90.toFixed(1)}% → ${r.latest90.label} ${r.latest90.r90.toFixed(1)}%`, change: { value: r.latest90.r90 - r.before90.r90, unit: "%p" }, href: `${base}/retention${q}` })
  }
  const waitNow = ops[0]?.avg
  const waitBefore = opsRecent[0]?.avg
  if (waitNow != null && waitBefore && (waitNow - waitBefore) / waitBefore >= 0.2) {
    checks.push({ text: "대기시간 증가", detail: `최근 3개월 ${waitBefore.toFixed(1)}분 → ${waitNow.toFixed(1)}분`, change: { value: ((waitNow - waitBefore) / waitBefore) * 100, unit: "%" }, upIsBad: true, href: `${base}/operations${q}` })
  }

  return {
    checks: checks.slice(0, 3),
    extra: Math.max(checks.length - 3, 0),
    retention90: r?.latest90 ? { value: r.latest90.r90, label: r.latest90.label, n: r.latest90.n90 } : null,
    consultRate: consult.rate,
    consultRecent: consult.recentRate,
  }
}
