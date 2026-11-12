import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, isMonth, isYmd, monthRange, dateOnly, audit, str } from "@/lib/work/common"
import { OT_STATUS, parseSpan, overlaps } from "./shared"

// 추가근무 기록. 직원은 본인 것을 신청(대기), 대표는 승인·반려하거나 직접 넣는다(바로 승인).
// 실제 출퇴근 기록은 건드리지 않는다.

// GET ?month=YYYY-MM&userId=&status=   직원: 본인만 / 대표: 전체 또는 userId
export async function GET(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const q = req.nextUrl.searchParams
  const month = q.get("month")
  if (month && !isMonth(month)) return fail("월 형식이 잘못되었습니다")
  const status = q.get("status")
  if (status && !OT_STATUS.includes(status as (typeof OT_STATUS)[number])) return fail("상태가 잘못되었습니다")
  const who = actor.isMaster ? q.get("userId") : actor.id
  const range = month ? monthRange(month) : null
  const rows = await prisma.overtimeRecord.findMany({
    where: {
      ...(who ? { employeeUserId: who } : {}),
      ...(status ? { status } : {}),
      ...(range ? { workDate: { gte: range.start, lt: range.next } } : {}),
    },
    include: { employee: { select: { user: { select: { name: true } } } } },
    orderBy: [{ workDate: "desc" }, { startAt: "desc" }],
    take: 500,
  })
  return NextResponse.json({ rows: rows.map((r) => ({ ...r, name: r.employee.user.name, employee: undefined })) })
}

// POST { workDate, start:"18:00", end:"21:00", reason, userId? }
export async function POST(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const b = await req.json().catch(() => ({}))
  const userId = actor.isMaster && b.userId ? String(b.userId) : actor.id
  const emp = await prisma.employee.findUnique({ where: { userId }, select: { userId: true } })
  if (!emp) return fail(userId === actor.id ? "직원 정보가 없는 계정입니다" : "직원을 찾을 수 없습니다")
  if (!isYmd(b.workDate)) return fail("날짜를 고르세요")
  const reason = str(b.reason, 300)
  if (!reason) return fail("사유를 적어 주세요")
  let span
  try {
    span = parseSpan(b.workDate, b.start, b.end)
  } catch (e) {
    return fail((e as Error).message)
  }
  if (await overlaps(userId, span.startAt, span.endAt)) return fail("같은 시간에 등록된 추가근무가 있습니다")
  const byMaster = actor.isMaster
  const row = await prisma.overtimeRecord.create({
    data: {
      employeeUserId: userId,
      workDate: dateOnly(b.workDate),
      ...span,
      reason,
      status: byMaster ? "APPROVED" : "PENDING",
      source: byMaster && userId !== actor.id ? "MANAGER" : "SELF",
      ...(byMaster ? { decidedByUserId: actor.id, decidedAt: new Date() } : {}),
    },
  })
  await audit(actor.id, "OVERTIME_CREATED", null, { id: row.id, employee: userId, workDate: b.workDate, minutes: span.minutes, status: row.status })
  return NextResponse.json(row)
}
