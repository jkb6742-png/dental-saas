import { prisma } from "@/lib/db"

// 앱 내 알림 (헤더 종 아이콘). 수신자별로 한 행씩 저장한다.
// audience
//  - masters: MASTER 전원
//  - clinic : 해당 치과 소속 계정(원장·직원) 전원
//  - all    : 둘 다

export type NotificationType = "NAVER_BIZMONEY" | "NAVER_SYNC_FAIL" | "NAVER_REPORT" | "REQUEST_NEW" | "REQUEST_STATUS" | "REQUEST_COMMENT" | "SITE_LEAD_NEW" | "SYSTEM"

export async function recipientIds(opts: { clinicId?: string | null; audience: "masters" | "clinic" | "all"; exclude?: string[] }) {
  const ids = new Set<string>()
  if (opts.audience === "masters" || opts.audience === "all") {
    const ms = await prisma.user.findMany({ where: { role: "MASTER" }, select: { id: true } })
    ms.forEach((u) => ids.add(u.id))
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
  userIds?: string[] // 직접 지정 시 audience 무시
}) {
  const userIds = opts.userIds ?? (await recipientIds({ clinicId: opts.clinicId, audience: opts.audience, exclude: opts.exclude }))
  if (!userIds.length) return 0
  const r = await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, clinicId: opts.clinicId ?? null, type: opts.type, title: opts.title.slice(0, 200), body: opts.body?.slice(0, 1000) ?? null, link: opts.link ?? null })),
  })
  return r.count
}

export async function listNotifications(userId: string, limit = 30) {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])
  return {
    unread,
    items: rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, clinicId: n.clinicId, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() })),
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
