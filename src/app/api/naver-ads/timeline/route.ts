import { NextRequest, NextResponse } from "next/server"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { timelineStats, type Granularity } from "@/lib/naver-ads/service"

// GET /api/naver-ads/timeline?clinicId=&since=YYYY-MM-DD&until=YYYY-MM-DD&granularity=day|week|month
export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const clinicId = sp.get("clinicId") ?? ""
  if (!clinicId || !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 })
  const since = sp.get("since") ?? "", until = sp.get("until") ?? ""
  const g = (sp.get("granularity") ?? "day") as Granularity
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until) || since > until) return NextResponse.json({ error: "기간이 올바르지 않습니다" }, { status: 400 })
  if (!["day", "week", "month"].includes(g)) return NextResponse.json({ error: "granularity 오류" }, { status: 400 })
  const days = (new Date(until).getTime() - new Date(since).getTime()) / 86400000
  if (days > 400) return NextResponse.json({ error: "기간은 최대 400일입니다" }, { status: 400 })
  return NextResponse.json(await timelineStats(clinicId, since, until, g))
}
