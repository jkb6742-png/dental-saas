import { NextRequest, NextResponse } from "next/server"
import { getActor } from "@/lib/requests/access"
import { listNotifications, markRead, type NotificationFilter } from "@/lib/notifications"

// GET /api/notifications?limit=30&filter=all|action|unread&page=1 — 내 알림 목록 + 안 읽은 수·처리 필요 수
// GET /api/notifications?count=1 — 안 읽은 수만(종 아이콘 주기 확인용)
export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const internal = actor.isMaster || actor.isStaff
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit") ?? 30) || 30))
  const f = sp.get("filter")
  const filter: NotificationFilter = f === "unread" ? "unread" : f === "action" && internal ? "action" : "all"
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1)
  const r = await listNotifications(actor.id, limit, { filter, page })
  return NextResponse.json({ ...r, internal })
}

// PATCH /api/notifications { ids?: string[] } — 읽음 처리 (ids 없으면 전부)
export async function PATCH(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : undefined
  const count = await markRead(actor.id, ids)
  return NextResponse.json({ ok: true, count })
}
