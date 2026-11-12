import { prisma } from "@/lib/db"
import { createNotifications } from "@/lib/notifications"
import { kstToday, dateOnly, KST_MS } from "../common"
import { KEYWORD_RULES, priorityOf } from "./priority"

// 하루 요약(평일 09:10)과 긴급(P0) 재알림. 예약 작업(jobs.ts)에서 부른다.

const OPEN = ["TODO", "BLOCKED", "IN_PROGRESS", "IN_REVIEW"] as const
const DAY = 86400_000
const md = (d: Date) => {
  const w = "일월화수목금토"[d.getUTCDay()]
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()}(${w})`
}

/** 하루 요약 받을 사람: 승인된 대표·재직 직원, 하루 요약 켬 */
async function summaryTargets() {
  const now = new Date()
  const users = await prisma.user.findMany({
    where: {
      status: "APPROVED",
      OR: [{ role: "MASTER" }, { role: "STAFF", employee: { OR: [{ leftOn: null }, { leftOn: { gt: now } }] } }],
    },
    select: {
      id: true,
      role: true,
      notificationPreference: { select: { dailyDigestEnabled: true } },
      employee: { select: { clinicAccess: { select: { clinicId: true } } } },
    },
  })
  return users.filter((u) => u.notificationPreference?.dailyDigestEnabled !== false)
}

/** 한 사람의 요약 내용. 보낼 게 하나도 없으면 null */
export async function buildDailySummary(user: { id: string; role: string; clinicIds: string[] }, today = kstToday()) {
  const t = dateOnly(today)
  const isMaster = user.role === "MASTER"
  const dayStart = new Date(t.getTime() - KST_MS)
  const dayEnd = new Date(dayStart.getTime() + DAY)
  const taskSel = { id: true, title: true, dueOn: true, priority: true, clinic: { select: { name: true } } } as const

  const [dueToday, overdue, review, meetings] = await Promise.all([
    prisma.task.findMany({ where: { assigneeUserId: user.id, status: { in: [...OPEN] }, dueOn: t }, select: taskSel, take: 200 }),
    prisma.task.findMany({ where: { assigneeUserId: user.id, status: { in: [...OPEN] }, dueOn: { lt: t } }, select: taskSel, orderBy: { dueOn: "asc" }, take: 200 }),
    prisma.task.findMany({
      where: {
        status: "IN_REVIEW",
        OR: [{ assigneeUserId: user.id }, { reviewRequired: true, ...(isMaster ? {} : { clinicId: { in: user.clinicIds } }) }],
      },
      select: taskSel,
      take: 200,
    }),
    prisma.calendarEvent.count({
      where: {
        status: { not: "CANCELLED" },
        type: { in: ["CLINIC_MEETING", "SALES_MEETING", "INTERNAL_MEETING"] },
        startAt: { gte: dayStart, lt: dayEnd },
        OR: [{ organizerUserId: user.id }, { participants: { some: { userId: user.id } } }],
      },
    }),
  ])

  const lines = [`오늘 마감 ${dueToday.length} · 지연 ${overdue.length} · 검토 대기 ${review.length} · 오늘 미팅 ${meetings}`]
  let extra = 0
  if (isMaster) {
    const lastMonth = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1))
    const thisMonth = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))
    const [leave, unpaid, contracted, closed] = await Promise.all([
      prisma.leaveRequest.count({ where: { status: "PENDING" } }),
      prisma.billingCycle.count({ where: { dueOn: { lt: t }, voidedAt: null, receipts: { none: {} } } }),
      prisma.clinicContract.findMany({
        where: { status: { in: ["ACTIVE", "ENDED", "TERMINATED"] }, startsOn: { lt: thisMonth }, OR: [{ endsOn: null }, { endsOn: { gte: lastMonth } }] },
        select: { clinicId: true },
        distinct: ["clinicId"],
      }),
      prisma.clinicMonthClose.findMany({ where: { monthStart: lastMonth, operationsClosedAt: { not: null } }, select: { clinicId: true } }),
    ])
    const closedSet = new Set(closed.map((c) => c.clinicId))
    const notClosed = contracted.filter((c) => !closedSet.has(c.clinicId)).length
    lines.push(`연차 승인 대기 ${leave} · 미입금 연체 ${unpaid} · ${lastMonth.getUTCMonth() + 1}월 마감 안 된 치과 ${notClosed}`)
    extra = leave + unpaid + notClosed
  }
  if (!dueToday.length && !overdue.length && !review.length && !meetings && !extra) return null

  // 우선 확인 3건: 지연(오래된 순) → 오늘 마감(중요도 높은 순) → 검토 대기
  const rank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as Record<string, number>
  const top: string[] = []
  const name = (x: { clinic: { name: string } | null; title: string }) => `${x.clinic?.name ?? "사내"} · ${x.title}`
  for (const x of overdue) {
    if (top.length >= 3) break
    const days = Math.round((t.getTime() - x.dueOn!.getTime()) / DAY)
    top.push(`${days}일 지연 · ${name(x)}`)
  }
  for (const x of [...dueToday].sort((a, b) => (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2))) {
    if (top.length >= 3) break
    top.push(`오늘 마감 · ${name(x)}`)
  }
  const seen = new Set([...overdue, ...dueToday].map((x) => x.id))
  for (const x of review) {
    if (top.length >= 3) break
    if (!seen.has(x.id)) top.push(`검토 대기 · ${name(x)}`)
  }
  if (top.length) lines.push("", "우선 확인", ...top.map((s) => `- ${s}`))

  return { title: `하루 요약 ${md(t)}: 마감 ${dueToday.length} · 지연 ${overdue.length} · 검토 ${review.length}`, body: lines.join("\n") }
}

/** 평일 아침 하루 요약: 앱 알림 + 메일(메일 받기 켠 사람) */
export async function runDailySummaries(today = kstToday()) {
  let n = 0
  for (const u of await summaryTargets()) {
    const s = await buildDailySummary({ id: u.id, role: u.role, clinicIds: u.employee?.clinicAccess.map((a) => a.clinicId) ?? [] }, today).catch((e) => {
      console.error("[work] 하루 요약 만들기 실패", u.id, (e as Error).message)
      return null
    })
    if (!s) continue
    n += await createNotifications({
      type: "DAILY_SUMMARY",
      title: s.title,
      body: s.body,
      link: "/work/today",
      audience: "masters",
      userIds: [u.id],
      dedupKey: `daily:${u.id}:${today}`,
      groupKey: `daily:${today}`,
      email: true,
    })
  }
  return n
}

/** 근무 시간(평일 quietEnd~quietStart, 기본 09:00~19:00) 기준 경과 분 */
export function workingMinutesBetween(from: Date, to: Date, startMin = 540, endMin = 1140) {
  let mins = 0
  const step = 5
  for (let t = from.getTime(); t < to.getTime(); t += step * 60_000) {
    const k = new Date(t + KST_MS)
    const w = k.getUTCDay()
    if (w === 0 || w === 6) continue
    const m = k.getUTCHours() * 60 + k.getUTCMinutes()
    const inWork = startMin < endMin ? m >= startMin && m < endMin : m >= startMin || m < endMin
    if (inWork) mins += step
  }
  return mins
}

/** 긴급(P0) 알림을 메일로 보냈는데 근무 2시간이 지나도 안 읽었으면 한 번 더 보낸다 */
export async function runP0Resend() {
  const p0 = KEYWORD_RULES.filter((r) => r.p === 0)
  const rows = await prisma.notification.findMany({
    where: {
      readAt: null,
      createdAt: { gte: new Date(Date.now() - 7 * DAY), lte: new Date(Date.now() - 2 * 3600_000) },
      OR: p0.map((r) => ({ type: r.type, title: { contains: r.kw } })),
      deliveries: { some: { channel: "EMAIL", state: "SENT" }, none: { dedupKey: { endsWith: ":re" } } },
    },
    select: { id: true, type: true, title: true, createdAt: true, deliveries: { where: { channel: "EMAIL", state: "SENT" }, select: { sentAt: true } }, userId: true },
    take: 500,
  })
  if (!rows.length) return 0
  const prefs = await prisma.notificationPreference.findMany({ where: { userId: { in: Array.from(new Set(rows.map((r) => r.userId))) } } })
  const pmap = new Map(prefs.map((p) => [p.userId, p]))
  const now = new Date()
  const due = rows.filter((r) => {
    if (priorityOf(r.type, r.title) !== 0) return false
    const p = pmap.get(r.userId)
    if (p?.emailEnabled === false) return false
    const sentAt = r.deliveries.map((d) => d.sentAt).filter((x): x is Date => !!x).sort((a, b) => a.getTime() - b.getTime())[0] ?? r.createdAt
    return workingMinutesBetween(sentAt, now, p?.quietEndMinute ?? 540, p?.quietStartMinute ?? 1140) >= 120
  })
  if (!due.length) return 0
  const r = await prisma.notificationDelivery.createMany({
    data: due.map((n) => ({ notificationId: n.id, channel: "EMAIL" as const, dedupKey: `${n.id}:email:re` })),
    skipDuplicates: true,
  })
  return r.count
}

