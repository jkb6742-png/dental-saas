import { NextRequest, NextResponse } from "next/server"
import { getActor } from "@/lib/requests/access"
import { listNotifications, markRead } from "@/lib/notifications"

// GET /api/notifications?limit=30 — 내 알림 목록 + 안 읽은 수
export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 30)))
  return NextResponse.json(await listNotifications(actor.id, limit))
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
