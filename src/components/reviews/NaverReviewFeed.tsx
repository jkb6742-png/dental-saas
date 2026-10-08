"use client"

import { useEffect, useState } from "react"
import { RefreshCw, Copy, Check, ExternalLink } from "lucide-react"
import SectionCard from "@/components/ui/SectionCard"

interface FeedReview {
  id: string
  reviewId: string
  authorName: string | null
  content: string | null
  reviewDate: string | null
  originType: string | null
  reply: string | null
  replyDate: string | null
  isPositive: boolean | null
  keywords: { sentiment?: string; topics?: string[]; issue?: string | null } | null
  replyDraft: string | null
  analyzedAt: string | null
}

interface FeedData {
  config: { placeId: string | null; placeName: string | null; lastSyncAt: string | null } | null
  snapshot: { visitorTotal: number; blogTotal: number | null; takenAt: string } | null
  counts: { collected: number; unreplied: number; negative: number } | null
  reviews: FeedReview[]
}

type Filter = "all" | "unreplied" | "negative"

const SENTIMENT = {
  positive: { label: "긍정", cls: "bg-[#e8f7f0] text-[#05a660]" },
  neutral: { label: "보통", cls: "bg-[#f2f4f6] text-[#6b7684]" },
  negative: { label: "부정", cls: "bg-[#fdecec] text-[#e5484d]" },
} as const

function fmtDate(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "2-digit", month: "numeric", day: "numeric" })
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "아직 없음"
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function NaverReviewFeed({ clinicId, userRole }: { clinicId: string; userRole: string }) {
  const [data, setData] = useState<FeedData | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [placeInput, setPlaceInput] = useState("")
  const [copied, setCopied] = useState<string | null>(null)
  const isMaster = userRole === "MASTER"

  const load = async (f: Filter = filter) => {
    const res = await fetch(`/api/reviews/list?clinicId=${clinicId}&filter=${f}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    load(filter)
  }, [clinicId, filter])

  const syncNow = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/reviews/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, source: "NAVER" }),
      })
      const body = await res.json()
      if (!res.ok) alert(body.error || "수집 실패")
      await load()
    } finally {
      setSyncing(false)
    }
  }

  const savePlace = async () => {
    if (!placeInput.trim()) return
    const res = await fetch("/api/reviews/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId, source: "NAVER", placeUrl: placeInput.trim() }),
    })
    const body = await res.json()
    if (!res.ok) {
      alert(body.error || "저장 실패")
      return
    }
    setPlaceInput("")
    await syncNow()
  }

  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  if (loading) return <div className="text-center py-8 text-[13px] text-[#8b95a1]">네이버 리뷰를 불러오는 중...</div>

  if (!data?.config) {
    return (
      <SectionCard title="네이버 리뷰 자동 수집" description="플레이스를 연결하면 하루 3번 새 리뷰를 가져오고, 답글 초안을 만들어 둡니다">
        {isMaster ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={placeInput}
              onChange={(e) => setPlaceInput(e.target.value)}
              placeholder="https://m.place.naver.com/hospital/13055956"
              className="flex-1 px-3 py-2 border border-[#e5e8eb] rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-[#05c072]"
            />
            <button onClick={savePlace} disabled={syncing} className="px-4 py-2 bg-[#05c072] hover:bg-[#04a862] text-white rounded-lg text-[14px] font-semibold disabled:opacity-50">
              {syncing ? "연결 중..." : "연결하고 수집"}
            </button>
          </div>
        ) : (
          <p className="text-[13px] text-[#8b95a1]">아직 네이버 플레이스가 연결되지 않았습니다.</p>
        )}
      </SectionCard>
    )
  }

  const { config, snapshot, counts, reviews } = data
  const tabs: Array<{ key: Filter; label: string; count?: number }> = [
    { key: "all", label: "전체", count: counts?.collected },
    { key: "unreplied", label: "답글 필요", count: counts?.unreplied },
    { key: "negative", label: "부정 리뷰", count: counts?.negative },
  ]

  return (
    <SectionCard
      title="네이버 리뷰"
      description={`${config.placeName || "네이버 플레이스"} · 마지막 수집 ${fmtDateTime(config.lastSyncAt)} · 하루 3번 자동 수집`}
      action={
        isMaster && (
          <button
            onClick={syncNow}
            disabled={syncing}
            className="px-3 py-1.5 bg-[#e8f7f0] hover:bg-[#d4f2e4] text-[#05a660] rounded-lg text-[13px] font-semibold disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "수집 중..." : "지금 수집"}
          </button>
        )
      }
    >
      {snapshot && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Stat label="방문자 리뷰 (전체)" value={snapshot.visitorTotal.toLocaleString()} />
          <Stat label="블로그·카페 리뷰" value={snapshot.blogTotal?.toLocaleString() ?? "—"} />
          <Stat label="답글 필요" value={String(counts?.unreplied ?? 0)} tone={counts?.unreplied ? "warn" : undefined} />
          <Stat label="부정 리뷰" value={String(counts?.negative ?? 0)} tone={counts?.negative ? "bad" : undefined} />
        </div>
      )}

      <div className="flex items-center gap-1 mb-4 w-fit p-1 bg-[#f2f4f6] rounded-[10px]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3.5 py-1.5 rounded-[8px] text-[13px] font-semibold transition-colors ${
              filter === t.key ? "bg-white text-[#191f28] shadow-sm" : "text-[#8b95a1] hover:text-[#4e5968]"
            }`}
          >
            {t.label}
            {t.count != null && <span className="ml-1 text-[#adb5bd]">{t.count}</span>}
          </button>
        ))}
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-10 text-[13px] text-[#adb5bd]">해당하는 리뷰가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const s = r.keywords?.sentiment as keyof typeof SENTIMENT | undefined
            const replyUrl = config.placeId ? `https://new-m.smartplace.naver.com/bizes/place-id/${config.placeId}/reviews/${r.reviewId}` : null
            return (
              <div key={r.id} className={`rounded-xl border p-4 ${s === "negative" ? "border-[#f9caca] bg-[#fffafa]" : "border-[#f2f4f6]"}`}>
                <div className="flex flex-wrap items-center gap-2 mb-2 text-[12px]">
                  <span className="text-[#4e5968] font-medium">{r.authorName || "익명"}</span>
                  <span className="text-[#adb5bd]">{fmtDate(r.reviewDate)}</span>
                  {r.originType && <span className="text-[#adb5bd]">· {r.originType}</span>}
                  {s && <span className={`px-2 py-0.5 rounded-full font-semibold ${SENTIMENT[s].cls}`}>{SENTIMENT[s].label}</span>}
                  {r.keywords?.topics?.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-[#f2f4f6] text-[#6b7684]">{t}</span>
                  ))}
                </div>

                <p className="text-[14px] text-[#333d4b] whitespace-pre-line leading-relaxed">{r.content}</p>

                {r.keywords?.issue && (
                  <p className="mt-2 text-[13px] text-[#e5484d]">개선할 점: {r.keywords.issue}</p>
                )}

                {r.reply ? (
                  <div className="mt-3 pl-3 border-l-2 border-[#d4f2e4] text-[13px] text-[#6b7684]">
                    <span className="font-semibold text-[#05a660]">답글 완료</span> {fmtDate(r.replyDate)}
                    <p className="mt-1 line-clamp-2">{r.reply}</p>
                  </div>
                ) : r.replyDraft ? (
                  <div className="mt-3 rounded-lg bg-[#f9fafb] p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-semibold text-[#3182f6]">답글 초안</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => copy(r.id, r.replyDraft!)} className="text-[12px] text-[#6b7684] hover:text-[#191f28] flex items-center gap-1">
                          {copied === r.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied === r.id ? "복사됨" : "복사"}
                        </button>
                        {replyUrl && (
                          <a href={replyUrl} target="_blank" rel="noreferrer" className="text-[12px] text-[#6b7684] hover:text-[#191f28] flex items-center gap-1">
                            <ExternalLink className="w-3.5 h-3.5" />
                            스마트플레이스에서 답글 달기
                          </a>
                        )}
                      </div>
                    </div>
                    <p className="text-[13px] text-[#4e5968] whitespace-pre-line">{r.replyDraft}</p>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "bad" }) {
  const color = tone === "bad" ? "text-[#e5484d]" : tone === "warn" ? "text-[#f59f00]" : "text-[#191f28]"
  return (
    <div className="rounded-xl bg-[#f9fafb] px-4 py-3">
      <div className="text-[12px] text-[#8b95a1]">{label}</div>
      <div className={`text-[20px] font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  )
}
