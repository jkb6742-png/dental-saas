import { prisma } from "@/lib/db"
import { monthRange, shiftMonth, KST_MS } from "@/lib/work/common"
import { countableContent } from "@/lib/work/content"

// 최근 N개월 치과별 계약 이행률. monthQuota 와 같은 셈법을 한 번에(치과×월 쿼리 폭주 방지).
// 지난 달 목표는 새로 만들지 않고 이미 있는 MonthlyCommitment 만 쓴다.

export type TrendCell = { month: string; target: number; done: number; pct: number | null }
export type TrendRow = { clinicId: string; name: string; cells: TrendCell[] }

export async function quotaTrend(clinics: { id: string; name: string }[], lastMonth: string, n = 6): Promise<{ months: string[]; rows: TrendRow[] }> {
  const months = Array.from({ length: n }, (_, i) => shiftMonth(lastMonth, i - (n - 1)))
  const from = monthRange(months[0]).start
  const to = monthRange(lastMonth).next
  const ids = clinics.map((c) => c.id)
  const [commitments, contents, meetings] = await Promise.all([
    prisma.monthlyCommitment.findMany({
      where: { clinicId: { in: ids }, monthStart: { gte: from, lt: to } },
      select: { clinicId: true, monthStart: true, kind: true, targetCount: true, tasks: { select: { status: true } } },
    }),
    prisma.publishedContent.groupBy({
      by: ["clinicId", "kind", "serviceMonth"],
      where: { clinicId: { in: ids }, serviceMonth: { gte: from, lt: to }, ...countableContent },
      _count: { _all: true },
    }),
    prisma.calendarEvent.findMany({
      where: {
        clinicId: { in: ids },
        type: "CLINIC_MEETING",
        status: "CONFIRMED",
        startAt: { gte: new Date(from.getTime() - KST_MS), lt: new Date(Math.min(to.getTime() - KST_MS, Date.now())) },
      },
      select: { clinicId: true, startAt: true },
    }),
  ])
  const key = (c: string, m: string) => `${c}|${m}`
  const ym = (d: Date) => d.toISOString().slice(0, 7)
  const content = new Map<string, number>()
  for (const g of contents) content.set(`${key(g.clinicId, ym(g.serviceMonth))}|${g.kind}`, g._count._all)
  const meet = new Map<string, number>()
  for (const e of meetings) {
    const k = key(e.clinicId!, new Date(e.startAt.getTime() + KST_MS).toISOString().slice(0, 7))
    meet.set(k, (meet.get(k) ?? 0) + 1)
  }
  const agg = new Map<string, { target: number; done: number }>()
  for (const c of commitments) {
    const k = key(c.clinicId, ym(c.monthStart))
    const done =
      c.kind === "BLOG_POST"
        ? content.get(`${k}|BLOG`) ?? 0
        : c.kind === "WEBSITE_COLUMN"
          ? content.get(`${k}|COLUMN`) ?? 0
          : c.kind === "CLINIC_MEETING"
            ? meet.get(k) ?? 0
            : c.tasks.filter((t) => t.status === "DONE").length
    const a = agg.get(k) ?? { target: 0, done: 0 }
    a.target += c.targetCount
    a.done += Math.min(done, c.targetCount)
    agg.set(k, a)
  }
  const rows = clinics.map((c) => ({
    clinicId: c.id,
    name: c.name,
    cells: months.map((m) => {
      const a = agg.get(key(c.id, m))
      return { month: m, target: a?.target ?? 0, done: a?.done ?? 0, pct: a && a.target ? a.done / a.target : null }
    }),
  }))
  return { months, rows }
}
