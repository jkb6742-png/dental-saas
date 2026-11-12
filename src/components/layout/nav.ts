import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Stethoscope,
  MessageSquare,
  Wallet,
  MapPin,
  Megaphone,
  Star,
  FileText,
  Target,
  Inbox,
  Settings,
  type LucideIcon,
} from "lucide-react"

/** segment: /dashboard/<clinicId>/<segment>, href: 치과 밖 경로 */
export type NavChild = {
  label: string
  segment?: string
  href?: string
  /** 마스터 전용 묶음 안에서 직원(STAFF)에게도 보이는 항목 */
  staff?: boolean
}
export type NavEntry = {
  label: string
  /** 왼쪽 1단에 쓰는 짧은 이름 */
  short: string
  icon: LucideIcon
  segment?: string
  /** 있으면 2단에 세부 메뉴로 나온다 */
  children?: NavChild[]
  masterOnly?: boolean
}

/** 역할에 맞게 메뉴를 거른다. 직원은 마스터 전용 묶음에서 staff 표시 항목만 본다. */
export function navForRole(role: string | undefined): NavEntry[][] {
  if (role === "MASTER") return NAV_GROUPS
  const isStaff = role === "STAFF"
  return NAV_GROUPS.map((g) =>
    g.flatMap((e) => {
      if (!e.masterOnly) return [e]
      if (!isStaff) return []
      const children = (e.children ?? []).filter((c) => c.staff)
      return children.length ? [{ ...e, label: "직원", short: "직원", children }] : []
    })
  ).filter((g) => g.length)
}

/** 1단 메뉴. 묶음 사이에 구분선이 들어간다. */
export const NAV_GROUPS: NavEntry[][] = [
  [
    { label: "홈", short: "홈", icon: LayoutDashboard, segment: "" },
    {
      label: "매출·수납",
      short: "매출·수납",
      icon: TrendingUp,
      children: [
        { segment: "revenue", label: "매출 분석" },
        { segment: "collections", label: "수납·미수" },
      ],
    },
    {
      label: "환자 분석",
      short: "환자 분석",
      icon: Users,
      children: [
        { segment: "patients", label: "환자 통계" },
        { segment: "retention", label: "환자 유지" },
        { segment: "age", label: "연령별 분석" },
        { segment: "regions", label: "지역별 분석" },
      ],
    },
    {
      label: "진료·운영",
      short: "진료·운영",
      icon: Stethoscope,
      children: [
        { segment: "treatments", label: "진료항목" },
        { segment: "implants", label: "임플란트" },
        { segment: "operations", label: "진료 운영" },
      ],
    },
    { label: "상담·치료", short: "상담·치료", icon: MessageSquare, segment: "consultations" },
    { label: "비용·수익성", short: "비용·수익", icon: Wallet, segment: "profitability" },
  ],
  [
    { label: "내원경로", short: "내원경로", icon: MapPin, segment: "routes" },
    {
      label: "마케팅 성과",
      short: "마케팅",
      icon: Megaphone,
      children: [
        { segment: "naver-ads", label: "네이버 검색광고" },
        { segment: "site-leads", label: "홈페이지 문의" },
      ],
    },
    {
      label: "환자경험·평판",
      short: "환자경험",
      icon: Star,
      children: [
        { segment: "reviews", label: "온라인 리뷰" },
        { segment: "pei-survey", label: "PEI 설문" },
      ],
    },
    {
      label: "보고서·자료",
      short: "보고서",
      icon: FileText,
      children: [
        { segment: "reports", label: "보고서" },
        { segment: "files", label: "자료실" },
      ],
    },
    { label: "실행계획", short: "실행계획", icon: Target, segment: "action-plans" },
    { label: "에이전시 요청", short: "요청", icon: Inbox, segment: "requests" },
  ],
  [
    {
      label: "운영자",
      short: "운영자",
      icon: Settings,
      masterOnly: true,
      children: [
        { href: "/work", label: "직원 업무", staff: true },
        { segment: "excel-upload", label: "엑셀 업로드", staff: true },
        { segment: "data-check", label: "데이터 점검", staff: true },
        { segment: "database", label: "데이터베이스 관리" },
        { href: "/admin/users", label: "사용자 관리" },
        { href: "/work/staff", label: "직원 관리" },
        { href: "/admin/invite-codes", label: "초대 코드" },
        { href: "/admin/reset", label: "데이터 초기화" },
        { href: "/admin/clinics", label: "설정" },
      ],
    },
  ],
]

const allEntries = NAV_GROUPS.flat()

export function findEntry(segment: string) {
  return allEntries.find((e) => (e.children ? e.children.some((c) => c.segment === segment) : e.segment === segment))
}

/** 상단 경로 표시용 이름 */
export function sectionLabel(segment: string) {
  const entry = findEntry(segment)
  if (!entry) return segment === "pei" ? "PEI" : "홈"
  const child = entry.children?.find((c) => c.segment === segment)
  return child ? `${entry.label} / ${child.label}` : entry.label
}
