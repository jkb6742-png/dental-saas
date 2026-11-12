export const dynamic = "force-dynamic"

import { Suspense } from "react"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { requireWorkActor } from "@/lib/work/actor"
import { isMonth, currentMonth, monthRange, shiftMonth, kstToday, dateOnly, KST_MS } from "@/lib/work/common"
import { ensureCommitments, monthQuota } from "@/lib/work/contracts"
import { billingState, BILLING_STATE_LABEL } from "@/lib/work/billing"
import { clinicStatus, elapsedOf, quotaPct, LEVEL_LABEL, LEVEL_COLOR, type Level } from "./status"
import { quotaTrend } from "./trend"
import ClinicFilters from "./ClinicFilters"
import TrendPanel from "./TrendPanel"

// 치과별 월 현황: 문제 있는 치과부터. 상태 3단계(위험/주의/정상) + 사유 문구.
// 기본 정렬: 전월 미마감 → 기한 지난 업무 → 원장 요청 지연 → 진도 부족 → 정상.

const OPEN = ["TODO", "BLOCKED", "IN_PROGRESS", "IN_REVIEW"] as const
const REQ_OPEN = ["REQUESTED", "IN_REVIEW", "IN_PROGRESS"] as const

type SP = { month?: string; staff?: string; status?: string; close?: string; q?: string }

export default async function ClinicsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireWorkActor()
  const sp = await searchParams
  const month = isMonth(sp.month) ? sp.month : currentMonth()
  const { start, next } = monthRange(month)
  const prevStart = monthRange(shiftMonth(month, -1)).start
  const today = kstToday()
  const isCurrent = month === today.slice(0, 7)
  const daysInMonth = Math.round((next.getTime() - start.getTime()) / 86400_000)
  const elapsed = elapsedOf(month, today, daysInMonth)
  const tsFrom = new Date(start.getTime() - KST_MS)
  const tsTo = new Date(next.getTime() - KST_MS)
  const lateCut = new Date(Date.now() - 3 * 86400_000)
  const ids = actor.clinics.map((c) => c.id)

  // 담당 직원(퇴사자 제외)
  const access = await prisma.staffClinicAccess.findMany({
    where: { clinicId: { in: ids }, employee: { leftOn: null } },
    select: { clinicId: true, employeeUserId: true, employee: { select: { user: { select: { name: true } } } } },
  })
  const staffByClinic = new Map<string, { id: string; name: string }[]>()
  const staffAll = new Map<string, string>()
  for (const a of access) {
    const s = { id: a.employeeUserId, name: a.employee.user.name }
    staffByClinic.set(a.clinicId, [...(staffByClinic.get(a.clinicId) ?? []), s])
    staffAll.set(s.id, s.name)
  }
  const [prevCommit, prevCloses] = await Promise.all([
    prisma.monthlyCommitment.groupBy({ by: ["clinicId"], where: { clinicId: { in: ids }, monthStart: prevStart }, _count: { _all: true } }),
    prisma.clinicMonthClose.findMany({ where: { clinicId: { in: ids }, monthStart: prevStart }, select: { clinicId: true, operationsClosedAt: true, reopenedAt: true } }),
  ])
  const prevHasQuota = new Set(prevCommit.map((p) => p.clinicId))
  const prevClosed = new Set(prevCloses.filter((p) => p.operationsClosedAt && !p.reopenedAt).map((p) => p.clinicId))

  const all = await Promise.all(
    actor.clinics.map(async (c) => {
      await ensureCommitments(c.id, month)
      const [quota, openTasks, overdueTasks, openRequests, lateRequests, reports, meetings, close, bills] = await Promise.all([
        monthQuota(c.id, month),
        prisma.task.count({ where: { clinicId: c.id, status: { in: [...OPEN] } } }),
        prisma.task.count({ where: { clinicId: c.id, status: { in: [...OPEN] }, dueOn: { lt: dateOnly(today) } } }),
        prisma.serviceRequest.count({ where: { clinicId: c.id, status: { in: [...REQ_OPEN] } } }),
        prisma.serviceRequest.count({ where: { clinicId: c.id, status: { in: [...REQ_OPEN] }, createdAt: { lt: lateCut } } }),
        prisma.managedReport.count({ where: { clinicId: c.id, month: { startsWith: month } } }),
        prisma.calendarEvent.findMany({
          where: { clinicId: c.id, type: "CLINIC_MEETING", status: { not: "CANCELLED" }, startAt: { gte: tsFrom, lt: tsTo } },
          orderBy: { startAt: "asc" },
          select: { startAt: true, status: true },
        }),
        prisma.clinicMonthClose.findUnique({ where: { clinicId_monthStart: { clinicId: c.id, monthStart: start } }, select: { operationsClosedAt: true, reopenedAt: true, financeReviewedAt: true } }),
        actor.isMaster ? prisma.billingCycle.findMany({ where: { clinicId: c.id, serviceMonth: start, voidedAt: null }, include: { receipts: { select: { amountKrw: true } } } }) : Promise.resolve([]),
      ])
      const { target, done, pct } = quotaPct(quota)
      const billSum = bills.reduce((s, b) => s + b.amountDueKrw, 0)
      const paidSum = bills.reduce((s, b) => s + b.receipts.reduce((x, r) => x + r.amountKrw, 0), 0)
      const states = bills.map((b) => billingState(b, b.receipts.reduce((s, r) => s + r.amountKrw, 0)))
      const bill = states.includes("OVERDUE") ? "OVERDUE" : states[0] ?? null
      const st = clinicStatus({ quota, elapsed, overdueTasks, lateRequests, billOverdue: actor.isMaster && bill === "OVERDUE" })
      const ops = !!close?.operationsClosedAt && !close.reopenedAt
      const closeState: "open" | "ops" | "final" = ops ? (close?.financeReviewedAt ? "final" : "ops") : "open"
      const prevUnclosed = prevHasQuota.has(c.id) && !prevClosed.has(c.id)
      if (prevUnclosed) st.reasons.unshift(`${Number(shiftMonth(month, -1).slice(5))}월 미마감`)
      const now = Date.now()
      const metDone = meetings.filter((m) => m.status === "CONFIRMED" && m.startAt.getTime() < now)
      const metNext = meetings.find((m) => m.startAt.getTime() >= now)
      return {
        ...c,
        staff: staffByClinic.get(c.id) ?? [],
        quota,
        target,
        done,
        pct,
        ...st,
        openTasks,
        overdueTasks,
        openRequests,
        lateRequests,
        reports,
        meetingDone: metDone.length,
        meetingNext: metNext ? new Date(metNext.startAt.getTime() + KST_MS).toISOString().slice(5, 10).replace("-", ".") : null,
        closeState,
        prevUnclosed,
        bill,
        billSum,
        paidSum,
      }
    })
  )

  // 기본 정렬
  const rank = (r: (typeof all)[number]) => [r.prevUnclosed ? 0 : 1, r.overdueTasks > 0 ? 0 : 1, r.lateRequests > 0 ? 0 : 1, r.gap >= 0.1 ? 0 : 1, r.level === "risk" ? 0 : r.level === "warn" ? 1 : 2, -r.gap]
  all.sort((a, b) => {
    const x = rank(a)
    const y = rank(b)
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]
    return a.name.localeCompare(b.name, "ko")
  })
  const counts: Record<Level, number> = { risk: 0, warn: 0, ok: 0 }
  for (const r of all) counts[r.level]++

  const q = (sp.q ?? "").trim().toLowerCase()
  const rows = all.filter(
    (r) =>
      (!sp.staff || r.staff.some((s) => s.id === sp.staff)) &&
      (!sp.status || r.level === sp.status) &&
      (!sp.close || (sp.close === "prev" ? r.prevUnclosed : r.closeState === sp.close)) &&
      (!q || r.name.toLowerCase().includes(q))
  )
  const trend = await quotaTrend(actor.clinics, month)
  const total = all.reduce((s, r) => ({ target: s.target + r.target, done: s.done + r.done }), { target: 0, done: 0 })
  const keep = (m: string) => {
    const p = new URLSearchParams()
    p.set("month", m)
    for (const k of ["staff", "status", "close", "q"] as const) if (sp[k]) p.set(k, sp[k]!)
    return `/work/clinics?${p}`
  }
  const CLOSE_LABEL = { open: "진행중", ops: "운영 마감", final: "최종 마감" }

  return (
    <div className="space-y-3 max-w-[1600px]">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[20px] font-bold mr-2">치과별 월 현황</h1>
        <div className="flex items-center rounded border border-[#d1d1cc] bg-white overflow-hidden">
          <Link prefetch={false} aria-label="지난달" className="px-2.5 py-1 text-[14px] hover:bg-[#ecece9]" href={keep(shiftMonth(month, -1))}>
            ‹
          </Link>
          <span className="px-2 text-[14px] font-semibold tabular-nums border-x border-[#d1d1cc]">
            {month.slice(0, 4)}. {month.slice(5)}
          </span>
          <Link prefetch={false} aria-label="다음달" className="px-2.5 py-1 text-[14px] hover:bg-[#ecece9]" href={keep(shiftMonth(month, 1))}>
            ›
          </Link>
        </div>
        {!isCurrent && (
          <Link prefetch={false} className="text-[13px] text-[#0062ff] hover:underline" href={keep(currentMonth())}>
            이번 달
          </Link>
        )}
        <Suspense>
          <ClinicFilters staff={[...staffAll.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "ko"))} />
        </Suspense>
        <span className="ml-auto text-[13px] text-[#6f6f6a] tabular-nums">
          전체 분량 <b className="text-[#0a0a0a]">{total.done}/{total.target}</b>
          <span className="ml-3" style={{ color: LEVEL_COLOR.risk }}>위험 {counts.risk}</span>
          <span className="ml-2" style={{ color: LEVEL_COLOR.warn }}>주의 {counts.warn}</span>
          <span className="ml-2">정상 {counts.ok}</span>
        </span>
      </div>

      <div className="bg-white rounded border border-[#d1d1cc] overflow-x-auto">
        <table className="w-full text-[14px] min-w-[1040px]">
          <thead>
            <tr className="text-[12px] text-[#6f6f6a] border-b border-[#d1d1cc] bg-[#f7f7f5]">
              <th className="text-left py-2 px-4 font-medium">치과 / 담당</th>
              <th className="text-left py-2 px-2 font-medium w-[260px]">계약 이행{isCurrent ? ` (기준 진도 ${Math.round(elapsed * 100)}%)` : ""}</th>
              <th className="text-left py-2 px-2 font-medium w-[118px]">진행 업무</th>
              <th className="text-left py-2 px-2 font-medium w-[118px]">원장 요청</th>
              <th className="text-left py-2 px-2 font-medium w-[130px]">보고 / 미팅</th>
              <th className="text-left py-2 px-2 font-medium w-[84px]">월 마감</th>
              {actor.isMaster && <th className="text-right py-2 px-4 font-medium w-[130px]">청구 / 입금</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={actor.isMaster ? 7 : 6} className="py-6 text-center text-[13px] text-[#8a8a84]">
                  조건에 맞는 치과가 없습니다.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#f2f2ef] last:border-0 hover:bg-[#fafaf8] align-top">
                <td className="py-2.5 px-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: LEVEL_COLOR[r.level] }} aria-hidden="true" />
                    <Link prefetch={false} className="font-semibold hover:text-[#0062ff]" href={`/work/clinics/${r.id}/${month}`}>
                      {r.name}
                    </Link>
                    <span className="text-[12px] text-[#8a8a84] truncate">{r.staff.length ? r.staff.map((s) => s.name).join(", ") : "담당 없음"}</span>
                  </div>
                  <div className="pl-4 text-[12px] mt-0.5" style={{ color: r.level === "ok" ? "#8a8a84" : LEVEL_COLOR[r.level] }}>
                    {LEVEL_LABEL[r.level]}
                    {r.reasons.length > 0 && ` · ${r.reasons.join(" · ")}`}
                  </div>
                </td>
                <td className="py-2.5 px-2">
                  {r.quota.length === 0 ? (
                    <span className="text-[13px] text-[#b0b0aa]">계약 없음</span>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1 h-2 rounded-full bg-[#ecece9] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(r.pct! * 100))}%`, background: r.pct! >= 1 ? "#1a7f37" : r.level === "risk" ? "#d92d20" : "#0062ff" }} />
                          {isCurrent && <div className="absolute top-0 bottom-0 w-px bg-[#0a0a0a]/50" style={{ left: `${Math.round(elapsed * 100)}%` }} aria-hidden="true" />}
                        </div>
                        <span className="w-[86px] text-right text-[13px] tabular-nums font-medium">
                          {r.done}/{r.target} · {Math.round(r.pct! * 100)}%
                        </span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-[#8a8a84] truncate">
                        {r.quota.map((q) => (
                          <span key={q.kind} className={`mr-2 ${q.done >= q.target ? "text-[#1a7f37]" : ""}`}>
                            {q.label} {q.done}/{q.target}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-2 text-[13px] tabular-nums">
                  <Link prefetch={false} href={`/work/board?scope=${r.id}`} className="hover:underline">
                    진행 {r.openTasks}
                    {r.overdueTasks > 0 && <span className="text-[#d92d20] font-semibold"> · 지연 {r.overdueTasks}</span>}
                  </Link>
                </td>
                <td className="py-2.5 px-2 text-[13px] tabular-nums">
                  {r.openRequests === 0 ? (
                    <span className="text-[#c4c4be]">없음</span>
                  ) : (
                    <span className="text-[#b54708]">
                      미처리 {r.openRequests}
                      {r.lateRequests > 0 && <span className="text-[#d92d20] font-semibold"> · 지연 {r.lateRequests}</span>}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-2 text-[13px] tabular-nums">
                  <span className={r.reports ? "" : "text-[#8a8a84]"}>보고서 {r.reports}</span>
                  <span className="text-[#c4c4be]"> · </span>
                  {r.meetingDone > 0 ? (
                    <span className="text-[#1a7f37]">미팅 완료</span>
                  ) : r.meetingNext ? (
                    <span className="text-[#6f6f6a]">미팅 {r.meetingNext}</span>
                  ) : (
                    <span className="text-[#8a8a84]">미팅 미완</span>
                  )}
                </td>
                <td className={`py-2.5 px-2 text-[13px] ${r.closeState === "open" ? "text-[#6f6f6a]" : "text-[#1a7f37]"}`}>
                  {CLOSE_LABEL[r.closeState]}
                  {r.prevUnclosed && <div className="text-[12px] text-[#d92d20]">전월 미마감</div>}
                </td>
                {actor.isMaster && (
                  <td className={`py-2.5 px-4 text-right text-[13px] tabular-nums ${r.bill === "OVERDUE" ? "text-[#d92d20] font-semibold" : r.bill === "PAID" ? "text-[#1a7f37]" : "text-[#6f6f6a]"}`}>
                    {r.bill ? (
                      <>
                        {BILLING_STATE_LABEL[r.bill as keyof typeof BILLING_STATE_LABEL]}
                        <div className="text-[12px] text-[#8a8a84] font-normal">
                          {Math.round(r.paidSum / 10000).toLocaleString("ko-KR")}/{Math.round(r.billSum / 10000).toLocaleString("ko-KR")}만원
                        </div>
                      </>
                    ) : (
                      <span className="text-[#c4c4be]">-</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-[#8a8a84]">
        위험 = 기준 진도보다 20%p 이상 부족 · 3일 넘게 처리 안 된 원장 요청{actor.isMaster ? " · 입금 연체" : ""}. 주의 = 10%p 이상 부족 · 기한 지난 업무. 막대의 세로선은 오늘 기준 진도입니다.
      </p>

      <TrendPanel months={trend.months} rows={trend.rows} currentMonth={today.slice(0, 7)} />
    </div>
  )
}
