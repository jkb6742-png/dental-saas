import { NextRequest, NextResponse } from "next/server"
import { guard, fail } from "@/lib/work/common"
import { clientIp, verifyCheck } from "@/lib/work/presence"

// 휴대폰에서 숫자를 골라 인증. 로그인한 본인 것만, 1회용 토큰, 틀리면 그 QR은 폐기.
export async function POST(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const b = await req.json().catch(() => ({}))
  const token = typeof b.token === "string" ? b.token : ""
  const pick = typeof b.pick === "string" ? b.pick : ""
  if (!token || !/^\d{2}$/.test(pick)) return fail("잘못된 요청입니다")
  const r = await verifyCheck(token, g.actor.id, pick, clientIp(req), req.headers.get("user-agent") ?? "")
  if ("error" in r) return fail(r.error!)
  return NextResponse.json({ ok: true })
}
