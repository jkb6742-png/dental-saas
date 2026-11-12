import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, audit, str } from "@/lib/work/common"
import { adjustLeave } from "@/lib/work/leave"

// 연차 수동 조정(대표): 기존 잔여 이월, 공휴일 환원, 출근율 미달 차감 등. 사유 필수.
export async function POST(req: NextRequest) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const b = await req.json().catch(() => ({}))
  const emp = await prisma.employee.findUnique({ where: { userId: String(b.userId ?? "") }, select: { userId: true } })
  if (!emp) return fail("직원을 찾을 수 없습니다")
  const days = Number(b.days)
  if (!Number.isFinite(days) || days === 0 || Math.abs(days) > 60 || Math.round(days * 2) !== days * 2) return fail("일수는 0.5 단위로 입력하세요")
  const note = str(b.note, 200)
  if (!note) return fail("사유를 입력하세요")
  const row = await adjustLeave(emp.userId, days, note, g.actor.id)
  await audit(g.actor.id, "LEAVE_ADJUSTED", null, { employee: emp.userId, days, note })
  return NextResponse.json(row, { status: 201 })
}
