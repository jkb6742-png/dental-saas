import { randomInt } from "crypto"
import { prisma } from "@/lib/db"
import { str, isYmd, dateOnly } from "./common"

// 직원관리(대표 전용) 공통: 입력 정리·검사.

export const EMPLOYMENT_TYPES = ["정규직", "수습", "계약직", "파트타임", "프리랜서"] as const
const HM = /^([01]\d|2[0-3]):[0-5]\d$/

export async function masterAgency(userId: string) {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { agencyId: true } })
  return me?.agencyId ?? null
}

/** 직원 기본정보 입력 정리. 틀린 값이 있으면 error. */
export function parseProfile(b: Record<string, unknown>) {
  if (!isYmd(b.hiredOn)) return { error: "입사일을 입력하세요" } as const
  if (b.leftOn && !isYmd(b.leftOn)) return { error: "퇴사일 형식이 잘못되었습니다" } as const
  const workStart = typeof b.workStart === "string" && HM.test(b.workStart) ? b.workStart : "09:00"
  const workEnd = typeof b.workEnd === "string" && HM.test(b.workEnd) ? b.workEnd : "18:00"
  if (workEnd <= workStart) return { error: "퇴근 시각이 출근 시각보다 늦어야 합니다" } as const
  const weekdays = Array.isArray(b.workWeekdays)
    ? [...new Set(b.workWeekdays.map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort()
    : [1, 2, 3, 4, 5]
  if (!weekdays.length) return { error: "근무 요일을 하나 이상 고르세요" } as const
  const weeklyHours = Number(b.weeklyHours ?? 40)
  if (!(weeklyHours > 0 && weeklyHours <= 52)) return { error: "주 소정근로시간은 1~52시간입니다" } as const
  const phone = str(b.phone, 20)
  if (phone && !/^[0-9-+ ]{9,20}$/.test(phone)) return { error: "휴대폰 번호 형식이 잘못되었습니다" } as const
  const employmentType = typeof b.employmentType === "string" && (EMPLOYMENT_TYPES as readonly string[]).includes(b.employmentType) ? b.employmentType : null
  return {
    data: {
      hiredOn: dateOnly(b.hiredOn as string),
      leftOn: b.leftOn ? dateOnly(b.leftOn as string) : null,
      jobTitle: str(b.jobTitle, 40),
      phone,
      employmentType,
      workMode: b.workMode === "REMOTE" ? ("REMOTE" as const) : ("OFFICE" as const),
      workStart,
      workEnd,
      workWeekdays: weekdays,
      weeklyContractMinutes: Math.round(weeklyHours * 60),
      memo: str(b.memo, 500),
    },
  } as const
}

/** 같은 에이전시 치과만 남긴다 */
export async function ownClinicIds(agencyId: string, ids: unknown) {
  const requested = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []
  if (!requested.length) return []
  return (await prisma.clinic.findMany({ where: { agencyId, id: { in: requested } }, select: { id: true } })).map((c) => c.id)
}

/** 읽기 쉬운 임시 비밀번호(헷갈리는 글자 제외) */
export function tempPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let s = ""
  for (let i = 0; i < 10; i++) s += chars[randomInt(chars.length)]
  return s
}
