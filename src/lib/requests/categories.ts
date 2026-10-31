// 요청사항 카테고리 정의 (서버·클라이언트 공용, 브라우저 안전)

export type RequestCategory = "IMAGE" | "CONTENT" | "WEBSITE" | "REPORT" | "ADS" | "OTHER"
export type RequestStatus = "REQUESTED" | "IN_REVIEW" | "IN_PROGRESS" | "DONE" | "CANCELED"
export type RequestPriority = "HIGH" | "MEDIUM" | "LOW"

export type DetailField = {
  key: string
  label: string
  type: "text" | "textarea" | "select" | "date" | "url"
  placeholder?: string
  options?: string[]
  required?: boolean
  help?: string
}

export type CategoryDef = {
  key: RequestCategory
  label: string
  short: string
  description: string
  examples: string[]
  fields: DetailField[]
  /** 통상 처리 기간(일) — 희망일 기본값 계산용 */
  leadDays: number
}

export const REQUEST_CATEGORIES: CategoryDef[] = [
  {
    key: "IMAGE",
    label: "이미지·디자인 제작",
    short: "이미지",
    description: "블로그 썸네일, 인스타 카드뉴스, 배너, 원내 포스터 등 디자인물",
    examples: ["블로그 대표 이미지", "인스타그램 카드뉴스", "홈페이지 배너", "원내 안내 포스터", "이벤트 배너"],
    leadDays: 3,
    fields: [
      { key: "usage", label: "용도", type: "select", required: true, options: ["블로그 썸네일", "인스타그램 카드뉴스", "홈페이지 배너", "원내 포스터·안내문", "네이버 플레이스 이미지", "이벤트·프로모션", "기타"] },
      { key: "size", label: "사이즈·비율", type: "select", options: ["정사각형 (1:1, 인스타)", "가로형 (16:9, 블로그·배너)", "세로형 (4:5·9:16, 스토리·릴스)", "A4 인쇄용", "지정 사이즈(아래 기재)", "맡김"] },
      { key: "copy", label: "넣을 문구", type: "textarea", placeholder: "제목·부제·강조 문구를 적어 주세요. 예) 임플란트 상담 이벤트 / 10월 한정", help: "문구가 확정되지 않았으면 방향만 적어 주셔도 됩니다." },
      { key: "count", label: "필요 수량", type: "select", options: ["1장", "2~3장", "4~6장(카드뉴스)", "7장 이상"] },
      { key: "reference", label: "참고 링크", type: "url", placeholder: "참고할 이미지·게시물 URL (여러 개면 줄바꿈)" },
    ],
  },
  {
    key: "CONTENT",
    label: "블로그·칼럼·SNS 원고",
    short: "원고",
    description: "블로그 포스팅, 홈페이지 칼럼, 인스타·쓰레드 게시글 원고",
    examples: ["블로그 포스팅 주제 요청", "홈페이지 칼럼 추가", "SNS 게시글", "원고 수정"],
    leadDays: 5,
    fields: [
      { key: "channel", label: "채널", type: "select", required: true, options: ["네이버 블로그", "홈페이지 칼럼", "인스타그램", "쓰레드", "카카오 채널", "기타"] },
      { key: "topic", label: "주제·키워드", type: "text", required: true, placeholder: "예) 임플란트 식립 후 주의사항, 지역명+치아교정" },
      { key: "caseInfo", label: "증례·사진 제공 여부", type: "select", options: ["실제 케이스 사진 제공 가능", "사진 없음(정보형)", "추후 전달"] },
      { key: "tone", label: "원하는 방향", type: "textarea", placeholder: "강조할 내용, 피해야 할 표현, 참고 글 등" },
    ],
  },
  {
    key: "WEBSITE",
    label: "홈페이지 수정",
    short: "홈페이지",
    description: "진료시간·의료진·가격표·사진 교체 등 홈페이지 변경",
    examples: ["진료시간 변경", "의료진 소개 수정", "비용 안내 수정", "사진 교체", "팝업 등록"],
    leadDays: 2,
    fields: [
      { key: "pageUrl", label: "수정할 페이지 주소", type: "url", placeholder: "https://..." },
      { key: "changeType", label: "수정 종류", type: "select", required: true, options: ["문구 수정", "사진·이미지 교체", "진료시간·연락처 변경", "의료진 추가·변경", "팝업·공지 등록", "메뉴·페이지 추가", "오류 수정", "기타"] },
      { key: "before", label: "현재 내용", type: "textarea", placeholder: "지금 어떻게 되어 있는지" },
      { key: "after", label: "변경할 내용", type: "textarea", required: true, placeholder: "어떻게 바꿀지" },
    ],
  },
  {
    key: "REPORT",
    label: "보고서·데이터 요청",
    short: "보고서",
    description: "경영·PEI·블로그 보고서 추가 분석, 특정 기간 데이터 추출",
    examples: ["특정 월 재분석", "진료과목별 추가 분석", "환자 데이터 추출", "보고서 재발행"],
    leadDays: 5,
    fields: [
      { key: "reportType", label: "보고서 종류", type: "select", required: true, options: ["월간 경영 보고서", "PEI(환자경험) 보고서", "블로그·마케팅 보고서", "데이터 추출(엑셀)", "기타 분석"] },
      { key: "period", label: "대상 기간", type: "text", placeholder: "예) 2026년 7~9월" },
      { key: "question", label: "알고 싶은 내용", type: "textarea", required: true, placeholder: "예) 임플란트 상담 동의율이 떨어진 원인" },
    ],
  },
  {
    key: "ADS",
    label: "광고·마케팅",
    short: "광고",
    description: "네이버 검색광고·플레이스·SNS 광고 집행, 예산 변경, 이벤트 기획",
    examples: ["검색광고 키워드 추가", "예산 조정", "이벤트 기획", "플레이스 정보 수정", "리뷰 답글"],
    leadDays: 3,
    fields: [
      { key: "medium", label: "매체", type: "select", required: true, options: ["네이버 검색광고", "네이버 플레이스", "인스타그램·페이스북 광고", "구글 광고", "유튜브", "오프라인·기타"] },
      { key: "action", label: "요청 종류", type: "select", options: ["신규 집행", "예산 변경", "키워드·타깃 변경", "소재 교체", "중단", "이벤트 기획", "기타"] },
      { key: "budget", label: "예산(월)", type: "text", placeholder: "예) 150만원" },
      { key: "period", label: "집행 기간", type: "text", placeholder: "예) 11월 1일~30일" },
    ],
  },
  {
    key: "OTHER",
    label: "기타 문의",
    short: "기타",
    description: "위 항목에 없는 요청이나 궁금한 점",
    examples: ["미팅 요청", "계약·정산 문의", "제안·아이디어"],
    leadDays: 3,
    fields: [],
  },
]

export const CATEGORY_MAP: Record<RequestCategory, CategoryDef> = Object.fromEntries(
  REQUEST_CATEGORIES.map((c) => [c.key, c])
) as Record<RequestCategory, CategoryDef>

export const STATUS_META: Record<RequestStatus, { label: string; color: "gray" | "blue" | "yellow" | "green" | "red"; order: number }> = {
  REQUESTED: { label: "접수", color: "gray", order: 0 },
  IN_REVIEW: { label: "검토중", color: "yellow", order: 1 },
  IN_PROGRESS: { label: "진행중", color: "blue", order: 2 },
  DONE: { label: "완료", color: "green", order: 3 },
  CANCELED: { label: "취소", color: "red", order: 4 },
}

export const PRIORITY_META: Record<RequestPriority, { label: string; color: "red" | "yellow" | "gray" }> = {
  HIGH: { label: "긴급", color: "red" },
  MEDIUM: { label: "보통", color: "yellow" },
  LOW: { label: "여유", color: "gray" },
}

export const OPEN_STATUSES: RequestStatus[] = ["REQUESTED", "IN_REVIEW", "IN_PROGRESS"]

export const MAX_FILES = 5
export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "application/zip", "application/x-zip-compressed", "application/vnd", "application/msword", "text/plain", "video/"]
