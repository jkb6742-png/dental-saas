import type { SalesStage } from "@prisma/client"
import { isYmd, dateOnly, str } from "./common"

// 영업 기회(신규 치과). 계약 전에는 Clinic 을 만들지 않는다. 대표 전용.

export const SALES_STAGE_LABEL: Record<SalesStage, string> = {
  NEW: "신규",
  CONTACTED: "연락함",
  MEETING: "미팅",
  PROPOSAL: "제안서",
  NEGOTIATION: "조율",
  WON: "계약",
  LOST: "무산",
}
const STAGES = Object.keys(SALES_STAGE_LABEL) as SalesStage[]

export function parseSales(b: any, partial = false) {
  const out: Record<string, unknown> = {}
  if (!partial || b.clinicName !== undefined) {
    const v = str(b.clinicName, 160)
    if (!v) return { error: "치과 이름을 입력하세요" }
    out.clinicName = v
  }
  if (b.stage !== undefined) {
    if (!STAGES.includes(b.stage)) return { error: "단계가 잘못되었습니다" }
    out.stage = b.stage
    if (b.stage === "WON") out.wonAt = new Date()
  }
  for (const [k, max] of [
    ["contactPerson", 100],
    ["contactChannel", 40],
    ["contactValue", 200],
    ["region", 100],
    ["proposalUrl", 1000],
    ["nextAction", 200],
    ["lostReason", 300],
  ] as const)
    if (b[k] !== undefined) out[k] = str(b[k], max)
  if (b.expectedMonthlyFeeKrw !== undefined) {
    const v = b.expectedMonthlyFeeKrw === "" || b.expectedMonthlyFeeKrw === null ? null : Number(b.expectedMonthlyFeeKrw)
    if (v !== null && (!Number.isInteger(v) || v < 0)) return { error: "예상 금액이 잘못되었습니다" }
    out.expectedMonthlyFeeKrw = v
  }
  if (b.nextActionOn !== undefined) {
    if (b.nextActionOn && !isYmd(b.nextActionOn)) return { error: "다음 할 일 날짜가 잘못되었습니다" }
    out.nextActionOn = b.nextActionOn ? dateOnly(b.nextActionOn) : null
  }
  if (b.ownerUserId !== undefined) out.ownerUserId = str(b.ownerUserId, 40)
  if (b.clinicId !== undefined) out.clinicId = str(b.clinicId, 40)
  return { data: out }
}
