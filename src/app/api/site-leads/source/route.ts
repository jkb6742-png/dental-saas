import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { mask, protect, reveal, normalizeSiteUrl, testConnection, syncSiteLeads } from "@/lib/site-leads/service"
import { isMailConfigured, parseEmails, sendMail } from "@/lib/mail"

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

// PATCH — 마스터: 새 문의 메일 알림 수신 주소 { clinicId, alertEmails }
export async function PATCH(req: NextRequest) {
  const actor = await getActor()
  if (!actor?.isMaster) return NextResponse.json({ error: "마스터만 설정할 수 있습니다" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const clinicId = String(body.clinicId ?? "")
  const raw = String(body.alertEmails ?? "")
  const emails = parseEmails(raw)
  if (raw.split(/[,;\s]+/).filter(Boolean).length !== emails.length) return NextResponse.json({ error: "메일 주소 형식을 확인해 주세요" }, { status: 400 })
  const src = await prisma.siteLeadSource.findUnique({ where: { clinicId } })
  if (!src) return NextResponse.json({ error: "먼저 홈페이지를 연결해 주세요" }, { status: 404 })
  await prisma.siteLeadSource.update({ where: { clinicId }, data: { alertEmails: emails.join(", ") || null } })
  // test: true — 저장 후 바로 테스트 메일 발송, 실패 사유를 화면에 돌려준다
  if (body.test === true) {
    if (!emails.length) return NextResponse.json({ error: "받을 메일 주소를 먼저 입력해 주세요" }, { status: 400 })
    if (!isMailConfigured()) return NextResponse.json({ error: "서버 메일(SMTP) 설정이 없어 보낼 수 없습니다" }, { status: 400 })
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } })
    try {
      await sendMail({
        to: emails,
        subject: `[${clinic?.name ?? "치과"}] 홈페이지 상담문의 알림 테스트`,
        html: `<div style="font-family:sans-serif;font-size:14px;color:#191f28"><p><b>${clinic?.name ?? "치과"}</b> 홈페이지 상담문의 메일 알림이 연결되었습니다.</p><p>앞으로 새 문의가 들어오면 이 주소로 알려 드립니다.</p></div>`,
        text: `${clinic?.name ?? "치과"} 홈페이지 상담문의 메일 알림이 연결되었습니다.`,
      })
    } catch (e: any) {
      return NextResponse.json({ error: `발송 실패: ${e?.message ?? e}` }, { status: 502 })
    }
    return NextResponse.json({ ok: true, alertEmails: emails.join(", "), mailReady: true, tested: true })
  }
  return NextResponse.json({ ok: true, alertEmails: emails.join(", "), mailReady: isMailConfigured() })
}

// DELETE — 마스터: 연결 해제. 받아 둔 문의(이름·연락처)도 함께 삭제
export async function DELETE(req: NextRequest) {
  const actor = await getActor()
  if (!actor?.isMaster) return NextResponse.json({ error: "마스터만 해제할 수 있습니다" }, { status: 403 })
  const clinicId = req.nextUrl.searchParams.get("clinicId") ?? ""
  await prisma.siteLeadSource.delete({ where: { clinicId } }).catch(() => null)
  return NextResponse.json({ ok: true })
}
