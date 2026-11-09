"use client"

import { signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronsUpDown, LogOut } from "lucide-react"
import NotificationBell from "./NotificationBell"
import { sectionLabel } from "./nav"

type Props = {
  userName: string
  pageTitle: string
  canSwitchClinic?: boolean
}

export default function Header({ userName, pageTitle, canSwitchClinic }: Props) {
  const pathname = usePathname()
  // /dashboard/<clinicId>/<section>
  const section = sectionLabel(pathname.split("/")[3] ?? "")

  return (
    <header className="h-[52px] shrink-0 bg-[#f2f2ef] border-b border-[#d1d1cc] flex items-center justify-between px-4">
      <div className="flex items-center gap-2 min-w-0 text-[13px]">
        <span className="hidden sm:inline text-[13px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">THINKLAB</span>
        <span className="hidden sm:inline text-[#b9b9b3]" aria-hidden="true">/</span>
        {canSwitchClinic ? (
          <Link
            href="/dashboard"
            title="다른 치과로 변경"
            className="inline-flex items-center gap-1 text-[#555555] hover:text-[#0062ff] truncate"
          >
            <span className="truncate">{pageTitle}</span>
            <ChevronsUpDown className="w-3 h-3 shrink-0" aria-hidden="true" />
          </Link>
        ) : (
          <span className="text-[#555555] truncate">{pageTitle}</span>
        )}
        <span className="text-[#b9b9b3]" aria-hidden="true">/</span>
        <h1 className="font-semibold text-[#0a0a0a] truncate">{section}</h1>
      </div>

      <div className="flex items-center gap-1">
        <NotificationBell />
        <span className="px-2 text-[12px] text-[#555555]">{userName}</span>
        <button
          type="button"
          aria-label="로그아웃"
          title="로그아웃"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-8 h-8 flex items-center justify-center rounded text-[#6f6f6a] hover:bg-[#e9e9e5] hover:text-[#e0383b]"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
