import { prisma } from "@/lib/db"

// 추가근무 공통: "HH:MM" 두 개를 그 날짜의 한국 시각으로. 끝이 시작보다 이르면 다음 날 새벽으로 본다.

export const OT_STATUS = ["PENDING", "APPROVED", "REJECTED"] as const
const HM = /^([01]\d|2[0-3]):[0-5]\d$/

export function parseSpan(workDate: string, start: unknown, end: unknown) {
  if (typeof start !== "string" || !HM.test(start) || typeof end !== "string" || !HM.test(end)) throw new Error("시각은 18:00 형식으로 넣으세요")
  if (start === end) throw new Error("시작과 끝이 같습니다")
  const startAt = new Date(`${workDate}T${start}:00+09:00`)
  let endAt = new Date(`${workDate}T${end}:00+09:00`)
  if (endAt <= startAt) endAt = new Date(endAt.getTime() + 86400_000)
  const minutes = Math.round((endAt.getTime() - startAt.getTime()) / 60000)
  if (minutes > 12 * 60) throw new Error("한 번에 12시간까지 등록할 수 있습니다")
  return { startAt, endAt, minutes }
}

/** 같은 사람의 반려되지 않은 추가근무와 시간이 겹치는지 */
export async function overlaps(userId: string, startAt: Date, endAt: Date, exceptId?: string) {
  const hit = await prisma.overtimeRecord.findFirst({
    where: { employeeUserId: userId, status: { not: "REJECTED" }, startAt: { lt: endAt }, endAt: { gt: startAt }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  })
  return !!hit
}
