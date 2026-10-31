import { NextRequest, NextResponse } from "next/server"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { defaultRange, syncClinic } from "@/lib/naver-ads/service"

// POST /api/naver-ads/sync { clinicId, since?, until? } — 네이버에서 캠페인 일 성과를 받아 저장
export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  if (!actor.isMaster) return NextResponse.json({ error: "동기화는 마스터만 실행할 수 있습니다" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const clinicId = String(body.clinicId ?? "")
  if (!clinicId || !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 })

  const range = defaultRange()
  const since = /^\d{4}-\d{2}-\d{2}$/.test(body.since ?? "") ? body.since : range.since
  const until = /^\d{4}-\d{2}-\d{2}$/.test(body.until ?? "") ? body.until : range.until

  try {
    const result = await syncClinic(clinicId, since, until)
    return NextResponse.json({ ok: true, since, until, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "동기화 실패" }, { status: 502 })
  }
}
