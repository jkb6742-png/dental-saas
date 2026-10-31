import { NextRequest, NextResponse } from "next/server"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { monthlyStats, bizmoney, stripForViewer } from "@/lib/naver-ads/service"

// GET /api/naver-ads/stats?clinicId=&year=&month=&bizmoney=1
export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const clinicId = sp.get("clinicId") ?? ""
  if (!clinicId || !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 })
  const now = new Date()
  const year = Number(sp.get("year") ?? now.getFullYear())
  const month = Number(sp.get("month") ?? now.getMonth() + 1)
  if (!year || !month || month < 1 || month > 12) return NextResponse.json({ error: "year/month 오류" }, { status: 400 })

  const stats = await monthlyStats(clinicId, year, month)
  if (!actor.isMaster) stripForViewer(stats)
  const balance = sp.get("bizmoney") === "1" ? await bizmoney(clinicId) : undefined
  return NextResponse.json({ ...stats, bizmoney: balance ?? null })
}
