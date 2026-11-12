import { Home, ListChecks, CalendarDays, Building2, FolderOpen, Clock, Briefcase, type LucideIcon } from "lucide-react"

// 직원 화면 메뉴(2026-11-12 개편). 왼쪽 1단 레일(홈·업무·일정·치과·자료·사내·경영) + 옆에 겹쳐 열리는 2단 패널(240px).
// masterOnly 는 대표에게만 보인다. 아이콘은 서버→클라이언트로 넘길 수 없어 이름(key)으로 둔다.
// 메신저는 쓰지 않기로 함(2026-11-12). 화면·자료는 남겨 둠: /work/messages
export type WorkNavChild = { href: string; label: string; masterOnly?: boolean }
/** 2단 패널 아래쪽에 붙는 묶음: 고정한 치과 / 최근 본 항목 / 치과 목록(별표 고정) */
export type WorkNavExtra = "pins" | "recent" | "clinics"
export type WorkNavEntry = {
  label: string
  short: string
  icon: WorkIconKey
  href?: string
  badge?: "chat"
  children?: WorkNavChild[]
  extras?: WorkNavExtra[]
  masterOnly?: boolean
}

export const WORK_ICONS = { Home, ListChecks, CalendarDays, Building2, FolderOpen, Clock, Briefcase } satisfies Record<string, LucideIcon>
export type WorkIconKey = keyof typeof WORK_ICONS

export const WORK_NAV: WorkNavEntry[][] = [
  [
    {
      label: "홈",
      short: "홈",
      icon: "Home",
      children: [{ href: "/work/today", label: "내 대시보드" }],
      extras: ["pins", "recent"],
    },
    {
      label: "업무",
      short: "업무",
      icon: "ListChecks",
      children: [
        { href: "/work/tasks?assignee=me", label: "내 업무" },
        { href: "/work/tasks", label: "전체 업무" },
        { href: "/work/board", label: "업무 보드" },
        { href: "/work/tasks?view=timeline", label: "타임라인" },
      ],
      extras: ["pins", "recent"],
    },
    {
      label: "일정",
      short: "일정",
      icon: "CalendarDays",
      children: [
        { href: "/work/calendar", label: "통합 달력" },
        { href: "/work/calendar?view=week", label: "주간" },
        { href: "/work/calendar?view=people", label: "사람별" },
        { href: "/work/calendar?kind=EVENT", label: "미팅 일정" },
        { href: "/work/calendar?kind=LEAVE", label: "연차 일정" },
        { href: "/work/calendar?kind=PAYMENT", label: "결제 일정", masterOnly: true },
      ],
    },
  ],
  [
    {
      label: "치과",
      short: "치과",
      icon: "Building2",
      children: [
        { href: "/work/clinics", label: "치과 목록·월 현황" },
        { href: "/work/content", label: "발행 기록" },
        { href: "/work/imports", label: "PMS 자료" },
      ],
      extras: ["pins", "clinics", "recent"],
    },
    {
      label: "자료",
      short: "자료",
      icon: "FolderOpen",
      children: [
        { href: "/work/images", label: "이미지 폴더함" },
        { href: "/work/files", label: "공유 파일" },
        { href: "/work/files?sort=recent", label: "최근 파일" },
        { href: "/work/accounts", label: "계정 관리" },
      ],
    },
    {
      label: "사내",
      short: "사내",
      icon: "Clock",
      children: [
        { href: "/work/attendance", label: "내 근태" },
        { href: "/work/attendance?view=team", label: "팀 근태", masterOnly: true },
        { href: "/work/attendance?tab=overtime", label: "추가근무" },
        { href: "/work/leave", label: "연차 신청·내역" },
        { href: "/work/calendar?kind=LEAVE&team=1", label: "팀 연차 현황" },
      ],
    },
  ],
  [
    {
      label: "경영",
      short: "경영",
      icon: "Briefcase",
      masterOnly: true,
      children: [
        { href: "/work/exec", label: "경영 대시보드" },
        { href: "/work/staff", label: "직원 관리" },
        { href: "/work/presence", label: "근태 설정" },
        { href: "/work/leave?approve=1", label: "연차 승인" },
        { href: "/work/contracts", label: "계약" },
        { href: "/work/billing", label: "청구·입금" },
        { href: "/work/sales", label: "영업" },
      ],
    },
  ],
]

/** 그 밖의 화면 이름(메뉴에 없는 화면도 경로 표시용으로) */
const OTHER_PAGES: WorkNavChild[] = [{ href: "/work/settings", label: "알림 설정" }]

export function workNavFor(isMaster: boolean): WorkNavEntry[][] {
  return WORK_NAV.map((g) =>
    g
      .filter((e) => !e.masterOnly || isMaster)
      .map((e) => (e.children ? { ...e, children: e.children.filter((c) => !c.masterOnly || isMaster) } : e))
      .filter((e) => !e.children || e.children.length)
  ).filter((g) => g.length)
}

/** href 를 경로·쿼리로 나눈다 */
function splitHref(href: string) {
  const [p, q = ""] = href.split("?")
  return { p, q: new URLSearchParams(q) }
}

/**
 * 현재 주소(path + search)가 이 메뉴 항목에 해당하는지 점수로 돌려준다(0 = 아님).
 * 쿼리까지 맞는 항목이 쿼리 없는 항목보다 높다.
 */
export function hrefScore(href: string, path: string, search = ""): number {
  const { p, q } = splitHref(href)
  if (!(path === p || path.startsWith(`${p}/`))) return 0
  const cur = new URLSearchParams(search)
  for (const [k, v] of q) if (cur.get(k) !== v) return 0
  return 1 + [...q].length + (path === p ? 0.5 : 0)
}

/** 지금 화면에 가장 잘 맞는 하위 메뉴 하나 */
export function bestChild(groups: WorkNavEntry[][], path: string, search = ""): { entry: WorkNavEntry; child: WorkNavChild } | undefined {
  let best: { entry: WorkNavEntry; child: WorkNavChild; s: number } | undefined
  for (const e of groups.flat())
    for (const c of e.children ?? []) {
      const s = hrefScore(c.href, path, search)
      if (s && (!best || s > best.s)) best = { entry: e, child: c, s }
    }
  return best
}

export function findWorkEntry(groups: WorkNavEntry[][], path: string, search = ""): WorkNavEntry | undefined {
  return bestChild(groups, path, search)?.entry ?? groups.flat().find((e) => e.href && hrefScore(e.href, path, search))
}

/** 상단 경로에 쓰는 현재 화면 이름 */
export function workSectionLabel(path: string, search = ""): string {
  const hit = bestChild(WORK_NAV, path, search)
  if (hit) return hit.child.label
  const other = OTHER_PAGES.find((c) => hrefScore(c.href, path, search))
  return other?.label ?? "업무"
}

/** 단축키 Alt+1~7 순서와 같은 1단 메뉴 순서 */
export const flatEntries = (groups: WorkNavEntry[][]) => groups.flat()
