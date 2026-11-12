"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Fragment, useEffect, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"
import { navForRole, findEntry, type NavChild, type NavEntry } from "./nav"

type Props = {
  clinicId: string
  userRole?: string
}

const CHILD_HEIGHT = 34
const FLYOUT_CHROME = 46 // 제목 줄 + 위아래 여백

export default function Sidebar({ clinicId, userRole }: Props) {
  const pathname = usePathname()
  const params = useSearchParams()
  const home = `/dashboard/${clinicId}`
  const current = pathname.startsWith(`${home}/`) ? pathname.slice(home.length).split("/")[1] : ""
  const activeEntry = findEntry(current)

  const [open, setOpen] = useState<{ entry: NavEntry; top: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)

  // 화면을 옮기면 닫는다
  useEffect(() => setOpen(null), [pathname])

  // 바깥을 누르거나 Esc 를 누르면 닫는다
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // 보고 있던 연·월은 메뉴를 옮겨도 유지한다
  const year = params.get("year")
  const month = params.get("month")
  const query = year && month ? `?year=${year}&month=${month}` : ""

  const childHref = (c: NavChild) => c.href ?? `${home}/${c.segment}${query}`
  const groups = navForRole(userRole)

  const toggle = (entry: NavEntry, button: HTMLElement) => {
    if (open?.entry === entry) {
      setOpen(null)
      return
    }
    const rect = button.getBoundingClientRect()
    const height = (entry.children?.length ?? 0) * CHILD_HEIGHT + FLYOUT_CHROME
    // 메뉴 높이만큼 아래가 모자라면 위로 올린다
    setOpen({ entry, top: Math.max(8, Math.min(rect.top, window.innerHeight - height - 8)) })
  }

  const itemClass = (highlight: boolean) =>
    `relative w-full flex flex-col items-center justify-center gap-1 h-[50px] px-0.5 ${
      highlight
        ? "bg-white text-[#0a0a0a] font-semibold shadow-[inset_2px_0_0_#0062ff]"
        : "text-[#3d3d3a] hover:bg-[#e0e0db] hover:text-[#0a0a0a]"
    }`

  return (
    <div ref={root} className="shrink-0 h-screen">
      <nav aria-label="주 메뉴" className="w-[76px] h-full bg-[#e9e9e5] border-r border-[#d1d1cc] flex flex-col">
        <div className="h-[52px] shrink-0 flex items-center justify-center border-b border-[#d1d1cc]">
          <i className="block w-[11px] h-[11px] rounded-[1px] bg-[#0062ff]" aria-hidden="true" />
        </div>
        <div className="flex-1 overflow-y-auto py-1" onScroll={() => setOpen(null)}>
          {groups.map((group, g) => (
            <Fragment key={g}>
              {g > 0 && <div className="mx-3 my-1 border-t border-[#d1d1cc]" />}
              {group.map((entry) => {
                const Icon = entry.icon
                const isOpen = open?.entry === entry
                const highlight = isOpen || (!open && entry === activeEntry)
                const inner = (
                  <>
                    <Icon className={`w-4 h-4 shrink-0 ${highlight ? "text-[#0062ff]" : "text-[#6f6f6a]"}`} aria-hidden="true" />
                    <span className="text-[11px] leading-none whitespace-nowrap">{entry.short}</span>
                  </>
                )
                if (entry.children) {
                  return (
                    <button
                      key={entry.label}
                      type="button"
                      title={entry.label}
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                      aria-current={entry === activeEntry ? "page" : undefined}
                      onClick={(e) => toggle(entry, e.currentTarget)}
                      className={itemClass(highlight)}
                    >
                      {inner}
                      <ChevronRight className="absolute right-0.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-[#9b9b95]" aria-hidden="true" />
                    </button>
                  )
                }
                return (
                  <Link
                    key={entry.label}
                    href={entry.segment ? `${home}/${entry.segment}${query}` : `${home}${query}`}
                    prefetch={false}
                    title={entry.label}
                    aria-current={entry === activeEntry ? "page" : undefined}
                    onClick={() => setOpen(null)}
                    className={itemClass(highlight)}
                  >
                    {inner}
                  </Link>
                )
              })}
            </Fragment>
          ))}
        </div>
      </nav>

      {/* 누른 메인 탭 바로 옆에 붙어서 열리는 세부 메뉴 */}
      {open?.entry.children && (
        <nav
          aria-label={`${open.entry.label} 세부 메뉴`}
          style={{ top: open.top }}
          className="fixed left-[76px] z-50 w-[172px] bg-white border border-[#d1d1cc] rounded-r shadow-[0_6px_18px_rgb(0_0_0/0.12)] py-1"
        >
          <div className="px-3.5 py-1.5 text-[11px] font-semibold text-[#6f6f6a] truncate">{open.entry.label}</div>
          {open.entry.children.map((child) => {
            const active = !!child.segment && child.segment === current
            return (
              <Link
                key={child.label}
                href={childHref(child)}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(null)}
                className={`flex items-center px-3.5 h-[34px] text-[13px] ${
                  active
                    ? "font-semibold text-[#0062ff] bg-[#e8f0ff]"
                    : "text-[#222220] hover:bg-[#f2f2ef] hover:text-[#0a0a0a]"
                }`}
              >
                <span className="truncate">{child.label}</span>
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
