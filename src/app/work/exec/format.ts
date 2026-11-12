// 금액 표시: 만원 단위(3,250만). 1만 원 미만은 원 단위.
export function man(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-"
  if (n === 0) return "0"
  const sign = n < 0 ? "-" : ""
  const a = Math.abs(n)
  if (a < 10000) return `${sign}${a.toLocaleString("ko-KR")}원`
  const v = a / 10000
  return `${sign}${(v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString("ko-KR")}만`
}

const WD = ["일", "월", "화", "수", "목", "금", "토"]
/** "2026-11-18" → "11.18(수)" */
export function md(ymd: string) {
  const d = new Date(`${ymd}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}.${String(d.getUTCDate()).padStart(2, "0")}(${WD[d.getUTCDay()]})`
}

/** "2026-11" → "2026.11" */
export const monthDot = (m: string) => m.replace("-", ".")

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7)
}
