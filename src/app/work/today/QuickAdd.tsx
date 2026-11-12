"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, StickyNote } from "lucide-react"

// 빠른 추가: 상단 바 QuickAdd 가 이 이벤트를 받아 연다(폼은 여기서 만들지 않는다).
type Kind = "task" | "event" | "memo"
export const quickAdd = (kind: Kind) => window.dispatchEvent(new CustomEvent("work:quick-add", { detail: { kind } }))

const quick = "h-8 px-2.5 inline-flex items-center gap-1 whitespace-nowrap rounded border border-[#d1d1cc] bg-white text-[13px] hover:bg-[#f2f2ef]"

export function QuickButtons() {
  return (
    <div className="flex items-center gap-1.5">
      <button className={quick} onClick={() => quickAdd("task")}>
        <Plus size={14} strokeWidth={1.75} /> 업무
      </button>
      <button className={quick} onClick={() => quickAdd("event")}>
        <Plus size={14} strokeWidth={1.75} /> 일정
      </button>
      <button className={quick} onClick={() => quickAdd("memo")}>
        <StickyNote size={14} strokeWidth={1.75} /> 메모
      </button>
    </div>
  )
}

export function QuickAddLink({ kind, children, className = "" }: { kind: Kind; children: React.ReactNode; className?: string }) {
  return (
    <button onClick={() => quickAdd(kind)} className={`text-[#0062ff] hover:underline ${className}`}>
      {children}
    </button>
  )
}

/** 근태·승인은 45초마다, 탭으로 돌아오면 즉시 새로 그린다(진행률은 서버에서 5분 캐시). */
export function AutoRefresh({ ms = 45_000 }: { ms?: number }) {
  const router = useRouter()
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh()
    }
    const id = setInterval(tick, ms)
    document.addEventListener("visibilitychange", tick)
    window.addEventListener("focus", tick)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", tick)
      window.removeEventListener("focus", tick)
    }
  }, [router, ms])
  return null
}
