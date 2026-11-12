// 치과 월 상태(정상 / 주의 / 위험) + 사유 문구. 목록·상세가 같은 기준을 쓴다.
//
// 기대 진도 = 이 달에서 지난 날 비율(지난달=1, 다음달=0).
// 부족폭 = 기대 진도 - 실제 이행률(계약 분량 합, 항목별 목표 초과분은 빼고 셈).
//  위험: 부족폭 ≥ 20%p, 3일 넘게 처리 안 된 원장 요청, 입금 연체(대표에게만)
//  주의: 부족폭 ≥ 10%p, 기한 지난 업무
//  정상: 그 밖

export type Level = "risk" | "warn" | "ok"
export const LEVEL_LABEL: Record<Level, string> = { risk: "위험", warn: "주의", ok: "정상" }
export const LEVEL_COLOR: Record<Level, string> = { risk: "#d92d20", warn: "#b54708", ok: "#1a7f37" }

type Q = { kind: string; label: string; target: number; done: number }

const unit = (kind: string) => (kind === "BLOG_POST" || kind === "WEBSITE_COLUMN" ? "편" : kind === "CLINIC_MEETING" ? "회" : "건")

/** 이 달 기대 진도(0~1) */
export function elapsedOf(month: string, today: string, daysInMonth: number) {
  const cur = today.slice(0, 7)
  if (month === cur) return Number(today.slice(8, 10)) / daysInMonth
  return month < cur ? 1 : 0
}

export function quotaPct(quota: Q[]) {
  const target = quota.reduce((s, q) => s + q.target, 0)
  const done = quota.reduce((s, q) => s + Math.min(q.done, q.target), 0)
  return { target, done, pct: target ? done / target : null }
}

export function clinicStatus(i: { quota: Q[]; elapsed: number; overdueTasks: number; lateRequests: number; billOverdue: boolean }) {
  const { pct } = quotaPct(i.quota)
  const gap = pct === null ? 0 : Math.max(0, i.elapsed - pct)
  const reasons: string[] = []
  // 항목별로 기대 수량보다 모자란 것
  for (const q of i.quota) {
    const expected = Math.round(q.target * i.elapsed)
    const short = Math.min(q.target, expected) - q.done
    if (short > 0 && gap >= 0.1) reasons.push(`${q.label} ${short}${unit(q.kind)} 부족`)
  }
  if (i.lateRequests > 0) reasons.push(`요청 ${i.lateRequests}건 지연`)
  if (i.overdueTasks > 0) reasons.push(`업무 ${i.overdueTasks}건 기한 지남`)
  if (i.billOverdue) reasons.push("입금 연체")
  const level: Level = gap >= 0.2 || i.lateRequests > 0 || i.billOverdue ? "risk" : gap >= 0.1 || i.overdueTasks > 0 ? "warn" : "ok"
  return { level, gap, reasons }
}
