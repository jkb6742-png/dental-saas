import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { fetchCampaigns } from "@/lib/naver-ads/client"
import { mask, protect, reveal } from "@/lib/naver-ads/service"
import { parseEmails } from "@/lib/mail"

// GET /api/naver-ads/account?clinicId= — 연결 정보(마스킹)
export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const clinicId = req.nextUrl.searchParams.get("clinicId") ?? ""
  if (!clinicId || !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 })
  const acc = await prisma.naverAdAccount.findUnique({ where: { clinicId } })
  if (!acc) return NextResponse.json({ connected: false })
  if (!actor.isMaster) return NextResponse.json({ connected: true, isActive: acc.isActive, lastSyncAt: acc.lastSyncAt })
  return NextResponse.json({
    connected: true,
    isActive: acc.isActive,
    customerId: acc.customerId,
    apiKeyMasked: mask(reveal(acc.apiKey)),
    lastSyncAt: acc.lastSyncAt,
    lastSyncStatus: acc.lastSyncStatus,
    lastSyncError: acc.lastSyncError,
    alert: { enabled: acc.alertEnabled, threshold: acc.alertThreshold, threshold2: acc.alertThreshold2, days: acc.alertDays, emails: acc.alertEmails ?? "", onSyncFail: acc.alertOnSyncFail, autoMonthlyReport: acc.autoMonthlyReport, lastAlertAt: acc.lastAlertAt },
    lastBizmoney: acc.lastBizmoney,
    lastBizmoneyAt: acc.lastBizmoneyAt,
  })
}

// PUT — 마스터: 계정 연결/갱신. 저장 전 캠페인 조회로 자격 검증
export async function PUT(req: NextRequest) {
  const actor = await getActor()
  if (!actor?.isMaster) return NextResponse.json({ error: "마스터만 설정할 수 있습니다" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const clinicId = String(body.clinicId ?? "")
  const customerId = String(body.customerId ?? "").trim()
  const apiKey = String(body.apiKey ?? "").trim()
  const secretKey = String(body.secretKey ?? "").trim()
  if (!clinicId || !customerId || !apiKey || !secretKey) return NextResponse.json({ error: "CUSTOMER_ID·액세스 라이선스·비밀키를 모두 입력해 주세요" }, { status: 400 })
  if (!/^\d+$/.test(customerId)) return NextResponse.json({ error: "CUSTOMER_ID 는 숫자입니다" }, { status: 400 })

  let campaignCount = 0
  try {
    const campaigns = await fetchCampaigns({ customerId, apiKey, secretKey })
    campaignCount = campaigns.length
  } catch (e: any) {
    return NextResponse.json({ error: `네이버 인증 실패: ${e.message}` }, { status: 400 })
  }

  await prisma.naverAdAccount.upsert({
    where: { clinicId },
    create: { clinicId, customerId, apiKey: protect(apiKey), secretKey: protect(secretKey), isActive: true },
    update: { customerId, apiKey: protect(apiKey), secretKey: protect(secretKey), isActive: true, lastSyncError: null },
  })
  return NextResponse.json({ ok: true, campaignCount })
}

// PATCH — 마스터: 알림·자동화 설정 { clinicId, alertEnabled?, alertThreshold?, alertThreshold2?, alertDays?, alertEmails?, alertOnSyncFail?, autoMonthlyReport? }
export async function PATCH(req: NextRequest) {
  const actor = await getActor()
  if (!actor?.isMaster) return NextResponse.json({ error: "마스터만 설정할 수 있습니다" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const clinicId = String(body.clinicId ?? "")
  const acc = await prisma.naverAdAccount.findUnique({ where: { clinicId } })
  if (!acc) return NextResponse.json({ error: "먼저 광고계정을 연결해 주세요" }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (typeof body.alertEnabled === "boolean") data.alertEnabled = body.alertEnabled
  if (typeof body.alertOnSyncFail === "boolean") data.alertOnSyncFail = body.alertOnSyncFail
  if (typeof body.autoMonthlyReport === "boolean") data.autoMonthlyReport = body.autoMonthlyReport
  if (body.alertThreshold !== undefined) {
    const n = Math.round(Number(body.alertThreshold))
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "알림 기준 금액은 0 이상의 숫자입니다" }, { status: 400 })
    data.alertThreshold = n
  }
  if (body.alertThreshold2 !== undefined) {
    if (body.alertThreshold2 === null || body.alertThreshold2 === "" || body.alertThreshold2 === 0) data.alertThreshold2 = null
    else {
      const n = Math.round(Number(body.alertThreshold2))
      const t1 = (data.alertThreshold as number | undefined) ?? acc.alertThreshold
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "2차 기준 금액은 0 이상의 숫자입니다" }, { status: 400 })
      if (n >= t1) return NextResponse.json({ error: "2차 기준은 1차 기준보다 작아야 합니다" }, { status: 400 })
      data.alertThreshold2 = n
    }
  }
  if (body.alertDays !== undefined) {
    if (body.alertDays === null || body.alertDays === "" || body.alertDays === 0) data.alertDays = null
    else {
      const n = Math.round(Number(body.alertDays))
      if (!Number.isFinite(n) || n < 1 || n > 60) return NextResponse.json({ error: "일수 기준은 1~60일 사이입니다" }, { status: 400 })
      data.alertDays = n
    }
  }
  if (body.alertEmails !== undefined) {
    const raw = String(body.alertEmails ?? "")
    const emails = parseEmails(raw)
    const tokens = raw.split(/[,;\s]+/).filter(Boolean)
    if (tokens.length !== emails.length) return NextResponse.json({ error: "메일 주소 형식을 확인해 주세요" }, { status: 400 })
    data.alertEmails = emails.join(", ") || null
  }
  const updated = await prisma.naverAdAccount.update({ where: { clinicId }, data })
  return NextResponse.json({ ok: true, alert: { enabled: updated.alertEnabled, threshold: updated.alertThreshold, threshold2: updated.alertThreshold2, days: updated.alertDays, emails: updated.alertEmails ?? "", onSyncFail: updated.alertOnSyncFail, autoMonthlyReport: updated.autoMonthlyReport, lastAlertAt: updated.lastAlertAt } })
}

// DELETE — 마스터: 연결 해제(수집 데이터는 유지)
export async function DELETE(req: NextRequest) {
  const actor = await getActor()
  if (!actor?.isMaster) return NextResponse.json({ error: "마스터만 해제할 수 있습니다" }, { status: 403 })
  const clinicId = req.nextUrl.searchParams.get("clinicId") ?? ""
  await prisma.naverAdAccount.delete({ where: { clinicId } }).catch(() => null)
  return NextResponse.json({ ok: true })
}
