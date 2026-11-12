export const dynamic = "force-dynamic"

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { requireWorkActor } from "@/lib/work/actor"
import { isMonth, monthRange, shiftMonth, KST_MS, currentMonth, kstToday } from "@/lib/work/common"
import { ensureCommitments, monthQuota } from "@/lib/work/contracts"
import { CONTENT_KIND_LABEL } from "@/lib/work/content"
import { TASK_STATUS_LABEL, TASK_CATEGORY_LABEL } from "@/lib/work/tasks"
import { billingState, BILLING_STATE_LABEL } from "@/lib/work/billing"
import { clinicStatus, elapsedOf, quotaPct, LEVEL_LABEL, LEVEL_COLOR } from "../../status"
import { QuotaCard, CloseChecklist, NoteForm, DeleteNote, FinanceReview, type Check } from "./MonthClient"

// 치과 월 상세: 상단 고정 요약 + 탭(개요·업무·발행·소통·자료·정산[대표]).

const kst = (d: Date) => new Date(d.getTime() + KST_MS).toISOString().slice(0, 16).replace("T", " ")
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "-")
const WEEK = ["일", "월", "화", "수", "목", "금", "토"]
const REQUEST_STATUS: Record<string, string> = { REQUESTED: "접수", IN_REVIEW: "검토중", IN_PROGRESS: "진행중", DONE: "완료", CANCELED: "취소" }
const REQ_OPEN = ["REQUESTED", "IN_REVIEW", "IN_PROGRESS"] as const
const NOTE_KIND: Record<string, string> = { CALL: "통화", MEETING: "미팅", REQUEST: "요청", SPECIAL: "특이사항", OTHER: "기타" }
const VERIFY_LABEL: Record<string, string> = { PENDING: "확인 전", VERIFIED: "확인", REJECTED: "반려" }
const VAT_LABEL: Record<string, string> = { INCLUDED: "VAT 포함", EXCLUDED: "VAT 별도", UNCONFIRMED: "VAT 미확인" }

const TABS = [
  ["overview", "개요"],
  ["tasks", "업무"],
  ["content", "발행"],
  ["comms", "소통"],
  ["files", "자료"],
  ["finance", "정산"],
] as const
type Tab = (typeof TABS)[number][0]

/** 날짜 표시: 오늘 / 내일 / 11.18(수) */
function dayLabel(ymdStr: string, today: string) {
  if (ymdStr === today) return "오늘"
  const tmr = new Date(Date.parse(`${today}T00:00:00Z`) + 86400_000).toISOString().slice(0, 10)
  if (ymdStr === tmr) return "내일"
  const d = new Date(`${ymdStr}T00:00:00Z`)
  return `${Number(ymdStr.slice(5, 7))}.${ymdStr.slice(8, 10)}(${WEEK[d.getUTCDay()]})`
}
function lateDays(ymdStr: string, today: string) {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${ymdStr}T00:00:00Z`)) / 86400_000)
}

export default async function ClinicMonthPage({ params, searchParams }: { params: Promise<{ clinicId: string; month: string }>; searchParams: Promise<{ tab?: string }> }) {
  const actor = await requireWorkActor()
  const { clinicId, month } = await params
  const sp = await searchParams
  if (!isMonth(month)) redirect(`/work/clinics/${clinicId}/${currentMonth()}`)
  const clinic = actor.clinics.find((c) => c.id === clinicId)
  if (!clinic) notFound()
  const tabs = TABS.filter(([k]) => k !== "finance" || actor.isMaster)
  const tab: Tab = tabs.some(([k]) => k === sp.tab) ? (sp.tab as Tab) : "overview"

  const { start, next } = monthRange(month)
  const tsFrom = new Date(start.getTime() - KST_MS)
  const tsTo = new Date(next.getTime() - KST_MS)
  const today = kstToday()
  const daysInMonth = Math.round((next.getTime() - start.getTime()) / 86400_000)
  const elapsed = elapsedOf(month, today, daysInMonth)
  await ensureCommitments(clinicId, month)

  const [quota, contents, tasks, monthRequests, openRequests, reports, events, notes, files, close, staff, memos, billing, contracts] = await Promise.all([
    monthQuota(clinicId, month),
    prisma.publishedContent.findMany({
      where: { clinicId, serviceMonth: start },
      select: { id: true, kind: true, title: true, url: true, publishedAt: true, verification: true, unpublishedAt: true, authorNameSnapshot: true },
      orderBy: { publishedAt: "asc" },
    }),
    prisma.task.findMany({
      where: { clinicId, OR: [{ dueOn: { gte: start, lt: next } }, { completedAt: { gte: tsFrom, lt: tsTo } }, { monthlyCommitment: { monthStart: start } }] },
      select: { id: true, title: true, status: true, category: true, dueOn: true, group: { select: { name: true } }, assignee: { select: { user: { select: { name: true } } } } },
      orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }],
    }),
    prisma.serviceRequest.findMany({
      where: { clinicId, OR: [{ createdAt: { gte: tsFrom, lt: tsTo } }, { completedAt: { gte: tsFrom, lt: tsTo } }] },
      select: { id: true, title: true, status: true, createdAt: true, completedAt: true, dueDate: true, assignee: true },
    }),
    prisma.serviceRequest.findMany({
      where: { clinicId, status: { in: [...REQ_OPEN] } },
      select: { id: true, title: true, status: true, createdAt: true, dueDate: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.managedReport.findMany({
      where: { clinicId, OR: [{ month: { startsWith: month } }, { month: null, createdAt: { gte: tsFrom, lt: tsTo } }] },
      select: { id: true, title: true, month: true, fileType: true, createdAt: true, sector: { select: { name: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { clinicId, type: "CLINIC_MEETING", startAt: { gte: tsFrom, lt: tsTo }, status: { not: "CANCELLED" } },
      select: { id: true, title: true, startAt: true, status: true, location: true, organizer: { select: { name: true } } },
      orderBy: { startAt: "asc" },
    }),
    prisma.clinicNote.findMany({
      where: { clinicId, deletedAt: null, occurredAt: { gte: tsFrom, lt: tsTo } },
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        occurredAt: true,
        authorUserId: true,
        author: { select: { name: true } },
        task: { select: { id: true, title: true } },
        serviceRequest: { select: { title: true, status: true } },
      },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.sharedFile.findMany({
      where: { clinicId, deletedAt: null, createdAt: { gte: tsFrom, lt: tsTo } },
      select: { id: true, title: true, visibility: true, createdAt: true, uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clinicMonthClose.findUnique({
      where: { clinicId_monthStart: { clinicId, monthStart: start } },
      include: { operationsClosedBy: { select: { name: true } }, financeReviewedBy: { select: { name: true } } },
    }),
    prisma.staffClinicAccess.findMany({ where: { clinicId, employee: { leftOn: null } }, select: { employee: { select: { user: { select: { name: true } } } } } }),
    prisma.workMemo.findMany({ where: { userId: actor.id, clinicId, archivedAt: null }, select: { id: true, body: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    actor.isMaster
      ? prisma.billingCycle.findMany({
          where: { clinicId, serviceMonth: start },
          include: { receipts: { select: { id: true, amountKrw: true, receivedOn: true, memo: true }, orderBy: { receivedOn: "asc" } }, contract: { select: { planName: true } } },
        })
      : Promise.resolve([]),
    actor.isMaster
      ? prisma.clinicContract.findMany({
          where: { clinicId, status: "ACTIVE", startsOn: { lt: next }, OR: [{ endsOn: null }, { endsOn: { gte: start } }] },
          select: { id: true, planName: true, monthlyFeeKrw: true, vatTreatment: true, startsOn: true, endsOn: true, billDayOfMonth: true, paymentDueDay: true },
        })
      : Promise.resolve([]),
  ])

  const label = `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`
  const opsClosed = !!close?.operationsClosedAt && !close.reopenedAt
  const finalClosed = opsClosed && !!close?.financeReviewedAt
  const { target: qTarget, done: qDone } = quotaPct(quota)
  const liveTasks = tasks.filter((t) => t.status !== "CANCELLED")
  const tasksDone = liveTasks.filter((t) => t.status === "DONE").length
  const isLate = (t: (typeof tasks)[number]) => !!t.dueOn && ymd(t.dueOn) < today && t.status !== "DONE" && t.status !== "CANCELLED"
  const tasksLate = tasks.filter(isLate).length
  const lateCut = Date.now() - 3 * 86400_000
  const lateRequests = openRequests.filter((r) => r.createdAt.getTime() < lateCut).length
  const billStates = billing.map((b) => billingState(b, b.receipts.reduce((s, r) => s + r.amountKrw, 0)))
  const st = clinicStatus({ quota, elapsed, overdueTasks: tasksLate, lateRequests, billOverdue: actor.isMaster && billStates.includes("OVERDUE") })
  const now = Date.now()
  const meetingsDone = events.filter((e) => e.status === "CONFIRMED" && e.startAt.getTime() < now)
  const meetingTarget = quota.find((q) => q.kind === "CLINIC_MEETING")?.target ?? 1
  const staffNames = staff.map((s) => s.employee.user.name)
  const href = (t: Tab) => `/work/clinics/${clinicId}/${month}${t === "overview" ? "" : `?tab=${t}`}`

  // 월 마감 체크리스트(데이터로 자동 판정)
  const short = quota.filter((q) => q.done < q.target)
  const checks: Check[] = [
    {
      key: "quota",
      label: "계약 분량 충족",
      ok: short.length === 0,
      detail: quota.length === 0 ? "계약 분량 없음" : short.length ? short.map((q) => `${q.label} ${q.done}/${q.target}`).join(", ") : `${qDone}/${qTarget}`,
      href: `/work/content?clinicId=${clinicId}&month=${month}`,
      fix: "발행 입력",
    },
    { key: "report", label: "보고서 업로드", ok: reports.length > 0, detail: reports.length ? `${reports.length}건` : "이 달 보고서 없음", href: `/dashboard/${clinicId}/reports`, fix: "보고서 올리기" },
    {
      key: "meeting",
      label: "정기 미팅",
      ok: meetingsDone.length >= meetingTarget,
      detail: `완료 ${meetingsDone.length}/${meetingTarget}${events.length > meetingsDone.length ? ` · 예정 ${events.length - meetingsDone.length}` : ""}`,
      href: `/work/calendar`,
      fix: "일정 잡기",
    },
    { key: "requests", label: "미해결 요청 0건", ok: openRequests.length === 0, detail: openRequests.length ? `미처리 ${openRequests.length}건` : "없음", href: `/dashboard/${clinicId}/requests`, fix: "요청 처리" },
  ]
  const closeInfo = close
    ? {
        opsClosed,
        opsBy: close.operationsClosedBy?.name ?? null,
        opsAt: close.operationsClosedAt ? kst(close.operationsClosedAt) : null,
        exceptionNote: close.exceptionNote,
        financeAt: close.financeReviewedAt ? kst(close.financeReviewedAt) : null,
        financeBy: close.financeReviewedBy?.name ?? null,
        reopenNote: close.reopenedAt ? close.note : null,
        reopenedAt: close.reopenedAt ? kst(close.reopenedAt) : null,
      }
    : null

  // 소통 타임라인(최신순)
  type Item = { id: string; at: Date; type: string; title: string; body?: string | null; who?: string | null; link?: { href: string; text: string } | null; extra?: string | null; noteId?: string; canDelete?: boolean }
  const timeline: Item[] = [
    ...notes.map((n) => ({
      id: `n-${n.id}`,
      at: n.occurredAt,
      type: NOTE_KIND[n.kind],
      title: n.title ?? "",
      body: n.body,
      who: n.author.name,
      link: n.task ? { href: `/work/tasks?open=${n.task.id}`, text: `업무: ${n.task.title}` } : null,
      extra: n.serviceRequest ? `요청: ${n.serviceRequest.title} (${REQUEST_STATUS[n.serviceRequest.status] ?? n.serviceRequest.status})` : null,
      noteId: n.id,
      canDelete: n.authorUserId === actor.id || actor.isMaster,
    })),
    ...events.map((e) => ({
      id: `e-${e.id}`,
      at: e.startAt,
      type: "미팅",
      title: e.title,
      who: e.organizer.name,
      extra: `${e.status === "TENTATIVE" ? "미확정" : e.startAt.getTime() < now ? "완료" : "예정"}${e.location ? ` · ${e.location}` : ""}`,
      link: { href: "/work/calendar", text: "일정" },
    })),
    ...monthRequests
      .filter((r) => r.createdAt >= tsFrom && r.createdAt < tsTo)
      .map((r) => {
        const open = (REQ_OPEN as readonly string[]).includes(r.status)
        const late = open && r.createdAt.getTime() < lateCut
        return {
          id: `r-${r.id}`,
          at: r.createdAt,
          type: "요청",
          title: r.title,
          who: r.assignee,
          extra: `${REQUEST_STATUS[r.status] ?? r.status}${r.dueDate ? ` · 기한 ${dayLabel(ymd(r.dueDate), today)}` : ""}${late ? " · 3일 넘게 처리 안 됨" : ""}`,
          link: { href: `/dashboard/${clinicId}/requests`, text: "요청 보기" },
        }
      }),
    ...monthRequests
      .filter((r) => r.completedAt && r.completedAt >= tsFrom && r.completedAt < tsTo)
      .map((r) => ({ id: `rc-${r.id}`, at: r.completedAt!, type: "요청", title: r.title, extra: "처리 완료", who: r.assignee, link: { href: `/dashboard/${clinicId}/requests`, text: "요청 보기" } })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime())

  // 업무를 그룹별로
  const byGroup = new Map<string, typeof tasks>()
  for (const t of tasks) byGroup.set(t.group?.name ?? "그룹 없음", [...(byGroup.get(t.group?.name ?? "그룹 없음") ?? []), t])
  const topTasks = tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED").slice(0, 5)

  const closeText = finalClosed ? "최종 마감" : opsClosed ? "운영 마감" : "진행중"

  return (
    <div className="max-w-[1600px]">
      {/* 상단 고정 */}
      <div className="sticky -top-3 z-20 -mt-3 pt-3 bg-[#f2f2ef]">
        <div className="bg-white rounded border border-[#d1d1cc]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3">
            <Link prefetch={false} href={`/work/clinics?month=${month}`} className="text-[13px] text-[#6f6f6a] hover:underline">
              치과별 현황
            </Link>
            <span className="text-[#c4c4be]">/</span>
            <h1 className="text-[19px] font-bold">{clinic.name}</h1>
            <div className="flex items-center rounded border border-[#d1d1cc] overflow-hidden text-[14px]">
              <Link prefetch={false} aria-label="지난달" className="px-2 py-0.5 hover:bg-[#ecece9]" href={`/work/clinics/${clinicId}/${shiftMonth(month, -1)}${tab === "overview" ? "" : `?tab=${tab}`}`}>
                ‹
              </Link>
              <span className="px-2 font-semibold tabular-nums border-x border-[#d1d1cc]">{label}</span>
              <Link prefetch={false} aria-label="다음달" className="px-2 py-0.5 hover:bg-[#ecece9]" href={`/work/clinics/${clinicId}/${shiftMonth(month, 1)}${tab === "overview" ? "" : `?tab=${tab}`}`}>
                ›
              </Link>
            </div>
            <span className="text-[13px] text-[#6f6f6a]">담당 {staffNames.length ? staffNames.join(", ") : "없음"}</span>
            <span className={`text-[13px] font-medium ${opsClosed ? "text-[#1a7f37]" : "text-[#6f6f6a]"}`}>{closeText}</span>
            <span className="text-[13px]" style={{ color: LEVEL_COLOR[st.level] }}>
              {LEVEL_LABEL[st.level]}
              {st.reasons.length > 0 && ` · ${st.reasons.join(" · ")}`}
            </span>
            <span className="ml-auto flex gap-3 text-[13px]">
              <Link prefetch={false} href={`/work/board?scope=${clinicId}`} className="text-[#0062ff] hover:underline">
                업무 보드
              </Link>
              <Link prefetch={false} href={`/dashboard/${clinicId}`} className="text-[#0062ff] hover:underline">
                원장 화면
              </Link>
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 mt-2 border-t border-[#f2f2ef] divide-x divide-[#f2f2ef]">
            <Stat label="계약 이행" value={qTarget ? `${qDone}/${qTarget}` : "-"} sub={qTarget ? `${Math.round((qDone / qTarget) * 100)}% · 기준 ${Math.round(elapsed * 100)}%` : "계약 분량 없음"} />
            <Stat label="업무" value={`${tasksDone}/${liveTasks.length}`} sub={tasksLate ? `${tasksLate}건 기한 지남` : "기한 지난 업무 없음"} warn={tasksLate > 0} />
            <Stat label="미처리 요청" value={String(openRequests.length)} sub={lateRequests ? `${lateRequests}건 3일 초과` : "지연 없음"} warn={lateRequests > 0} amber={openRequests.length > 0} />
            <Stat label="보고 / 미팅" value={`${reports.length} / ${meetingsDone.length}`} sub={`보고서 ${reports.length}건 · 미팅 완료 ${meetingsDone.length}회`} />
          </div>
          <nav className="flex gap-1 px-3 border-t border-[#f2f2ef]" aria-label="상세 탭">
            {tabs.map(([k, l]) => (
              <Link
                key={k}
                prefetch={false}
                href={href(k)}
                aria-current={tab === k ? "page" : undefined}
                className={`px-3 py-2 text-[14px] border-b-2 -mb-px ${tab === k ? "border-[#0062ff] text-[#0062ff] font-semibold" : "border-transparent text-[#555555] hover:text-[#0a0a0a]"}`}
              >
                {l}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="mt-3">
        {tab === "overview" && (
          <div className="grid lg:grid-cols-[3fr_2fr] gap-4 items-start">
            <div className="space-y-4">
              <QuotaCard quota={quota} isMaster={actor.isMaster} expected={elapsed < 1 && elapsed > 0 ? elapsed : null} />
              <Card title="진행 업무" desc="기한 빠른 순 5건" action={<Link prefetch={false} className="text-[13px] text-[#0062ff] hover:underline" href={href("tasks")}>전체 {tasks.length}건</Link>}>
                {topTasks.length === 0 ? (
                  <Empty>진행 중인 업무가 없습니다.</Empty>
                ) : (
                  <ul className="divide-y divide-[#f2f2ef]">
                    {topTasks.map((t) => (
                      <TaskLine key={t.id} t={t} today={today} late={isLate(t)} />
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="원장 요청" desc={`미처리 ${openRequests.length}건`} action={<Link prefetch={false} className="text-[13px] text-[#0062ff] hover:underline" href={`/dashboard/${clinicId}/requests`}>요청 화면</Link>}>
                {openRequests.length === 0 ? (
                  <Empty>처리 안 된 요청이 없습니다.</Empty>
                ) : (
                  <ul className="divide-y divide-[#f2f2ef]">
                    {openRequests.map((r) => {
                      const age = lateDays(new Date(r.createdAt.getTime() + KST_MS).toISOString().slice(0, 10), today)
                      return (
                        <li key={r.id} className="px-4 py-2 flex gap-3 text-[14px]">
                          <span className="flex-1 truncate">{r.title}</span>
                          <span className="text-[12px] text-[#6f6f6a] w-[48px]">{REQUEST_STATUS[r.status]}</span>
                          <span className={`text-[12px] w-[96px] text-right tabular-nums ${age > 3 ? "text-[#d92d20] font-semibold" : "text-[#6f6f6a]"}`}>{age > 3 ? `${age}일째 대기` : `접수 ${dayLabel(new Date(r.createdAt.getTime() + KST_MS).toISOString().slice(0, 10), today)}`}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            </div>
            <div className="space-y-4">
              <CloseChecklist clinicId={clinicId} month={month} isMaster={actor.isMaster} checks={checks} info={closeInfo} />
              <Card title="최근 소통" desc="최근 3건" action={<Link prefetch={false} className="text-[13px] text-[#0062ff] hover:underline" href={href("comms")}>전체 · 남기기</Link>}>
                {timeline.length === 0 ? (
                  <Empty>이 달 소통 기록이 없습니다.</Empty>
                ) : (
                  <ul className="divide-y divide-[#f2f2ef]">
                    {timeline.slice(0, 3).map((i) => (
                      <li key={i.id} className="px-4 py-2 text-[14px]">
                        <div className="text-[12px] text-[#6f6f6a] flex gap-2">
                          <span className="font-medium text-[#0a0a0a]">{i.type}</span>
                          <span className="tabular-nums">{kst(i.at).slice(5, 10).replace("-", ".")}</span>
                          {i.who && <span>{i.who}</span>}
                        </div>
                        <div className="truncate">{i.title || i.body}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        )}

        {tab === "tasks" && (
          <Card title="업무" desc={`${tasks.length}건 · 완료 ${tasksDone} · 기한 지남 ${tasksLate}`} action={<Link prefetch={false} className="text-[13px] text-[#0062ff] hover:underline" href={`/work/board?scope=${clinicId}`}>업무 보드에서 보기</Link>}>
            {tasks.length === 0 ? (
              <Empty>이 달 업무가 없습니다.</Empty>
            ) : (
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="text-[12px] text-[#6f6f6a] border-b border-[#d1d1cc]">
                    <th className="text-left font-medium py-2 px-4">업무</th>
                    <th className="text-left font-medium py-2 px-2 w-[80px]">분류</th>
                    <th className="text-left font-medium py-2 px-2 w-[90px]">담당</th>
                    <th className="text-left font-medium py-2 px-2 w-[110px]">기한</th>
                    <th className="text-right font-medium py-2 px-4 w-[80px]">상태</th>
                  </tr>
                </thead>
                {[...byGroup.entries()].map(([gname, list]) => (
                  <tbody key={gname}>
                    <tr className="bg-[#f7f7f5] border-b border-[#ecece9]">
                      <td colSpan={5} className="px-4 py-1.5 text-[12px] font-semibold text-[#555555]">
                        {gname} <span className="font-normal text-[#8a8a84] tabular-nums">{list.filter((t) => t.status === "DONE").length}/{list.length}</span>
                      </td>
                    </tr>
                    {list.map((t) => {
                      const late = isLate(t)
                      return (
                        <tr key={t.id} className="border-b border-[#f2f2ef] last:border-0">
                          <td className="py-1.5 px-4">
                            <Link prefetch={false} href={`/work/tasks?open=${t.id}`} className={`hover:underline ${t.status === "CANCELLED" ? "line-through text-[#b0b0aa]" : ""}`}>
                              {t.title}
                            </Link>
                          </td>
                          <td className="py-1.5 px-2 text-[12px] text-[#6f6f6a]">{TASK_CATEGORY_LABEL[t.category]}</td>
                          <td className="py-1.5 px-2 text-[13px] text-[#555555]">{t.assignee?.user.name ?? <span className="text-[#b0b0aa]">미배정</span>}</td>
                          <td className={`py-1.5 px-2 text-[13px] tabular-nums ${late ? "text-[#d92d20]" : "text-[#555555]"}`}>{t.dueOn ? (late ? `${lateDays(ymd(t.dueOn), today)}일 지연` : dayLabel(ymd(t.dueOn), today)) : "-"}</td>
                          <td className={`py-1.5 px-4 text-right text-[13px] ${t.status === "DONE" ? "text-[#1a7f37]" : t.status === "BLOCKED" ? "text-[#b54708]" : ""}`}>{TASK_STATUS_LABEL[t.status]}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                ))}
              </table>
            )}
          </Card>
        )}

        {tab === "content" && (
          <Card title="발행 기록" desc={`이행 대상월 ${label} · ${contents.length}건`} action={<Link prefetch={false} className="text-[13px] text-[#0062ff] hover:underline" href={`/work/content?clinicId=${clinicId}&month=${month}`}>입력·수정</Link>}>
            {contents.length === 0 ? (
              <Empty>발행 기록이 없습니다.</Empty>
            ) : (
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="text-[12px] text-[#6f6f6a] border-b border-[#d1d1cc]">
                    <th className="text-left font-medium py-2 px-4 w-[110px]">종류</th>
                    <th className="text-left font-medium py-2 px-2">제목</th>
                    <th className="text-left font-medium py-2 px-2 w-[90px]">작성</th>
                    <th className="text-left font-medium py-2 px-2 w-[110px]">발행일</th>
                    <th className="text-right font-medium py-2 px-4 w-[80px]">확인</th>
                  </tr>
                </thead>
                <tbody>
                  {contents.map((c) => {
                    const off = !!c.unpublishedAt || c.verification === "REJECTED"
                    return (
                      <tr key={c.id} className={`border-b border-[#f2f2ef] last:border-0 ${off ? "text-[#b0b0aa]" : ""}`}>
                        <td className="py-1.5 px-4 text-[13px] text-[#6f6f6a]">{CONTENT_KIND_LABEL[c.kind]}</td>
                        <td className="py-1.5 px-2">
                          <a className={`hover:underline ${off ? "line-through" : ""}`} href={c.url} target="_blank" rel="noreferrer">
                            {c.title}
                          </a>
                        </td>
                        <td className="py-1.5 px-2 text-[13px] text-[#555555]">{c.authorNameSnapshot ?? "-"}</td>
                        <td className="py-1.5 px-2 text-[13px] tabular-nums">{dayLabel(kst(c.publishedAt).slice(0, 10), today)}</td>
                        <td className={`py-1.5 px-4 text-right text-[13px] ${c.unpublishedAt ? "" : c.verification === "VERIFIED" ? "text-[#1a7f37]" : c.verification === "REJECTED" ? "text-[#d92d20]" : "text-[#b54708]"}`}>
                          {c.unpublishedAt ? "내림" : VERIFY_LABEL[c.verification]}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {tab === "comms" && (
          <div className="space-y-4">
            <NoteForm clinicId={clinicId} month={month} />
            <Card title="소통 타임라인" desc={`${timeline.length}건 · 통화·미팅·요청·특이사항 최신순`}>
              {timeline.length === 0 ? (
                <Empty>이 달 소통 기록이 없습니다.</Empty>
              ) : (
                <ul className="divide-y divide-[#f2f2ef]">
                  {timeline.map((i) => (
                    <li key={i.id} className="px-4 py-2.5 flex gap-4 text-[14px]">
                      <div className="w-[92px] shrink-0 text-[12px] text-[#6f6f6a] tabular-nums">
                        <div className="font-semibold text-[#0a0a0a] text-[13px]">{i.type}</div>
                        {dayLabel(kst(i.at).slice(0, 10), today)} {kst(i.at).slice(11)}
                      </div>
                      <div className="flex-1 min-w-0">
                        {i.title && <div className="font-medium">{i.title}</div>}
                        {i.body && <div className="whitespace-pre-wrap text-[#333333]">{i.body}</div>}
                        <div className="text-[12px] text-[#6f6f6a] flex flex-wrap gap-x-3 mt-0.5">
                          {i.who && <span>{i.who}</span>}
                          {i.extra && <span className={i.extra.includes("3일 넘게") ? "text-[#d92d20]" : ""}>{i.extra}</span>}
                          {i.link && (
                            <Link prefetch={false} href={i.link.href} className="text-[#0062ff] hover:underline">
                              {i.link.text}
                            </Link>
                          )}
                          {i.noteId && i.canDelete && <DeleteNote id={i.noteId} />}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {tab === "files" && (
          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <Card title="보고서" desc="원장 화면에 올린 보고서" action={<Link prefetch={false} className="text-[13px] text-[#0062ff] hover:underline" href={`/dashboard/${clinicId}/reports`}>보고서 관리</Link>}>
              {reports.length === 0 ? (
                <Empty>이 달 보고서가 없습니다.</Empty>
              ) : (
                <ul className="divide-y divide-[#f2f2ef]">
                  {reports.map((r) => (
                    <li key={r.id} className="px-4 py-2 flex gap-3 text-[14px]">
                      <span className="w-[110px] shrink-0 truncate text-[12px] text-[#6f6f6a]">{r.sector.name}</span>
                      <span className="flex-1 truncate">{r.title}</span>
                      <span className="text-[12px] text-[#8a8a84] uppercase">{r.fileType}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="올린 파일" desc={`${files.length}건`} action={<Link prefetch={false} className="text-[13px] text-[#0062ff] hover:underline" href="/work/files">파일 공유</Link>}>
              {files.length === 0 ? (
                <Empty>이 달 올린 파일이 없습니다.</Empty>
              ) : (
                <ul className="divide-y divide-[#f2f2ef]">
                  {files.map((f) => (
                    <li key={f.id} className="px-4 py-2 flex gap-3 text-[14px]">
                      <a className="flex-1 truncate hover:underline" href={`/api/work/files/${f.id}/download?inline=1`} target="_blank" rel="noreferrer">
                        {f.title}
                      </a>
                      <span className="text-[12px] text-[#6f6f6a]">{f.uploadedBy.name}</span>
                      <span className="text-[12px] text-[#6f6f6a] w-[60px] text-right">{f.visibility === "CLINIC" ? "원장 공개" : "직원만"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="내 메모" desc="이 치과로 남긴 내 빠른 메모(본인만 보임)">
              {memos.length === 0 ? (
                <Empty>이 치과로 남긴 메모가 없습니다.</Empty>
              ) : (
                <ul className="divide-y divide-[#f2f2ef]">
                  {memos.map((m) => (
                    <li key={m.id} className="px-4 py-2 text-[14px]">
                      <div className="text-[12px] text-[#6f6f6a] tabular-nums">{kst(m.createdAt)}</div>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {tab === "finance" && actor.isMaster && (
          <div className="grid lg:grid-cols-[3fr_2fr] gap-4 items-start">
            <div className="space-y-4">
              <Card title="청구·입금" desc={`${label} 대상`} action={<Link prefetch={false} className="text-[13px] text-[#0062ff] hover:underline" href={`/work/billing?month=${month}`}>청구 관리</Link>}>
                {billing.length === 0 ? (
                  <Empty>청구 기록이 없습니다. 계약에 청구일을 넣으면 자동으로 생깁니다.</Empty>
                ) : (
                  <table className="w-full text-[14px]">
                    <thead>
                      <tr className="text-[12px] text-[#6f6f6a] border-b border-[#d1d1cc]">
                        <th className="text-left font-medium py-2 px-4">계약</th>
                        <th className="text-right font-medium py-2 px-2">청구액</th>
                        <th className="text-right font-medium py-2 px-2">입금</th>
                        <th className="text-left font-medium py-2 px-2">청구일 / 입금 예정</th>
                        <th className="text-right font-medium py-2 px-4">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billing.map((b, i) => {
                        const paid = b.receipts.reduce((s, r) => s + r.amountKrw, 0)
                        const s = billStates[i]
                        return (
                          <tr key={b.id} className="border-b border-[#f2f2ef] last:border-0 align-top">
                            <td className="py-2 px-4">
                              {b.contract.planName}
                              {b.receipts.length > 0 && (
                                <ul className="mt-1 text-[12px] text-[#6f6f6a] tabular-nums">
                                  {b.receipts.map((r) => (
                                    <li key={r.id}>
                                      {ymd(r.receivedOn).slice(5).replace("-", ".")} 입금 {r.amountKrw.toLocaleString("ko-KR")}원{r.memo ? ` · ${r.memo}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">{b.amountDueKrw.toLocaleString("ko-KR")}원</td>
                            <td className="py-2 px-2 text-right tabular-nums">{paid.toLocaleString("ko-KR")}원</td>
                            <td className="py-2 px-2 text-[13px] tabular-nums text-[#555555]">
                              {ymd(b.plannedBillOn).slice(5).replace("-", ".")} / {ymd(b.dueOn).slice(5).replace("-", ".")}
                            </td>
                            <td className={`py-2 px-4 text-right text-[13px] ${s === "OVERDUE" ? "text-[#d92d20] font-semibold" : s === "PAID" ? "text-[#1a7f37]" : "text-[#6f6f6a]"}`}>{BILLING_STATE_LABEL[s]}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </Card>
              <Card title="계약" desc="이 달에 걸친 진행 중 계약" action={<Link prefetch={false} className="text-[13px] text-[#0062ff] hover:underline" href="/work/contracts">계약 관리</Link>}>
                {contracts.length === 0 ? (
                  <Empty>진행 중 계약이 없습니다.</Empty>
                ) : (
                  <ul className="divide-y divide-[#f2f2ef]">
                    {contracts.map((c) => (
                      <li key={c.id} className="px-4 py-2 flex flex-wrap gap-x-4 text-[14px]">
                        <span className="font-medium flex-1">{c.planName}</span>
                        <span className="tabular-nums">월 {c.monthlyFeeKrw.toLocaleString("ko-KR")}원</span>
                        <span className="text-[12px] text-[#6f6f6a]">{VAT_LABEL[c.vatTreatment] ?? c.vatTreatment}</span>
                        <span className="text-[12px] text-[#6f6f6a] tabular-nums">
                          {ymd(c.startsOn)} ~ {c.endsOn ? ymd(c.endsOn) : "종료일 없음"}
                          {c.billDayOfMonth ? ` · 청구 ${c.billDayOfMonth}일` : ""}
                          {c.paymentDueDay ? ` · 입금 ${c.paymentDueDay}일` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
            <FinanceReview clinicId={clinicId} month={month} opsClosed={opsClosed} financeAt={closeInfo?.financeAt ?? null} financeBy={closeInfo?.financeBy ?? null} billStates={billStates.map((s) => BILLING_STATE_LABEL[s])} allPaid={billStates.length > 0 && billStates.every((s) => s === "PAID" || s === "VOID")} />
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, sub, warn, amber }: { label: string; value: string; sub: string; warn?: boolean; amber?: boolean }) {
  return (
    <div className="px-4 py-2.5">
      <div className="text-[12px] text-[#6f6f6a]">{label}</div>
      <div className={`text-[20px] font-bold tabular-nums leading-tight ${amber ? "text-[#b54708]" : ""}`}>{value}</div>
      <div className={`text-[12px] ${warn ? "text-[#d92d20]" : "text-[#8a8a84]"}`}>{sub}</div>
    </div>
  )
}

function Card({ title, desc, action, children }: { title: string; desc?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded border border-[#d1d1cc]">
      <div className="flex items-baseline gap-2 px-4 py-2.5 border-b border-[#f2f2ef]">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {desc && <span className="text-[12px] text-[#8a8a84]">{desc}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-4 text-[13px] text-[#6f6f6a]">{children}</p>
}

function TaskLine({ t, today, late }: { t: { id: string; title: string; status: string; dueOn: Date | null; group: { name: string } | null; assignee: { user: { name: string } } | null }; today: string; late: boolean }) {
  return (
    <li className="px-4 py-2 flex gap-3 text-[14px]">
      <Link prefetch={false} href={`/work/tasks?open=${t.id}`} className="flex-1 truncate hover:underline">
        {t.title}
        {t.group && <span className="ml-2 text-[12px] text-[#8a8a84]">{t.group.name}</span>}
      </Link>
      <span className="text-[12px] text-[#6f6f6a] w-[56px] truncate">{t.assignee?.user.name ?? "미배정"}</span>
      <span className={`text-[12px] w-[70px] text-right tabular-nums ${late ? "text-[#d92d20] font-semibold" : "text-[#555555]"}`}>{t.dueOn ? (late ? `${lateDays(ymd(t.dueOn), today)}일 지연` : dayLabel(ymd(t.dueOn), today)) : "기한 없음"}</span>
      <span className={`text-[12px] w-[52px] text-right ${t.status === "BLOCKED" ? "text-[#b54708]" : "text-[#6f6f6a]"}`}>{TASK_STATUS_LABEL[t.status as keyof typeof TASK_STATUS_LABEL]}</span>
    </li>
  )
}
