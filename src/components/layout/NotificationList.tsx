"use client"

import { primaryAction, type Priority } from "@/lib/work/notify/priority"

// 알림 목록(종 패널·전체 알림 화면 공용): 오늘/어제/이전 묶음, 같은 날 안에서는 등급 → 최신 순.

export type NotiItem = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  clinicId: string | null
  clinicName?: string | null
  priority: Priority
  readAt: string | null
  createdAt: string
}
export type NotiTab = "all" | "action" | "unread"

const KST = 9 * 3600_000
const kstDay = (iso: string | number) => new Date(new Date(iso).getTime() + KST).toISOString().slice(0, 10)

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "방금"
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const dt = new Date(new Date(iso).getTime() + KST)
  const w = "일월화수목금토"[dt.getUTCDay()]
  return `${dt.getUTCMonth() + 1}.${dt.getUTCDate()}(${w})`
}


export function groupByDay(items: NotiItem[]) {
  const today = kstDay(Date.now())
  const yesterday = kstDay(Date.now() - 86400_000)
  const sorted = [...items].sort((a, b) => {
    const da = kstDay(a.createdAt), db = kstDay(b.createdAt)
    if (da !== db) return da < db ? 1 : -1
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.createdAt < b.createdAt ? 1 : -1
  })
  const groups: { label: string; items: NotiItem[] }[] = [
    { label: "오늘", items: [] },
    { label: "어제", items: [] },
    { label: "이전", items: [] },
  ]
  for (const n of sorted) {
    const d = kstDay(n.createdAt)
    groups[d === today ? 0 : d === yesterday ? 1 : 2].items.push(n)
  }
  return groups.filter((g) => g.items.length)
}

const EMPTY: Record<NotiTab, string> = { all: "알림이 없습니다", action: "처리할 알림이 없습니다", unread: "읽지 않은 알림이 없습니다" }

export function NotificationList({
  items,
  tab,
  onOpen,
  onRead,
  compact = false,
}: {
  items: NotiItem[]
  tab: NotiTab
  onOpen: (n: NotiItem, href: string | null) => void
  onRead: (n: NotiItem) => void
  compact?: boolean
}) {
  if (!items.length) return <div className="px-4 py-10 text-center text-[13px] text-[#8a8a84]">{EMPTY[tab]}</div>
  return (
    <div>
      {groupByDay(items).map((g) => (
        <section key={g.label}>
          <div className={`px-4 ${compact ? "pt-2.5 pb-1" : "pt-3 pb-1.5"} text-[12px] font-medium text-[#8a8a84]`}>{g.label}</div>
          {g.items.map((n) => {
            const act = primaryAction(n)
            const sub = [n.clinicName, n.body].filter(Boolean).join(" · ")
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(n, n.link ?? act?.href ?? null)}
                onKeyDown={(e) => { if (e.key === "Enter") onOpen(n, n.link ?? act?.href ?? null) }}
                className={`group relative px-4 py-2.5 flex items-start gap-2.5 border-b border-[#ecece9] last:border-0 cursor-pointer hover:bg-[#f7f7f5] ${n.readAt ? "" : "bg-[#f5f9ff]"}`}
              >
                <span className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${n.readAt ? "bg-transparent" : n.priority === 0 ? "bg-[#d92d20]" : "bg-[#0062ff]"}`} title={n.readAt ? undefined : n.priority === 0 ? "긴급" : "읽지 않음"} />
                <div className="min-w-0 flex-1">
                  <div className={`text-[13px] leading-snug ${n.readAt ? "text-[#4e5968]" : "text-[#191f28] font-semibold"} ${n.priority === 0 && !n.readAt ? "text-[#d92d20]" : ""}`}>{n.title}</div>
                  {sub && <div className={`text-[12px] text-[#6f6f6a] mt-0.5 whitespace-pre-line ${compact ? "line-clamp-2" : "line-clamp-4"}`}>{sub}</div>}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[11px] text-[#8a8a84] tabular-nums">{timeAgo(n.createdAt)}</span>
                    {act && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpen(n, act.href) }}
                        className="h-6 px-2 rounded border border-[#d1d1cc] bg-white text-[12px] text-[#191f28] hover:border-[#0062ff] hover:text-[#0062ff]"
                      >
                        {act.label}
                      </button>
                    )}
                  </div>
                </div>
                {!n.readAt && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRead(n) }}
                    className="absolute right-3 top-2.5 h-6 px-2 rounded text-[12px] text-[#6f6f6a] bg-white border border-[#d1d1cc] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[#191f28]"
                  >
                    읽음
                  </button>
                )}
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
