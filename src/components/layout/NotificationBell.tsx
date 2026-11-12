"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { NotificationList, type NotiItem, type NotiTab } from "./NotificationList"

// 헤더 종 아이콘 + 알림 패널(380px). 원장 대시보드와 직원 /work 헤더가 같이 쓴다.
// 직원·대표: [전체 | 처리 필요 | 읽지 않음] / 원장: [전체 | 읽지 않음]

const POLL_MS = 45 * 1000

export default function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<NotiTab>("all")
  const [unread, setUnread] = useState(0)
  const [action, setAction] = useState(0)
  const [internal, setInternal] = useState(false)
  const [items, setItems] = useState<NotiItem[]>([])
  const box = useRef<HTMLDivElement>(null)
  const tabRef = useRef<NotiTab>("all")
  tabRef.current = tab

  const load = useCallback(async (t: NotiTab = tabRef.current) => {
    try {
      const res = await fetch(`/api/notifications?limit=30&filter=${t}`, { cache: "no-store" })
      if (!res.ok) return
      const j = await res.json()
      setUnread(j.unread ?? 0)
      setAction(j.action ?? 0)
      setInternal(!!j.internal)
      setItems(j.items ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(() => load(), POLL_MS)
    const onVisible = () => { if (document.visibilityState === "visible") load() }
    const onFocus = () => load()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onFocus) }
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey) }
  }, [open])

  const patch = (ids?: string[]) =>
    fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ids ? { ids } : {}) }).catch(() => {})

  const markAll = async () => {
    await patch()
    setItems((xs) => (tab === "all" ? xs.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) : []))
    setUnread(0)
    setAction(0)
  }

  const markOne = (n: NotiItem) => {
    if (n.readAt) return
    patch([n.id])
    setItems((xs) => (tab === "all" ? xs.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) : xs.filter((x) => x.id !== n.id)))
    setUnread((u) => Math.max(0, u - 1))
    load()
  }

  const go = (n: NotiItem, href: string | null) => {
    markOne(n)
    setOpen(false)
    if (href) router.push(href)
  }

  const switchTab = (t: NotiTab) => { setTab(t); load(t) }
  const tabs: { k: NotiTab; label: string; n?: number }[] = internal
    ? [{ k: "all", label: "전체" }, { k: "action", label: "처리 필요", n: action }, { k: "unread", label: "읽지 않음", n: unread }]
    : [{ k: "all", label: "전체" }, { k: "unread", label: "읽지 않음", n: unread }]

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => { setOpen((v) => !v); if (!open) load() }}
        className="relative w-9 h-9 flex items-center justify-center rounded hover:bg-[#f2f2ef] text-[#6f6f6a] transition-colors"
        aria-label={unread ? `알림 ${unread}개 읽지 않음` : "알림"}
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#d92d20] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="알림" className="absolute right-0 mt-2 w-[380px] max-w-[calc(100vw-24px)] bg-white rounded border border-[#d1d1cc] shadow-[0_8px_24px_rgb(0_0_0/0.10)] z-50 overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <div className="text-[15px] font-bold text-[#191f28]">
              알림 {unread > 0 && <span className="text-[#d92d20] tabular-nums">{unread}</span>}
            </div>
            {unread > 0 && <button onClick={markAll} className="text-[12px] text-[#6f6f6a] hover:text-[#191f28]">모두 읽음</button>}
          </div>
          <div className="px-4 flex gap-4 border-b border-[#d1d1cc] text-[13px]" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.k}
                role="tab"
                aria-selected={tab === t.k}
                onClick={() => switchTab(t.k)}
                className={`py-2 -mb-px border-b-2 ${tab === t.k ? "border-[#0062ff] text-[#191f28] font-semibold" : "border-transparent text-[#6f6f6a] hover:text-[#191f28]"}`}
              >
                {t.label}
                {!!t.n && <span className="ml-1 tabular-nums text-[#8a8a84]">{t.n > 99 ? "99+" : t.n}</span>}
              </button>
            ))}
          </div>
          <div className="max-h-[440px] overflow-y-auto">
            <NotificationList items={items} tab={tab} onOpen={go} onRead={markOne} compact />
          </div>
          {internal && (
            <button onClick={() => { setOpen(false); router.push("/work/notifications") }} className="w-full py-2.5 text-[13px] text-[#0062ff] border-t border-[#d1d1cc] hover:bg-[#f2f2ef]">
              모든 알림 보기
            </button>
          )}
        </div>
      )}
    </div>
  )
}
