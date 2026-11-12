"use client"

import { useRef, useState } from "react"
import { signOut } from "next-auth/react"
import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import NotificationBell from "@/components/layout/NotificationBell"
import { workSectionLabel, type WorkNavEntry } from "./nav"
import CommandPalette from "./shell/CommandPalette"
import QuickAdd from "./shell/QuickAdd"
import ClockStatus from "./shell/ClockStatus"
import ShortcutHelp from "./shell/ShortcutHelp"
import { usePopover } from "./shell/store"

// 상단 바(52px): 왼쪽 경로(THINKLAB / 업무 / 현재 화면) · 가운데 통합 검색 · 오른쪽 빠른 추가·근무 상태·알림·이름 메뉴
export default function WorkHeader({ userName, isMaster, groups }: { userName: string; isMaster: boolean; groups: WorkNavEntry[][] }) {
  const path = usePathname()
  const search = useSearchParams().toString()
  return (
    <header className="h-[52px] shrink-0 bg-[#f2f2ef] border-b border-[#d1d1cc] grid grid-cols-[minmax(0,1fr)_minmax(0,360px)_auto] md:grid-cols-[minmax(0,1fr)_minmax(200px,360px)_minmax(0,1fr)] items-center gap-2 sm:gap-3 px-3 sm:px-4">
      <div className="flex items-center gap-2 min-w-0 text-[13px]">
        <span className="hidden lg:inline text-[13px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">THINKLAB</span>
        <span className="hidden lg:inline text-[#b9b9b3]" aria-hidden="true">/</span>
        <span className="hidden sm:inline text-[#555555]">업무</span>
        <span className="hidden sm:inline text-[#b9b9b3]" aria-hidden="true">/</span>
        <h1 className="font-semibold text-[#0a0a0a] truncate">{workSectionLabel(path, search)}</h1>
      </div>
      <div className="flex justify-center min-w-0">
        <CommandPalette groups={groups} />
      </div>
      <div className="flex items-center justify-end gap-1 min-w-0">
        <QuickAdd />
        <ClockStatus />
        <NotificationBell />
        <NameMenu userName={userName} isMaster={isMaster} />
      </div>
      <ShortcutHelp />
    </header>
  )
}

/** 이름 메뉴: 내 정보·알림 설정·관리자 화면(대표)·단축키·로그아웃 */
function NameMenu({ userName, isMaster }: { userName: string; isMaster: boolean }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  usePopover(box, open, () => setOpen(false))
  const item = "flex w-full items-center h-[34px] px-3 text-[13px] text-[#222220] hover:bg-[#f2f2ef] text-left"
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="h-8 flex items-center gap-1 px-2 rounded text-[12px] text-[#3d3d3a] hover:bg-[#e9e9e5] max-w-[140px]"
      >
        <span className="truncate">{userName}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#8a8a84]" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label="내 메뉴" className="absolute right-0 top-[38px] z-50 w-[180px] bg-white border border-[#d1d1cc] rounded shadow-[0_6px_18px_rgb(0_0_0/0.12)] py-1">
          <Link role="menuitem" href="/work/leave" prefetch={false} onClick={() => setOpen(false)} className={item}>내 정보</Link>
          <Link role="menuitem" href="/work/settings" prefetch={false} onClick={() => setOpen(false)} className={item}>알림 설정</Link>
          {isMaster && (
            <Link role="menuitem" href="/dashboard" prefetch={false} onClick={() => setOpen(false)} className={item}>관리자 화면</Link>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false)
              window.dispatchEvent(new Event("work:shortcuts"))
            }}
            className={item}
          >
            단축키 안내
          </button>
          <div className="my-1 border-t border-[#ecece9]" />
          <button role="menuitem" type="button" onClick={() => signOut({ callbackUrl: "/login" })} className={`${item} text-[#d92d20]`}>
            로그아웃
          </button>
        </div>
      )}
    </div>
  )
}
