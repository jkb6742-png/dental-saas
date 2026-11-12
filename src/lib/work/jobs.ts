import { prisma } from "@/lib/db"
import { isMailConfigured, sendMail } from "@/lib/mail"
import { createNotifications } from "@/lib/notifications"
import { runBillingAlerts, ensureBillingCycles } from "./billing"
import { purgeDeletedFiles } from "./files"
import { ensureGrants } from "./leave"
import { kstToday, dateOnly, KST_MS, shiftMonth } from "./common"
import { runDailySummaries, runP0Resend } from "./notify/daily"

// 직원 앱 예약 작업. 1분마다 메일 대기열, 10분마다 결제일 알림·긴급(P0) 재알림, 매일 아침 마감 알림·연차 발생·파일 정리, 평일 09:10 하루 요약.
// 끄려면 WORK_JOBS=off

const BASE_URL = () => (process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://thinklabinsight.com").replace(/\/$/, "")
const kstMinute = (d = new Date()) => {
  const k = new Date(d.getTime() + KST_MS)
  return k.getUTCHours() * 60 + k.getUTCMinutes()
}
export function inQuiet(start: number, end: number, minute = kstMinute()) {
  if (start === end) return false
  return start > end ? minute >= start || minute < end : minute >= start && minute < end
}
/** 한국 시각 기준 주말(토·일) */
export const isKstWeekend = (d = new Date()) => {
  const w = new Date(d.getTime() + KST_MS).getUTCDay()
  return w === 0 || w === 6
}
/** 조용한 시간이 끝나는 다음 시각(UTC). 주말이면 다음 평일의 끝 시각 */
function quietEndsAt(end: number) {
  const now = new Date()
  const k = new Date(now.getTime() + KST_MS)
  let t = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), Math.floor(end / 60), end % 60) - KST_MS
  if (t <= now.getTime()) t += 86400_000
  while (isKstWeekend(new Date(t))) t += 86400_000
  return new Date(t)
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

/** 메일 대기열 처리: 받는 사람별로 묶어 한 통으로 보낸다. 조용한 시간이면 끝날 때로 미룬다. */
export async function processEmailQueue(limit = 200) {
  const due = await prisma.notificationDelivery.findMany({
    where: { channel: "EMAIL", state: "QUEUED", nextAttemptAt: { lte: new Date() } },
    select: { id: true },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  })
  if (!due.length) return { sent: 0, deferred: 0, skipped: 0 }
  const claimed = await prisma.notificationDelivery.updateMany({ where: { id: { in: due.map((d) => d.id) }, state: "QUEUED" }, data: { state: "PROCESSING" } })
  if (!claimed.count) return { sent: 0, deferred: 0, skipped: 0 }
  const rows = await prisma.notificationDelivery.findMany({
    where: { id: { in: due.map((d) => d.id) }, state: "PROCESSING" },
    include: {
      notification: {
        select: {
          title: true,
          body: true,
          link: true,
          createdAt: true,
          userId: true,
        },
      },
    },
  })
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(rows.map((r) => r.notification.userId))) } },
    select: { id: true, email: true, name: true, status: true, notificationPreference: true },
  })
  let sent = 0,
    deferred = 0,
    skipped = 0
  for (const u of users) {
    const mine = rows.filter((r) => r.notification.userId === u.id)
    const ids = mine.map((r) => r.id)
    const pref = u.notificationPreference
    if (u.status !== "APPROVED" || pref?.emailEnabled === false || !u.email) {
      await prisma.notificationDelivery.updateMany({ where: { id: { in: ids } }, data: { state: "SKIPPED", lastErrorCode: "OPTED_OUT" } })
      skipped += ids.length
      continue
    }
    const qs = pref?.quietStartMinute ?? 1140 // 행이 없으면 19:00(설계 기준). 스키마 기본값은 1200
    const qe = pref?.quietEndMinute ?? 540
    // 조용한 시간(기본 평일 19:00~09:00)과 주말에는 개별 메일을 보내지 않고 끝나는 시각으로 미룬다
    if (inQuiet(qs, qe) || isKstWeekend()) {
      await prisma.notificationDelivery.updateMany({ where: { id: { in: ids } }, data: { state: "QUEUED", nextAttemptAt: quietEndsAt(qe) } })
      deferred += ids.length
      continue
    }
    if (!isMailConfigured()) {
      await prisma.notificationDelivery.updateMany({ where: { id: { in: ids } }, data: { state: "SKIPPED", lastErrorCode: "NO_SMTP" } })
      skipped += ids.length
      continue
    }
    const items = mine.map((r) => ({ ...r.notification, resend: r.dedupKey.endsWith(":re") }))
    const head = (n: (typeof items)[number]) => `${n.resend ? "[다시 알림] " : ""}${n.title}`
    const subject = items.length === 1 ? `[THINKLAB] ${head(items[0])}` : `[THINKLAB] 새 알림 ${items.length}건`
    const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${items
      .map((n) => `<p style="margin:0 0 12px"><b>${esc(head(n))}</b>${n.body ? `<br>${esc(n.body).replace(/\n/g, "<br>")}` : ""}${n.link ? `<br><a href="${BASE_URL()}${esc(n.link)}">열기</a>` : ""}</p>`)
      .join("")}<p style="color:#888;font-size:12px">알림 메일 설정은 업무 화면 &gt; 알림 설정에서 바꿀 수 있습니다.</p></div>`
    try {
      await sendMail({ to: [u.email], subject: subject.slice(0, 180), html })
      await prisma.notificationDelivery.updateMany({ where: { id: { in: ids } }, data: { state: "SENT", sentAt: new Date(), attemptCount: { increment: 1 } } })
      sent += ids.length
    } catch (e) {
      const attempts = Math.max(...mine.map((r) => r.attemptCount)) + 1
      await prisma.notificationDelivery.updateMany({
        where: { id: { in: ids } },
        data: {
          state: attempts >= 5 ? "FAILED" : "QUEUED",
          attemptCount: { increment: 1 },
          nextAttemptAt: new Date(Date.now() + 2 ** attempts * 60_000),
          lastErrorCode: String((e as Error).message ?? "SEND_FAIL").slice(0, 120),
        },
      })
    }
  }
  // 사용자 없는 대기열(삭제된 계정)은 건너뜀 처리
  const orphan = rows.filter((r) => !users.some((u) => u.id === r.notification.userId)).map((r) => r.id)
  if (orphan.length) await prisma.notificationDelivery.updateMany({ where: { id: { in: orphan } }, data: { state: "SKIPPED", lastErrorCode: "NO_USER" } })
  return { sent, deferred, skipped }
}

/** 오늘 마감·마감 지난 업무를 담당자에게 하루 한 번 */
export async function runTaskDueAlerts() {
  const today = kstToday()
  const t = dateOnly(today)
  const tasks = await prisma.task.findMany({
    where: { status: { in: ["TODO", "BLOCKED", "IN_PROGRESS", "IN_REVIEW"] }, assigneeUserId: { not: null }, dueOn: { lte: t } },
    select: { id: true, title: true, dueOn: true, clinicId: true, assigneeUserId: true, clinic: { select: { name: true } } },
    take: 1000,
  })
  let n = 0
  for (const task of tasks) {
    const overdue = task.dueOn!.getTime() < t.getTime()
    n += await createNotifications({
      type: "TASK_ASSIGNED",
      title: `${overdue ? "마감 지남" : "오늘 마감"}: ${task.clinic?.name ?? "사내"} · ${task.title}`,
      link: `/work/tasks?open=${task.id}`,
      clinicId: task.clinicId,
      audience: "masters",
      userIds: [task.assigneeUserId!],
      dedupKey: `due:${task.id}:${today}`,
      groupKey: `due:${today}`,
      email: false, // 아침 요약은 앱 안에서만(메일 폭주 방지)
    })
  }
  return n
}

let running = false
let lastTen = 0
let lastDaily = ""
let lastSummary = ""
export async function runWorkJobs() {
  if (running) return
  running = true
  try {
    await processEmailQueue().catch((e) => console.error("[work] 메일 대기열", e?.message))
    if (Date.now() - lastTen > 10 * 60_000) {
      lastTen = Date.now()
      // 이번 달·다음 달 청구 행을 미리 만든다(청구 화면을 안 열어도 결제일 알림이 나가도록). 중복은 건너뜀.
      const thisMonth = kstToday().slice(0, 7)
      await ensureBillingCycles(thisMonth).catch((e) => console.error("[work] 청구 생성", e?.message))
      await ensureBillingCycles(shiftMonth(thisMonth, 1)).catch((e) => console.error("[work] 청구 생성", e?.message))
      await runBillingAlerts().catch((e) => console.error("[work] 결제일 알림", e?.message))
      await runP0Resend().catch((e) => console.error("[work] 긴급 재알림", e?.message))
    }
    const today = kstToday()
    if (lastDaily !== today && kstMinute() >= 8 * 60 + 30) {
      lastDaily = today
      await runTaskDueAlerts().catch((e) => console.error("[work] 마감 알림", e?.message))
      for (const e of await prisma.employee.findMany({ select: { userId: true } })) await ensureGrants(e.userId).catch(() => {})
      await purgeDeletedFiles().catch(() => 0)
    }
    // 하루 요약: 평일 09:10~12:00 사이 하루 한 번(받는 사람·날짜별 중복 방지 키가 있어 재시작해도 한 번)
    const m = kstMinute()
    if (lastSummary !== today && !isKstWeekend() && m >= 9 * 60 + 10 && m < 12 * 60) {
      lastSummary = today
      await runDailySummaries().catch((e) => console.error("[work] 하루 요약", e?.message))
    }
  } finally {
    running = false
  }
}

export function startWorkScheduler() {
  if (process.env.WORK_JOBS === "off") return
  if ((globalThis as any).__workSchedulerStarted) return
  ;(globalThis as any).__workSchedulerStarted = true
  console.info("[work] 직원 앱 예약 작업 시작 (1분 간격)")
  setInterval(() => runWorkJobs().catch((e) => console.error("[work]", e)), 60_000)
}
