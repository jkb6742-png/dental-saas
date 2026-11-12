import { NextRequest, NextResponse } from "next/server"
import type { LeaveUnit } from "@prisma/client"
import { prisma } from "@/lib/db"
import { guard, fail, isYmd, dateOnly, str } from "@/lib/work/common"
import { leaveBalance, countLeaveDays, LEAVE_UNIT_LABEL } from "@/lib/work/leave"
import { createNotifications } from "@/lib/notifications"

// 연차: 내 잔여·신청 목록(대표는 전 직원), 신청하기

export async function GET(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const who = actor.isMaster ? req.nextUrl.searchParams.get("userId") ?? actor.id : actor.id
  const emp = await prisma.employee.findUnique({ where: { userId: who }, select: { userId: true, hiredOn: true, workWeekdays: true } })
  const mine = emp
    ? {
        ...(await leaveBalance(who)),
        hiredOn: emp.hiredOn,
        ledger: await prisma.leaveLedgerEntry.findMany({ where: { employeeUserId: who }, orderBy: [{ effectiveOn: "desc" }, { createdAt: "desc" }], take: 200 }),
        requests: await prisma.leaveRequest.findMany({ where: { employeeUserId: who }, orderBy: { startOn: "desc" }, take: 100 }),
      }
    : null

  let team = null
  if (actor.isMaster) {
    const emps = await prisma.employee.findMany({ where: { OR: [{ leftOn: null }, { leftOn: { gte: new Date() } }] }, select: { userId: true, hiredOn: true, user: { select: { name: true } } }, orderBy: { hiredOn: "asc" } })
    team = {
      employees: await Promise.all(emps.map(async (e) => ({ userId: e.userId, name: e.user.name, hiredOn: e.hiredOn, ...(await leaveBalance(e.userId)) }))),
      pending: await prisma.leaveRequest.findMany({ where: { status: "PENDING" }, include: { employee: { select: { user: { select: { name: true } } } } }, orderBy: { startOn: "asc" } }),
    }
  }
  return NextResponse.json({ userId: who, mine, team })
}

export async function POST(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const emp = await prisma.employee.findUnique({ where: { userId: actor.id }, select: { userId: true, workWeekdays: true } })
  if (!emp) return fail("직원 정보가 없는 계정입니다")
  const b = await req.json().catch(() => ({}))
  if (!isYmd(b.startOn)) return fail("날짜를 고르세요")
  const endOn = isYmd(b.endOn) ? b.endOn : b.startOn
  const unit: LeaveUnit = ["FULL", "HALF_AM", "HALF_PM"].includes(b.unit) ? b.unit : "FULL"
  let days: number
  try {
    days = countLeaveDays(b.startOn, endOn, unit, emp.workWeekdays)
  } catch (e) {
    return fail((e as Error).message)
  }
  // 겹치는 신청 막기(같은 날 오전·오후 반차는 허용)
  const overlap = await prisma.leaveRequest.findMany({
    where: { employeeUserId: actor.id, status: { in: ["PENDING", "APPROVED"] }, startOn: { lte: dateOnly(endOn) }, endOn: { gte: dateOnly(b.startOn) } },
    select: { unit: true },
  })
  const halfPair = unit !== "FULL" && overlap.length === 1 && overlap[0].unit !== "FULL" && overlap[0].unit !== unit
  if (overlap.length && !halfPair) return fail("이미 신청한 날짜와 겹칩니다")

  const { balance, pending } = await leaveBalance(actor.id)
  if (days > balance - pending) return fail(`잔여 연차가 부족합니다 (잔여 ${balance}일, 승인 대기 ${pending}일)`)

  const row = await prisma.leaveRequest.create({
    data: { employeeUserId: actor.id, startOn: dateOnly(b.startOn), endOn: dateOnly(endOn), unit, requestedDays: days, decisionNote: null },
  })
  const memo = str(b.memo, 200)
  const masters = (await prisma.user.findMany({ where: { role: "MASTER", status: "APPROVED" }, select: { id: true } })).map((u) => u.id)
  await createNotifications({
    type: "LEAVE_REQUESTED",
    title: `${actor.name} ${LEAVE_UNIT_LABEL[unit]} 신청: ${b.startOn}${endOn !== b.startOn ? ` ~ ${endOn}` : ""} (${days}일)`,
    body: memo ?? undefined,
    link: "/work/leave",
    audience: "masters",
    userIds: masters,
    exclude: [actor.id],
    dedupKey: `leave:${row.id}`,
  })
  return NextResponse.json(row, { status: 201 })
}
