import { NextRequest, NextResponse } from "next/server"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { syncSiteLeads } from "@/lib/site-leads/service"

// POST /api/site-leads/sync { clinicId, full? } — 지금 가져오기. 전체 재수집(full)은 마스터만
export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const clinicId = String(body.clinicId ?? "")
  if (!clinicId || !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 })
  try {
    const r = await syncSiteLeads(clinicId, { full: actor.isMaster && body.full === true })
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
