import { NextRequest, NextResponse } from "next/server"
import { guard, fail, currentMonth, isMonth } from "@/lib/work/common"
import { loadExecData } from "@/app/work/exec/data"

// 경영 대시보드 집계(대표 전용). ?month=YYYY-MM
export async function GET(req: NextRequest) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const m = req.nextUrl.searchParams.get("month")
  if (m && !isMonth(m)) return fail("월 형식이 올바르지 않습니다")
  return NextResponse.json(await loadExecData(g.actor.id, m ?? currentMonth()))
}
