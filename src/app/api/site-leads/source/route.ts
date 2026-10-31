import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { mask, protect, reveal, normalizeSiteUrl, testConnection, syncSiteLeads } from "@/lib/site-leads/service"

// GET /api/site-leads/source?clinicId= — 연결 정보(토큰은 마스킹)
export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const clinicId = req.nextUrl.searchParams.get("clinicId") ?? ""
  if (!clinicId || !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 })
  const src = await prisma.siteLeadSource.findUnique({ where: { clinicId } })
  if (!src) return NextResponse.json({ connected: false })
  return NextResponse.json({
    connected: true,
    isActive: src.isActive,
    siteUrl: src.siteUrl,
    tokenMasked: actor.isMaster ? mask(reveal(src.token)) : undefined,
    lastSyncAt: src.lastSyncAt,
    lastSyncStatus: src.lastSyncStatus,
    lastSyncError: actor.isMaster ? src.lastSyncError : undefined,
  })
}

// PUT — 마스터: 연결/갱신 { clinicId, siteUrl, token? }. 토큰을 비우면 기존 토큰 유지. 저장 전 API 호출로 검증 후 1년치 수집
export async function PUT(req: NextRequest) {
  const actor = await getActor()
  if (!actor?.isMaster) return NextResponse.json({ error: "마스터만 설정할 수 있습니다" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const clinicId = String(body.clinicId ?? "")
  let siteUrl: string
  try {
    siteUrl = normalizeSiteUrl(String(body.siteUrl ?? ""))
  } catch {
    return NextResponse.json({ error: "홈페이지 주소를 확인해 주세요" }, { status: 400 })
  }
  const prev = clinicId ? await prisma.siteLeadSource.findUnique({ where: { clinicId } }) : null
  const token = String(body.token ?? "").trim() || (prev ? reveal(prev.token) : "")
  if (!clinicId || !token) return NextResponse.json({ error: "홈페이지 주소와 토큰을 입력해 주세요" }, { status: 400 })

  try {
    await testConnection(siteUrl, token)
  } catch (e: any) {
    return NextResponse.json({ error: `연결 실패: ${e.message}` }, { status: 400 })
  }

  const siteChanged = prev && prev.siteUrl !== siteUrl
  if (siteChanged) await prisma.siteLead.deleteMany({ where: { sourceId: prev.id } })
  await prisma.siteLeadSource.upsert({
    where: { clinicId },
    create: { clinicId, siteUrl, token: protect(token), isActive: true },
    update: { siteUrl, token: protect(token), isActive: true, lastSyncError: null, ...(siteChanged ? { lastSyncAt: null } : {}) },
  })
  try {
    const r = await syncSiteLeads(clinicId, { full: true, notify: false })
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    return NextResponse.json({ ok: true, syncError: e.message })
  }
}

// DELETE — 마스터: 연결 해제. 받아 둔 문의(이름·연락처)도 함께 삭제
export async function DELETE(req: NextRequest) {
  const actor = await getActor()
  if (!actor?.isMaster) return NextResponse.json({ error: "마스터만 해제할 수 있습니다" }, { status: 403 })
  const clinicId = req.nextUrl.searchParams.get("clinicId") ?? ""
  await prisma.siteLeadSource.delete({ where: { clinicId } }).catch(() => null)
  return NextResponse.json({ ok: true })
}
