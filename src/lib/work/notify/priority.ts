// 알림 등급 P0~P3 (스키마 변경 없이 종류 + 제목 낱말로 정한다). 서버·브라우저 공용 — prisma 를 불러오지 말 것.
//  P0 긴급: 마감 지남, 검수 수정 요청(반려), 입금 예정일 지남 → 앱 즉시 + 메일 즉시(조용한 시간 제외) + 근무 2시간 미확인 시 1회 재알림
//  P1 중요: 검수 요청, 멘션, 오늘 마감, 연차 승인 요청, 결제 D-3·당일, 원장 요청 → 앱 즉시 + 하루 요약 메일
//  P2 일반: 업무 배정, 일정 초대·변경, 연차 결과, 요청 상태 → 앱만(메일 기본 끔)
//  P3 정보: 댓글, 파일, 발행 기록, 월 마감, 보고서 → 수신함만

export type Priority = 0 | 1 | 2 | 3

export const PRIORITY_LABEL: Record<Priority, string> = { 0: "긴급", 1: "중요", 2: "일반", 3: "정보" }

/** 종류별 기본 등급 */
export const TYPE_PRIORITY: Record<string, Priority> = {
  TASK_ASSIGNED: 2,
  TASK_REVIEW: 1,
  TASK_COMMENT: 3,
  BILLING_DUE: 1,
  LEAVE_REQUESTED: 1,
  LEAVE_DECIDED: 2,
  CHAT_MENTION: 1,
  REQUEST_NEW: 1,
  REQUEST_STATUS: 2,
  REQUEST_COMMENT: 2,
  SITE_LEAD_NEW: 1,
  EVENT_INVITE: 2,
  SYSTEM: 2,
  NAVER_BIZMONEY: 1,
  NAVER_SYNC_FAIL: 1,
  NAVER_REPORT: 3,
  FILE_SHARED: 3,
  CONTENT_PUBLISHED: 3,
  MONTH_CLOSE: 3,
  DAILY_SUMMARY: 1,
}

/** 제목 낱말로 기본 등급을 바꾸는 규칙. 위에서부터 처음 맞는 것. */
export const KEYWORD_RULES: { type: string; kw: string; p: Priority }[] = [
  { type: "TASK_ASSIGNED", kw: "마감 지남", p: 0 },
  { type: "TASK_ASSIGNED", kw: "오늘 마감", p: 1 },
  { type: "TASK_REVIEW", kw: "수정 요청", p: 0 },
  { type: "TASK_REVIEW", kw: "반려", p: 0 },
  { type: "TASK_REVIEW", kw: "승인", p: 2 },
  { type: "BILLING_DUE", kw: "지남", p: 0 },
  { type: "BILLING_DUE", kw: "연체", p: 0 },
]

export function priorityOf(type: string, title = ""): Priority {
  for (const r of KEYWORD_RULES) if (r.type === type && title.includes(r.kw)) return r.p
  return TYPE_PRIORITY[type] ?? 3
}

/** 결정이 필요한 종류(등급과 무관하게 '처리 필요'에 넣는다) */
export const DECISION_TYPES = new Set(["LEAVE_REQUESTED", "TASK_REVIEW", "REQUEST_NEW"])

/** 안 읽은 알림이 '처리 필요'인지 */
export function needsAction(type: string, title = "") {
  if (type === "DAILY_SUMMARY") return false
  if (type === "TASK_REVIEW" && priorityOf(type, title) > 1) return false // 승인 결과는 알림일 뿐
  return priorityOf(type, title) <= 1 || DECISION_TYPES.has(type)
}

/** '처리 필요'를 DB 조건으로(읽지 않음 조건은 호출하는 쪽에서 붙인다) */
export function actionWhere() {
  const or: any[] = []
  const typesSeen = new Set<string>([...Object.keys(TYPE_PRIORITY), ...KEYWORD_RULES.map((r) => r.type)])
  for (const type of typesSeen) {
    if (type === "DAILY_SUMMARY") continue
    const base = TYPE_PRIORITY[type] ?? 3
    const rules = KEYWORD_RULES.filter((r) => r.type === type)
    const baseOk = base <= 1 || (DECISION_TYPES.has(type) && type !== "TASK_REVIEW")
    const lower = rules.filter((r) => r.p > 1).map((r) => r.kw)
    if (baseOk) or.push(lower.length ? { type, NOT: lower.map((kw) => ({ title: { contains: kw } })) } : { type })
    for (const r of rules) if (r.p <= 1) or.push({ type, title: { contains: r.kw } })
  }
  return { OR: or }
}

/** 메일 정책: P0 즉시, P1 하루 요약에 포함, P2·P3 메일 없음 */
export const emailNow = (p: Priority) => p === 0

/** 항목의 바로 처리 버튼 */
export function primaryAction(n: { type: string; title: string; link: string | null }): { label: string; href: string } | null {
  switch (n.type) {
    case "LEAVE_REQUESTED":
      return { label: "연차 승인", href: "/work/leave" }
    case "BILLING_DUE":
      return { label: "결제 확인", href: n.link?.startsWith("/work/billing") ? n.link : "/work/billing" }
    case "TASK_REVIEW":
      return n.link ? { label: "검수", href: n.link } : null
    case "TASK_ASSIGNED":
    case "TASK_COMMENT":
      return n.link ? { label: "업무 열기", href: n.link } : null
    case "DAILY_SUMMARY":
      return { label: "오늘 보기", href: n.link ?? "/work/today" }
    case "REQUEST_NEW":
    case "REQUEST_COMMENT":
    case "REQUEST_STATUS":
      return n.link ? { label: "요청 보기", href: n.link } : null
    default:
      return n.link ? { label: "열기", href: n.link } : null
  }
}
