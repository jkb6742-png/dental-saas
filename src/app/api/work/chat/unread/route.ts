import { NextResponse } from "next/server"
import { guard } from "@/lib/work/common"
import { myRoomIds, unreadCounts } from "@/lib/work/chat"

// 상단 메뉴 배지용 안 읽은 메시지 합계
export async function GET() {
  const g = await guard()
  if ("res" in g) return g.res
  const counts = await unreadCounts(g.actor, await myRoomIds(g.actor))
  return NextResponse.json({ total: Object.values(counts).reduce((s, n) => s + n, 0) })
}
