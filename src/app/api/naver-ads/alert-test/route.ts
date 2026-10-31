import { NextRequest, NextResponse } from "next/server"
import { getActor } from "@/lib/requests/access"
import { checkBizmoneyAlert } from "@/lib/naver-ads/service"

// POST /api/naver-ads/alert-test { clinicId } — 마스터: 현재 잔액으로 알림 메일을 즉시 보내 수신 확인
export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor?.isMaster) return NextResponse.json({ error: "마스터만 실행할 수 있습니다" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const clinicId = String(body.clinicId ?? "")
  if (!clinicId) return NextResponse.json({ error: "clinicId 가 필요합니다" }, { status: 400 })
  try {
    const r = await checkBizmoneyAlert(clinicId, { test: true })
    if (!r.sent) return NextResponse.json({ error: r.reason, balance: r.balance }, { status: 400 })
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "발송 실패" }, { status: 500 })
  }
}
