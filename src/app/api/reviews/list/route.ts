import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireClinicAccess } from "@/lib/security"

// GET /api/reviews/list?clinicId=...&filter=all|unreplied|negative
// 수집된 네이버 리뷰 목록 + 플레이스 전체 리뷰 수(최신 스냅샷)
export async function GET(request: Request) {
  const url = new URL(request.url)
  const clinicId = url.searchParams.get("clinicId")
  const filter = url.searchParams.get("filter") || "all"
  if (!clinicId) return NextResponse.json({ error: "Missing clinicId" }, { status: 400 })

  try {
    await requireClinicAccess(clinicId)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }

  const config = await prisma.reviewConfig.findUnique({
    where: { clinicId_source: { clinicId, source: "NAVER" } },
    select: { id: true, placeId: true, placeName: true, placeUrl: true, lastSyncAt: true, isActive: true },
  })
  if (!config) return NextResponse.json({ config: null, snapshot: null, counts: null, reviews: [] })

  const where: any = { configId: config.id }
  if (filter === "unreplied") where.reply = null
  if (filter === "negative") where.isPositive = false

  const [reviews, snapshot, total, unreplied, negative] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: [{ reviewDate: "desc" }, { createdAt: "desc" }],
      take: 50,
      select: {
        id: true, reviewId: true, authorName: true, content: true, reviewDate: true, originType: true,
        reply: true, replyDate: true, isPositive: true, keywords: true, replyDraft: true, analyzedAt: true,
      },
    }),
    prisma.reviewSnapshot.findFirst({ where: { configId: config.id }, orderBy: { takenAt: "desc" } }),
    prisma.review.count({ where: { configId: config.id } }),
    prisma.review.count({ where: { configId: config.id, reply: null } }),
    prisma.review.count({ where: { configId: config.id, isPositive: false } }),
  ])

  return NextResponse.json({
    config,
    snapshot: snapshot && { visitorTotal: snapshot.visitorTotal, blogTotal: snapshot.blogTotal, takenAt: snapshot.takenAt },
    counts: { collected: total, unreplied, negative },
    reviews,
  })
}
