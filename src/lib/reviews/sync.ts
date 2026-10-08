import { prisma } from "@/lib/db"
import { fetchNaverPlaceReviews, resolveNaverPlaceId } from "./naver"
import { analyzeReviews } from "./analyze"

export interface NaverSyncResult {
  clinicId: string
  placeName: string | null
  visitorTotal: number
  newReviews: number
  repliesUpdated: number
  analyzed: number
  error?: string
}

const KST = 9 * 3600 * 1000

// KST 기준 해당 월 1일 0시의 UTC 시각
function kstMonthStart(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1) - KST)
}

export async function syncNaverConfig(configId: string): Promise<NaverSyncResult> {
  const config = await prisma.reviewConfig.findUniqueOrThrow({
    where: { id: configId },
    include: { clinic: { select: { name: true } } },
  })

  let placeId = config.placeId
  if (!placeId && config.placeUrl) {
    placeId = await resolveNaverPlaceId(config.placeUrl)
    if (placeId) await prisma.reviewConfig.update({ where: { id: config.id }, data: { placeId } })
  }
  if (!placeId) throw new Error("네이버 플레이스 ID를 찾을 수 없습니다. 플레이스 주소를 다시 등록해 주세요")

  const place = await fetchNaverPlaceReviews(placeId)
  const now = new Date()

  // 1) 리뷰 저장 — 새 리뷰는 추가, 기존 리뷰는 치과 답글이 달렸는지만 갱신
  const existing = await prisma.review.findMany({
    where: { configId: config.id, reviewId: { in: place.reviews.map((r) => r.id) } },
    select: { id: true, reviewId: true, reply: true },
  })
  const byReviewId = new Map(existing.map((r) => [r.reviewId, r]))
  let newReviews = 0
  let repliesUpdated = 0
  for (const r of place.reviews) {
    const prev = byReviewId.get(r.id)
    if (!prev) {
      await prisma.review.create({
        data: {
          clinicId: config.clinicId,
          configId: config.id,
          source: "NAVER",
          reviewId: r.id,
          authorName: r.authorName,
          content: r.body,
          reviewDate: r.createdAt,
          originType: r.originType,
          reply: r.replyBody,
          replyDate: r.replyAt,
        },
      })
      newReviews++
    } else if (r.replyBody && r.replyBody !== prev.reply) {
      await prisma.review.update({ where: { id: prev.id }, data: { reply: r.replyBody, replyDate: r.replyAt } })
      repliesUpdated++
    }
  }

  // 2) 전체 리뷰 수 스냅샷
  await prisma.reviewSnapshot.create({
    data: { configId: config.id, visitorTotal: place.visitorTotal, blogTotal: place.blogTotal, takenAt: now },
  })

  // 3) 아직 분석 안 된 리뷰를 Claude 로 분류 + 답글 초안 (실패해도 수집은 성공으로 둔다)
  let analyzed = 0
  try {
    const pending = await prisma.review.findMany({
      where: { configId: config.id, analyzedAt: null, content: { not: "" } },
      orderBy: { reviewDate: "desc" },
      take: 30,
      select: { id: true, content: true, reply: true },
    })
    const results = await analyzeReviews(
      config.clinic.name,
      pending.map((p) => ({ id: p.id, body: p.content || "", hasReply: !!p.reply })),
    )
    for (const [id, a] of results) {
      await prisma.review.update({
        where: { id },
        data: {
          isPositive: a.sentiment === "positive" ? true : a.sentiment === "negative" ? false : null,
          keywords: { sentiment: a.sentiment, topics: a.topics, issue: a.issue },
          replyDraft: a.replyDraft,
          analyzedAt: now,
        },
      })
      analyzed++
    }
  } catch (e) {
    console.error("[reviews] Claude 분석 실패:", e)
  }

  // 4) 월별 요약 — 지난달·이번달 신규 리뷰 수 = 월말(또는 지금) 총계 - 전월말 총계
  const kstNow = new Date(now.getTime() + KST)
  const thisYear = kstNow.getUTCFullYear()
  const thisMonth = kstNow.getUTCMonth() + 1
  const prev = thisMonth === 1 ? { year: thisYear - 1, month: 12 } : { year: thisYear, month: thisMonth - 1 }
  for (const ym of [prev, { year: thisYear, month: thisMonth }]) {
    await updateNaverMonth(config.id, config.clinicId, ym.year, ym.month)
  }

  await prisma.reviewConfig.update({
    where: { id: config.id },
    data: { lastSyncAt: now, ...(place.name && !config.placeName ? { placeName: place.name } : {}) },
  })

  return { clinicId: config.clinicId, placeName: place.name, visitorTotal: place.visitorTotal, newReviews, repliesUpdated, analyzed }
}

async function updateNaverMonth(configId: string, clinicId: string, year: number, month: number) {
  const start = kstMonthStart(year, month)
  const end = month === 12 ? kstMonthStart(year + 1, 1) : kstMonthStart(year, month + 1)

  const [baseline, last] = await Promise.all([
    prisma.reviewSnapshot.findFirst({ where: { configId, takenAt: { lt: start } }, orderBy: { takenAt: "desc" } }),
    prisma.reviewSnapshot.findFirst({ where: { configId, takenAt: { gte: start, lt: end } }, orderBy: { takenAt: "desc" } }),
  ])
  // 월이 시작되기 전 스냅샷이 없으면(수집을 시작한 첫 달) 신규 수를 정확히 알 수 없으니 수동 입력값을 건드리지 않는다
  if (!baseline || !last) return

  const newReviews = Math.max(0, last.visitorTotal - baseline.visitorTotal)
  const monthReviews = await prisma.review.findMany({
    where: { configId, reviewDate: { gte: start, lt: end } },
    select: { isPositive: true, reply: true },
  })
  const positiveCount = monthReviews.filter((r) => r.isPositive === true).length
  const negativeCount = monthReviews.filter((r) => r.isPositive === false).length
  const replyRate = monthReviews.length ? (monthReviews.filter((r) => r.reply).length / monthReviews.length) * 100 : null

  const existing = await prisma.reviewSummary.findUnique({
    where: { clinicId_source_year_month: { clinicId, source: "NAVER", year, month } },
    select: { targetReviews: true },
  })
  const target = existing?.targetReviews
  const achievementRate = target && target > 0 ? (newReviews / target) * 100 : null

  await prisma.reviewSummary.upsert({
    where: { clinicId_source_year_month: { clinicId, source: "NAVER", year, month } },
    create: { clinicId, source: "NAVER", year, month, totalReviews: last.visitorTotal, newReviews, positiveCount, negativeCount, replyRate },
    update: { totalReviews: last.visitorTotal, newReviews, positiveCount, negativeCount, replyRate, achievementRate },
  })
}
