import { createHash } from "crypto"
import type { ContentKind, ContentSource, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { dateOnly, isMonth, KST_MS } from "./common"

// 블로그·칼럼 발행 기록. 같은 치과에서 같은 주소는 한 번만 센다.

export const CONTENT_KIND_LABEL: Record<ContentKind, string> = { BLOG: "블로그", COLUMN: "홈페이지 칼럼" }
export const CONTENT_SOURCE_LABEL: Record<ContentSource, string> = { MANUAL: "직접 입력", BOKBOK: "bokbok", WEBSITE: "홈페이지" }

/** 주소 정규화: 앞뒤 공백·추적 꼬리표·끝 슬래시·호스트 대소문자 차이를 없앤다. */
export function normalizeUrl(raw: string) {
  const u = new URL(raw.trim())
  if (!/^https?:$/.test(u.protocol)) throw new Error("http·https 주소만 됩니다")
  u.hash = ""
  for (const k of Array.from(u.searchParams.keys())) if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k)
  u.hostname = u.hostname.toLowerCase().replace(/^m\.blog\.naver\.com$/, "blog.naver.com")
  let s = u.toString()
  if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1)
  return s
}
export const urlHash = (url: string) => createHash("sha256").update(url).digest("hex")

/** 발행 시각의 한국 기준 달 */
export const kstMonthOf = (d: Date) => new Date(d.getTime() + KST_MS).toISOString().slice(0, 7)

export type ContentInput = {
  clinicId: string
  kind: ContentKind
  source: ContentSource
  title: string
  url: string
  publishedAt: Date
  serviceMonth?: string | null
  primaryKeyword?: string | null
  keywords?: string[]
  externalPostId?: string | null
  taskId?: string | null
  authorUserId?: string | null
  authorNameSnapshot?: string | null
  verified?: { byUserId: string } | null
  lastSourceEventId?: string | null
}

export function contentData(i: ContentInput) {
  const url = normalizeUrl(i.url)
  const month = i.serviceMonth && isMonth(i.serviceMonth) ? i.serviceMonth : kstMonthOf(i.publishedAt)
  return {
    clinicId: i.clinicId,
    kind: i.kind,
    source: i.source,
    title: i.title.slice(0, 300),
    url,
    urlSha256: urlHash(url),
    publishedAt: i.publishedAt,
    serviceMonth: dateOnly(`${month}-01`),
    primaryKeyword: i.primaryKeyword?.slice(0, 100) ?? null,
    keywords: (i.keywords ?? []).map((k) => String(k).slice(0, 60)).slice(0, 20),
    externalPostId: i.externalPostId?.slice(0, 120) ?? null,
    taskId: i.taskId ?? null,
    authorUserId: i.authorUserId ?? null,
    authorNameSnapshot: i.authorNameSnapshot?.slice(0, 60) ?? null,
    verification: i.verified ? ("VERIFIED" as const) : ("PENDING" as const),
    verifiedByUserId: i.verified?.byUserId ?? null,
    verifiedAt: i.verified ? new Date() : null,
    lastSourceEventId: i.lastSourceEventId ?? null,
  } satisfies Prisma.PublishedContentUncheckedCreateInput
}

/** 업무에 발행 결과를 반영: 결과 링크·실적 인정 시각 */
export async function markTaskFulfilled(taskId: string, clinicId: string, url: string, at: Date) {
  await prisma.task.updateMany({ where: { id: taskId, clinicId }, data: { resultUrl: url.slice(0, 1000), fulfilledAt: at } })
}

export const contentSelect = {
  id: true,
  clinicId: true,
  taskId: true,
  kind: true,
  source: true,
  title: true,
  url: true,
  publishedAt: true,
  serviceMonth: true,
  primaryKeyword: true,
  verification: true,
  unpublishedAt: true,
  authorNameSnapshot: true,
  receivedAt: true,
  clinic: { select: { name: true } },
  author: { select: { name: true } },
  task: { select: { title: true } },
} satisfies Prisma.PublishedContentSelect

/** 계약 실적으로 세는 발행물 조건 (내린 글·반려 제외) */
export const countableContent = { unpublishedAt: null, verification: { not: "REJECTED" as const } }
