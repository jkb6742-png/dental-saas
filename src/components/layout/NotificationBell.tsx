"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Wallet, AlertTriangle, FileText, Inbox, MessageSquare, CheckCheck, Info } from "lucide-react"

type Item = { id: string; type: string; title: string; body: string | null; link: string | null; clinicId: string | null; readAt: string | null; createdAt: string }

const POLL_MS = 60 * 1000

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "방금"
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}일 전`
  const dt = new Date(new Date(iso).getTime() + 9 * 3600 * 1000)
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`
}

function Icon({ type }: { type: string }) {
  const cls = "w-4 h-4"
  switch (type) {
    case "NAVER_BIZMONEY": return <Wallet className={`${cls} text-[#b45309]`} />
    case "NAVER_SYNC_FAIL": return <AlertTriangle className={`${cls} text-[#f04452]`} />
    case "NAVER_REPORT": return <FileText className={`${cls} text-[#0062ff]`} />
    case "REQUEST_NEW": return <Inbox className={`${cls} text-[#0062ff]`} />
    case "REQUEST_STATUS": return <CheckCheck className={`${cls} text-[#05c072]`} />
    case "REQUEST_COMMENT": return <MessageSquare className={`${cls} text-[#6b7684]`} />
    case "SITE_LEAD_NEW": return <Inbox className={`${cls} text-[#05c072]`} />
    default: return <Info className={`${cls} text-[#8b95a1]`} />
  }
}

export default function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<Item[]>([])
  const box = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=30", { cache: "no-store" })
      if (!res.ok) return
      const j = await res.json()
      setUnread(j.unread ?? 0)
      setItems(j.items ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    const onVisible = () => { if (document.visibilityState === "visible") load() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible) }
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const markAll = async () => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
    setItems((xs) => xs.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })))
    setUnread(0)
  }

  const openItem = async (n: Item) => {
    if (!n.readAt) {
      fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) })
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
      setUnread((u) => Math.max(0, u - 1))
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => { setOpen((v) => !v); if (!open) load() }}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#f2f2ef] text-[#6b7684] transition-colors"
        aria-label="알림"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#f04452] text-white text-[10px] font-bold flex items-center justify-center">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0_0_0/0.12)] border border-[#e0e0db] z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e0e0db] flex items-center justify-between">
            <div className="text-[14px] font-bold text-[#191f28]">알림 {unread > 0 && <span className="text-[#f04452]">{unread}</span>}</div>
            {unread > 0 && <button onClick={markAll} className="text-[12px] text-[#6b7684] hover:text-[#191f28]">모두 읽음</button>}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px] text-[#8b95a1]">알림이 없습니다</div>
            ) : (
              items.map((n) => (
                <button key={n.id} onClick={() => openItem(n)} className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-[#f7f8fa] last:border-0 hover:bg-[#f2f2ef] ${n.readAt ? "" : "bg-[#f5f9ff]"}`}>
                  <div className="mt-0.5 w-7 h-7 rounded-lg bg-[#f2f4f6] flex items-center justify-center shrink-0"><Icon type={n.type} /></div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13px] leading-snug ${n.readAt ? "text-[#4e5968]" : "text-[#191f28] font-semibold"}`}>{n.title}</div>
                    {n.body && <div className="text-[12px] text-[#8b95a1] mt-0.5 line-clamp-2">{n.body}</div>}
                    <div className="text-[11px] text-[#b0b8c1] mt-1">{timeAgo(n.createdAt)}</div>
                  </div>
                  {!n.readAt && <span className="mt-2 w-2 h-2 rounded-full bg-[#0062ff] shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
