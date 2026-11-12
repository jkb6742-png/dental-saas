"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { NotificationList, type NotiItem, type NotiTab } from "@/components/layout/NotificationList"
import { btnLine, card } from "../ui"

// 전체 알림: 필터(전체·처리 필요·읽지 않음) + 쪽 넘김
const PAGE = 30

export default function NotificationsClient() {
  const router = useRouter()
  const [tab, setTab] = useState<NotiTab>("all")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ items: NotiItem[]; total: number; unread: number; action: number } | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/notifications?limit=${PAGE}&filter=${tab}&page=${page}`, { cache: "no-store" }).catch(() => null)
    if (!r?.ok) return
    const j = await r.json()
    setData({ items: j.items ?? [], total: j.total ?? 0, unread: j.unread ?? 0, action: j.action ?? 0 })
  }, [tab, page])

  useEffect(() => {
    load()
    const t = setInterval(load, 45_000)
    window.addEventListener("focus", load)
    return () => { clearInterval(t); window.removeEventListener("focus", load) }
  }, [load])

  const patch = async (ids?: string[]) => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ids ? { ids } : {}) }).catch(() => {})
    load()
  }
  const onRead = (n: NotiItem) => { if (!n.readAt) patch([n.id]) }
  const onOpen = (n: NotiItem, href: string | null) => {
    if (!n.readAt) patch([n.id])
    if (href) router.push(href)
  }

  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE))
  const tabs: { k: NotiTab; label: string; n?: number }[] = [
    { k: "all", label: "전체" },
    { k: "action", label: "처리 필요", n: data?.action },
    { k: "unread", label: "읽지 않음", n: data?.unread },
  ]

  return (
    <div className="space-y-3 max-w-[760px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold">알림</h1>
        <div className="flex items-center gap-2">
          {!!data?.unread && <button className={btnLine} onClick={() => patch()}>모두 읽음</button>}
          <Link href="/work/settings" className="text-[13px] text-[#0062ff]">알림 설정</Link>
        </div>
      </div>
      <div className={`${card} overflow-hidden`}>
        <div className="px-4 flex gap-5 border-b border-[#d1d1cc] text-[14px]" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.k}
              role="tab"
              aria-selected={tab === t.k}
              onClick={() => { setTab(t.k); setPage(1) }}
              className={`py-2.5 -mb-px border-b-2 ${tab === t.k ? "border-[#0062ff] font-semibold text-[#191f28]" : "border-transparent text-[#6f6f6a] hover:text-[#191f28]"}`}
            >
              {t.label}
              {!!t.n && <span className="ml-1 tabular-nums text-[#8a8a84]">{t.n}</span>}
            </button>
          ))}
        </div>
        {data ? <NotificationList items={data.items} tab={tab} onOpen={onOpen} onRead={onRead} /> : <div className="px-4 py-10 text-[13px] text-[#8a8a84]">불러오는 중</div>}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-[13px]">
          <button className={btnLine} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>이전</button>
          <span className="tabular-nums text-[#6f6f6a]">{page} / {pages}</span>
          <button className={btnLine} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>다음</button>
        </div>
      )}
    </div>
  )
}
