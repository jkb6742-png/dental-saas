import { randomUUID } from "crypto"
import { Prisma, type LeaveUnit } from "@prisma/client"
import { prisma } from "@/lib/db"
import { kstToday, dateOnly, ymdOf } from "./common"

// 연차 원장부. 기록은 고치지 않고 거래(발생·사용·소멸·조정·취소)를 더한다. 잔여 = 합계.
// 발생 규칙(근로기준법 60조): 입사 1년 미만은 매월 1일(최대 11일, 입사 1년 되는 날 소멸),
// 1년마다 15일 + 3년차부터 2년마다 1일(최대 25일), 다음 입사기념일에 소멸.
// 출근율 80% 미만 처리 등 예외는 대표가 '조정'으로 넣는다. 반차 = 0.5일.

const n = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0)
const addMonths = (d: Date, m: number) => {
  const y = d.getUTCFullYear()
  const mo = d.getUTCMonth() + m
  const day = d.getUTCDate()
  const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, mo, Math.min(day, last)))
}

/** 오늘까지 생겨야 할 발생분을 넣는다(이미 있으면 건너뜀). */
export async function ensureGrants(userId: string) {
  const emp = await prisma.employee.findUnique({ where: { userId } })
  if (!emp) return
  if (emp.weeklyContractMinutes < 15 * 60) return // 주 15시간 미만은 연차 없음
  const today = dateOnly(kstToday())
  const end = emp.leftOn && emp.leftOn < today ? emp.leftOn : today
  const hired = emp.hiredOn
  const rows: Prisma.LeaveLedgerEntryCreateManyInput[] = []
  for (let m = 1; m <= 11; m++) {
    const on = addMonths(hired, m)
    if (on > end) break
    rows.push({ employeeUserId: userId, type: "GRANT", deltaDays: 1, effectiveOn: on, expiresOn: addMonths(hired, 12), sourceKey: `grant:${userId}:m${m}`, note: `입사 ${m}개월 만근` })
  }
  for (let k = 1; k <= 60; k++) {
    const on = addMonths(hired, 12 * k)
    if (on > end) break
    const days = Math.min(25, 15 + Math.floor((k - 1) / 2))
    rows.push({ employeeUserId: userId, type: "GRANT", deltaDays: days, effectiveOn: on, expiresOn: addMonths(hired, 12 * (k + 1)), sourceKey: `grant:${userId}:y${k}`, note: `${k}년 근속` })
  }
  if (rows.length) await prisma.leaveLedgerEntry.createMany({ data: rows, skipDuplicates: true })
  await expireGrants(userId)
}

/** 각 발생분의 남은 일수 = 발생 + 그 발생분에서 쓴·소멸·되돌린 거래 합 */
async function grantRemainders(userId: string, tx: Prisma.TransactionClient = prisma) {
  const grants = await tx.leaveLedgerEntry.findMany({
    where: { employeeUserId: userId, type: { in: ["GRANT", "ADJUST"] }, deltaDays: { gt: 0 } },
    orderBy: [{ expiresOn: { sort: "asc", nulls: "last" } }, { effectiveOn: "asc" }],
    select: { id: true, deltaDays: true, expiresOn: true, effectiveOn: true, allocations: { select: { deltaDays: true } } },
  })
  return grants.map((g) => ({ id: g.id, expiresOn: g.expiresOn, effectiveOn: g.effectiveOn, remaining: n(g.deltaDays) + g.allocations.reduce((s, a) => s + n(a.deltaDays), 0) }))
}

/** 기한 지난 발생분의 남은 일수를 소멸 처리 */
export async function expireGrants(userId: string) {
  const today = dateOnly(kstToday())
  for (const g of await grantRemainders(userId)) {
    if (!g.expiresOn || g.expiresOn > today || g.remaining <= 0) continue
    await prisma.leaveLedgerEntry.createMany({
      data: [{ employeeUserId: userId, type: "EXPIRE", deltaDays: -g.remaining, effectiveOn: g.expiresOn, grantEntryId: g.id, sourceKey: `expire:${g.id}`, note: "사용 기한 지남" }],
      skipDuplicates: true,
    })
  }
}

export async function leaveBalance(userId: string) {
  await ensureGrants(userId)
  const [sum, pending] = await Promise.all([
    prisma.leaveLedgerEntry.aggregate({ where: { employeeUserId: userId }, _sum: { deltaDays: true } }),
    prisma.leaveRequest.aggregate({ where: { employeeUserId: userId, status: "PENDING" }, _sum: { requestedDays: true } }),
  ])
  return { balance: n(sum._sum.deltaDays), pending: n(pending._sum.requestedDays) }
}

/** 신청 일수: 하루·반차는 근무 요일이어야 하고, 기간은 근무 요일만 센다(공휴일은 대표 조정). */
export function countLeaveDays(startOn: string, endOn: string, unit: LeaveUnit, workWeekdays: number[]) {
  if (endOn < startOn) throw new Error("끝나는 날이 시작일보다 빠릅니다")
  if (unit !== "FULL" && startOn !== endOn) throw new Error("반차는 하루만 고를 수 있습니다")
  let days = 0
  for (let d = dateOnly(startOn); d <= dateOnly(endOn); d = new Date(d.getTime() + 86400_000)) {
    const wd = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
    if (workWeekdays.includes(wd)) days++
    if (days > 60) throw new Error("한 번에 60일까지 신청할 수 있습니다")
  }
  if (days === 0) throw new Error("고른 날에 근무일이 없습니다")
  return unit === "FULL" ? days : 0.5
}

/** 승인: 사용 기한이 먼저 끝나는 발생분부터 차감. 모자라면 남는 만큼은 발생분 없이 음수로(대표 판단). */
export async function approveLeave(requestId: string, actorId: string, note?: string | null) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.leaveRequest.findUnique({ where: { id: requestId } })
    if (!r) throw new Error("신청을 찾을 수 없습니다")
    if (r.status !== "PENDING") throw new Error("대기 중인 신청만 승인할 수 있습니다")
    let left = n(r.requestedDays)
    const rows: Prisma.LeaveLedgerEntryCreateManyInput[] = []
    for (const g of await grantRemainders(r.employeeUserId, tx)) {
      if (left <= 0) break
      if (g.remaining <= 0 || g.effectiveOn > r.startOn || (g.expiresOn && g.expiresOn <= r.startOn)) continue
      const take = Math.min(left, g.remaining)
      rows.push({ employeeUserId: r.employeeUserId, type: "USE", deltaDays: -take, effectiveOn: r.startOn, grantEntryId: g.id, leaveRequestId: r.id, sourceKey: `use:${r.id}:${g.id}`, createdByUserId: actorId })
      left -= take
    }
    if (left > 0) rows.push({ employeeUserId: r.employeeUserId, type: "USE", deltaDays: -left, effectiveOn: r.startOn, leaveRequestId: r.id, sourceKey: `use:${r.id}:over`, note: "잔여 초과 사용", createdByUserId: actorId })
    await tx.leaveLedgerEntry.createMany({ data: rows })
    return tx.leaveRequest.update({ where: { id: r.id }, data: { status: "APPROVED", decidedByUserId: actorId, decidedAt: new Date(), decisionNote: note ?? null } })
  })
}

/** 승인된 연차 취소: 사용 거래마다 반대 거래를 넣는다. */
export async function cancelLeave(requestId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.leaveRequest.findUnique({ where: { id: requestId }, include: { ledgerEntries: { where: { type: "USE" } } } })
    if (!r) throw new Error("신청을 찾을 수 없습니다")
    if (r.status !== "PENDING" && r.status !== "APPROVED") throw new Error("이미 끝난 신청입니다")
    if (r.status === "APPROVED") {
      await tx.leaveLedgerEntry.createMany({
        data: r.ledgerEntries.map((u) => ({
          employeeUserId: r.employeeUserId,
          type: "REVERSAL" as const,
          deltaDays: -n(u.deltaDays),
          effectiveOn: dateOnly(kstToday()),
          grantEntryId: u.grantEntryId,
          reversesEntryId: u.id,
          leaveRequestId: r.id,
          sourceKey: `rev:${u.id}`,
          createdByUserId: actorId,
        })),
        skipDuplicates: true,
      })
    }
    return tx.leaveRequest.update({ where: { id: r.id }, data: { status: "CANCELLED" } })
  })
}

export async function adjustLeave(userId: string, days: number, note: string, actorId: string) {
  return prisma.leaveLedgerEntry.create({
    data: { employeeUserId: userId, type: "ADJUST", deltaDays: days, effectiveOn: dateOnly(kstToday()), sourceKey: `adjust:${randomUUID()}`, note, createdByUserId: actorId },
  })
}

export const LEAVE_UNIT_LABEL: Record<LeaveUnit, string> = { FULL: "연차", HALF_AM: "오전 반차", HALF_PM: "오후 반차" }
export const LEAVE_STATUS_LABEL = { PENDING: "대기", APPROVED: "승인", REJECTED: "반려", CANCELLED: "취소" } as const
export const LEDGER_TYPE_LABEL = { GRANT: "발생", USE: "사용", EXPIRE: "소멸", ADJUST: "조정", REVERSAL: "취소 환원" } as const
export { ymdOf }
