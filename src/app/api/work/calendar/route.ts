import { NextRequest, NextResponse } from "next/server"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { loadCalendar } from "@/lib/work/calendar"

const DAY = /^\d{4}-\d{2}-\d{2}$/

// GET /api/work/calendar?from=2026-11-01&to=2026-12-01[&clinicId=]
export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor || !(actor.isMaster || actor.isStaff)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  const q = req.nextUrl.searchParams
  const from = q.get("from") ?? ""
  const to = q.get("to") ?? ""
  if (!DAY.test(from) || !DAY.test(to) || from >= to) return NextResponse.json({ error: "기간 형식 오류" }, { status: 400 })
  if (new Date(to).getTime() - new Date(from).getTime() > 62 * 86400_000) return NextResponse.json({ error: "기간은 62일 이내" }, { status: 400 })
  const clinicId = q.get("clinicId")
  if (clinicId && !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  return NextResponse.json({ items: await loadCalendar(actor, from, to, clinicId) })
}
