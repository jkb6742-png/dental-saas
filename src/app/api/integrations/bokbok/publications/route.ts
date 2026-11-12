import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { contentData, contentSelect, normalizeUrl, urlHash } from "@/lib/work/content"
import { createNotifications } from "@/lib/notifications"

// bokbok 발행 알림 받기. 로그인 없이 들어오므로 공유 비밀값 서명으로만 받는다.
//   헤더 x-bokbok-timestamp: 유닉스 초, x-bokbok-signature: sha256=<hex(HMAC(secret, `${timestamp}.${본문}`))>
//   본문 { eventId, event: "published"|"unpublished", clinicId, kind: "BLOG"|"COLUMN", postId, title, url, publishedAt, serviceMonth?, keywords? }
// 같은 eventId 를 다시 보내도 결과는 같다(같은 글은 갱신).

const MAX_SKEW_SEC = 300

function verify(raw: string, ts: string | null, sig: string | null) {
  const secret = process.env.BOKBOK_WEBHOOK_SECRET
  if (!secret || secret.length < 16 || !ts || !sig) return false
  const t = Number(ts)
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > MAX_SKEW_SEC) return false
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")}`)
  const got = Buffer.from(sig)
  return got.length === expected.length && timingSafeEqual(got, expected)
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  if (raw.length > 100_000) return NextResponse.json({ error: "too large" }, { status: 413 })
  if (!verify(raw, req.headers.get("x-bokbok-timestamp"), req.headers.get("x-bokbok-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 })
  }
  let b: any
  try {
    b = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const clinic = await prisma.clinic.findUnique({ where: { id: String(b.clinicId ?? "") }, select: { id: true, name: true } })
  if (!clinic) return NextResponse.json({ error: "unknown clinic" }, { status: 404 })
  const postId = String(b.postId ?? "").slice(0, 120)
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 })
  const eventId = String(b.eventId ?? "").slice(0, 120) || null

  const existing = await prisma.publishedContent.findUnique({
    where: { source_clinicId_externalPostId: { source: "BOKBOK", clinicId: clinic.id, externalPostId: postId } },
    select: { id: true, lastSourceEventId: true },
  })
  if (existing && eventId && existing.lastSourceEventId === eventId) return NextResponse.json({ ok: true, id: existing.id, duplicate: true })

  if (b.event === "unpublished") {
    if (!existing) return NextResponse.json({ ok: true, ignored: true })
    await prisma.publishedContent.update({ where: { id: existing.id }, data: { unpublishedAt: new Date(), lastSourceEventId: eventId } })
    return NextResponse.json({ ok: true, id: existing.id })
  }

  const publishedAt = new Date(b.publishedAt ?? Date.now())
  if (isNaN(publishedAt.getTime())) return NextResponse.json({ error: "publishedAt invalid" }, { status: 400 })
  let data
  try {
    data = contentData({
      clinicId: clinic.id,
      kind: b.kind === "COLUMN" ? "COLUMN" : "BLOG",
      source: "BOKBOK",
      title: String(b.title ?? "").trim() || "(제목 없음)",
      url: String(b.url ?? ""),
      publishedAt,
      serviceMonth: b.serviceMonth,
      keywords: Array.isArray(b.keywords) ? b.keywords : [],
      primaryKeyword: Array.isArray(b.keywords) && b.keywords[0] ? String(b.keywords[0]) : null,
      externalPostId: postId,
      authorNameSnapshot: b.author ? String(b.author) : null,
      lastSourceEventId: eventId,
    })
  } catch {
    return NextResponse.json({ error: "url invalid" }, { status: 400 })
  }

  try {
    if (existing) {
      const { clinicId: _c, source: _s, externalPostId: _e, verification: _v, verifiedAt: _va, verifiedByUserId: _vb, taskId: _t, authorUserId: _a, ...upd } = data
      const row = await prisma.publishedContent.update({ where: { id: existing.id }, data: { ...upd, unpublishedAt: null }, select: contentSelect })
      return NextResponse.json({ ok: true, id: row.id, updated: true })
    }
    // 직원이 먼저 직접 입력한 같은 주소가 있으면 그 기록에 bokbok 글 번호만 붙인다
    const manual = await prisma.publishedContent.findUnique({ where: { clinicId_urlSha256: { clinicId: clinic.id, urlSha256: urlHash(normalizeUrl(data.url)) } }, select: { id: true } })
    if (manual) {
      await prisma.publishedContent.update({ where: { id: manual.id }, data: { externalPostId: postId, lastSourceEventId: eventId } }).catch(() => {})
      return NextResponse.json({ ok: true, id: manual.id, merged: true })
    }
    const row = await prisma.publishedContent.create({ data, select: contentSelect })
    await createNotifications({
      type: "CONTENT_PUBLISHED",
      title: `${clinic.name} ${data.kind === "COLUMN" ? "칼럼" : "블로그"} 발행: ${data.title}`,
      link: `/work/content?clinicId=${clinic.id}`,
      clinicId: clinic.id,
      audience: "masters",
      dedupKey: `content:${row.id}`,
    })
    return NextResponse.json({ ok: true, id: row.id }, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ ok: true, duplicate: true })
    throw e
  }
}
