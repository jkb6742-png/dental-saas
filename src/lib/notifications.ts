import { prisma } from "@/lib/db"
import { priorityOf, emailNow, actionWhere } from "@/lib/work/notify/priority"

// 앱 내 알림 (헤더 종 아이콘). 수신자별로 한 행씩 저장한다.
// audience
//  - masters: MASTER 전원 + 그 치과 담당 직원
//  - clinic : 해당 치과 소속 계정(원장·직원) 전원
//  - all    : 둘 다

export type NotificationType =
  | "NAVER_BIZMONEY"
  | "NAVER_SYNC_FAIL"
  | "NAVER_REPORT"
  | "REQUEST_NEW"
  | "REQUEST_STATUS"
  | "REQUEST_COMMENT"
  | "SITE_LEAD_NEW"
  | "TASK_ASSIGNED"
  | "TASK_COMMENT"
  | "TASK_REVIEW"
  | "EVENT_INVITE"
  | "FILE_SHARED"
  | "LEAVE_REQUESTED"
  | "LEAVE_DECIDED"
  | "BILLING_DUE"
  | "CONTENT_PUBLISHED"
  | "MONTH_CLOSE"
  | "CHAT_MENTION"
  | "DAILY_SUMMARY"
  | "SYSTEM"

// 메일 정책은 등급으로 정한다(src/lib/work/notify/priority.ts): P0만 즉시 메일, P1은 하루 요약, P2·P3는 메일 없음.
// 직원(MASTER·STAFF)에게만 보낸다. 원장 메일은 기존 기능(검색광고·문의)이 따로 보낸다.
// 호출하는 쪽에서 email: true 를 주면 등급과 무관하게 메일 대기열에 넣는다(하루 요약 등).

/** 같은 업무 댓글을 묶는 시간(분) */
const COMMENT_GROUP_MIN = 30

export async function recipientIds(opts: { clinicId?: string | null; audience: "masters" | "clinic" | "all"; exclude?: string[] }) {
  const ids = new Set<string>()
  if (opts.audience === "masters" || opts.audience === "all") {
    const ms = await prisma.user.findMany({ where: { role: "MASTER" }, select: { id: true } })
    ms.forEach((u) => ids.add(u.id))
    // THINKLAB 쪽 알림은 그 치과 담당 직원(재직 중)에게도 간다
    if (opts.clinicId) {
      const staff = await prisma.staffClinicAccess.findMany({
        where: {
          clinicId: opts.clinicId,
          employee: { OR: [{ leftOn: null }, { leftOn: { gt: new Date() } }], user: { status: "APPROVED" } },
        },
        select: { employeeUserId: true },
      })
      staff.forEach((s) => ids.add(s.employeeUserId))
    }
  }
  if ((opts.audience === "clinic" || opts.audience === "all") && opts.clinicId) {
    const us = await prisma.user.findMany({ where: { clinicId: opts.clinicId, role: { not: "MASTER" } }, select: { id: true } })
    us.forEach((u) => ids.add(u.id))
  }
  for (const e of opts.exclude ?? []) ids.delete(e)
  return Array.from(ids)
}

export async function createNotifications(opts: {
  type: NotificationType
  title: string
  body?: string
  link?: string
  clinicId?: string | null
  audience: "masters" | "clinic" | "all"
  exclude?: string[] // 행위자 본인 제외
  /** 행위자. exclude 에 더해 본인에게는 가지 않는다 */
  actorId?: string | null
  userIds?: string[] // 직접 지정 시 audience 무시
  /** 같은 사건 중복 방지 키. 받는 사람마다 `${dedupKey}:${userId}` 로 한 번만 만든다. */
  dedupKey?: string
  /** 묶음 단위(하루 요약 메일용) */
  groupKey?: string
  /** false 면 이메일 큐에 넣지 않는다, true 면 등급과 무관하게 넣는다. 없으면 등급(P0만 즉시) */
  email?: boolean
}) {
  const exclude = [...(opts.exclude ?? []), ...(opts.actorId ? [opts.actorId] : [])]
  let userIds = opts.userIds ?? (await recipientIds({ clinicId: opts.clinicId, audience: opts.audience, exclude }))
  if (opts.userIds && exclude.length) userIds = userIds.filter((u) => !exclude.includes(u))
  userIds = Array.from(new Set(userIds))
  if (!userIds.length) return 0

  // 업무 댓글: 같은 업무(링크)의 안 읽은 댓글 알림이 30분 안에 있으면 새 행 대신 그 행을 고친다
  if (opts.type === "TASK_COMMENT" && opts.link && !opts.dedupKey) {
    userIds = await mergeComments(userIds, opts)
    if (!userIds.length) return 0
  }
  const rows = userIds.map((userId) => ({
    userId,
    clinicId: opts.clinicId ?? null,
    type: opts.type,
    title: opts.title.slice(0, 200),
    body: opts.body?.slice(0, 1000) ?? null,
    link: opts.link ?? null,
    dedupKey: opts.dedupKey ? `${opts.dedupKey}:${userId}`.slice(0, 300) : null,
    groupKey: opts.type === "TASK_COMMENT" && opts.link && !opts.dedupKey ? commentGroupKey(opts.link, 1) : (opts.groupKey ?? null),
  }))
  const r = await prisma.notification.createMany({ data: rows, skipDuplicates: true })

  // 이메일 큐: 직원 대상·메일 종류만. 실제 발송은 알림 작업기가 조용한 시간을 피해서 한다.
  const wantEmail = opts.email ?? emailNow(priorityOf(opts.type, opts.title))
  if (wantEmail && r.count > 0) {
    try {
      await enqueueEmail(userIds, opts)
    } catch (e) {
      console.error("[notifications] 메일 대기열 등록 실패", (e as Error).message)
    }
  }
  return r.count
}

const commentGroupKey = (link: string, n: number) => `cmt|${link}|${n}`.slice(0, 300)
const commentTitle = (title: string, n: number) => {
  const m = title.match(/^업무 댓글 · (.*)$/)
  return (m ? `새 댓글 ${n}개 · ${m[1]}` : `${title} · 새 댓글 ${n}개`).slice(0, 200)
}

/** 묶을 수 있는 사람은 기존 행을 고치고, 새 행이 필요한 사람만 돌려준다 */
async function mergeComments(userIds: string[], opts: { title: string; body?: string; link?: string }) {
  const link = opts.link!
  const prefix = `cmt|${link}|`.slice(0, 300)
  const open = await prisma.notification.findMany({
    where: {
      userId: { in: userIds },
      type: "TASK_COMMENT",
      readAt: null,
      createdAt: { gte: new Date(Date.now() - COMMENT_GROUP_MIN * 60_000) },
      OR: [{ groupKey: { startsWith: prefix } }, { link, groupKey: null }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true, groupKey: true },
  })
  const merged = new Set<string>()
  for (const n of open) {
    if (merged.has(n.userId)) continue
    merged.add(n.userId)
    const prev = n.groupKey?.startsWith(prefix) ? Number(n.groupKey.slice(prefix.length)) || 1 : 1
    const count = prev + 1
    await prisma.notification.update({
      where: { id: n.id },
      data: { title: commentTitle(opts.title, count), body: opts.body?.slice(0, 1000) ?? null, groupKey: commentGroupKey(link, count), createdAt: new Date() },
    })
  }
  return userIds.filter((u) => !merged.has(u))
}

async function enqueueEmail(userIds: string[], opts: { type: string; title: string; dedupKey?: string }) {
  const internal = await prisma.user.findMany({
    where: { id: { in: userIds }, role: { in: ["MASTER", "STAFF"] }, status: "APPROVED" },
    select: { id: true, notificationPreference: { select: { emailEnabled: true } } },
  })
  const targets = internal.filter((u) => u.notificationPreference?.emailEnabled !== false).map((u) => u.id)
  if (!targets.length) return
  // 방금 만든 알림 행 찾기(중복 키 있으면 그 키로, 없으면 최근 1분 같은 제목)
  const created = await prisma.notification.findMany({
    where: opts.dedupKey
      ? { dedupKey: { in: targets.map((u) => `${opts.dedupKey}:${u}`.slice(0, 300)) } }
      : { userId: { in: targets }, type: opts.type, title: opts.title.slice(0, 200), createdAt: { gte: new Date(Date.now() - 60_000) }, deliveries: { none: {} } },
    select: { id: true },
  })
  if (!created.length) return
  await prisma.notificationDelivery.createMany({
    data: created.map((n) => ({ notificationId: n.id, channel: "EMAIL" as const, dedupKey: `${n.id}:email` })),
    skipDuplicates: true,
  })
}

export type NotificationFilter = "all" | "action" | "unread"

export async function listNotifications(userId: string, limit = 30, opts: { filter?: NotificationFilter; page?: number } = {}) {
  const filter = opts.filter ?? "all"
  const page = Math.max(1, opts.page ?? 1)
  const where =
    filter === "unread" ? { userId, readAt: null } : filter === "action" ? { userId, readAt: null, ...actionWhere() } : { userId }
  const [rows, unread, action, total] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: (page - 1) * limit }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.count({ where: { userId, readAt: null, ...actionWhere() } }),
    prisma.notification.count({ where }),
  ])
  const clinicIds = Array.from(new Set(rows.map((n) => n.clinicId).filter((x): x is string => !!x)))
  const clinics = clinicIds.length ? await prisma.clinic.findMany({ where: { id: { in: clinicIds } }, select: { id: true, name: true } }) : []
  const cname = new Map(clinics.map((c) => [c.id, c.name]))
  return {
    unread,
    action,
    total,
    page,
    pageSize: limit,
    items: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      clinicId: n.clinicId,
      clinicName: n.clinicId ? (cname.get(n.clinicId) ?? null) : null,
      priority: priorityOf(n.type, n.title),
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  }
}

export async function markRead(userId: string, ids?: string[]) {
  const r = await prisma.notification.updateMany({ where: { userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } })
  return r.count
}

/** 90일 지난 알림 정리(스케줄러에서 가끔 호출) */
export async function pruneNotifications(days = 90) {
  const r = await prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * 86400000) } } })
  return r.count
}
