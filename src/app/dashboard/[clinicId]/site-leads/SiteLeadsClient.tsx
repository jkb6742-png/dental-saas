"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Inbox, RefreshCw, Settings, AlertCircle, CheckCircle2, Link2, Unlink, ExternalLink, Search, Phone } from "lucide-react"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"

export type SourceInfo = { connected: boolean; siteUrl: string; lastSyncAt: string | null; lastSyncStatus: string | null; lastSyncError: string | null; alertEmails: string }
export type LeadItem = {
  id: string; siteLeadId: number; receivedAt: string; status: string; statusLabel: string | null
  name: string | null; phone: string | null; category: string | null; subject: string | null; content: string | null; channel: string | null
  srcLabel: string | null; medLabel: string | null; campaign: string | null; noteCount: number
}
type Props = { clinicId: string; isMaster: boolean; source: SourceInfo; leads: LeadItem[]; retentionDays: number }

const STATUSES: { key: string; label: string; variant: "blue" | "green" | "red" | "yellow" | "gray" }[] = [
  { key: "new", label: "신규", variant: "blue" },
  { key: "contacted", label: "연락함", variant: "gray" },
  { key: "consulting", label: "상담 중", variant: "yellow" },
  { key: "booked", label: "예약", variant: "green" },
  { key: "visited", label: "내원", variant: "green" },
  { key: "hold", label: "보류", variant: "gray" },
  { key: "lost", label: "무산", variant: "gray" },
  { key: "spam", label: "스팸", variant: "red" },
]
const CHANNEL: Record<string, string> = { quick_form: "빠른상담", counsel_form: "상담 신청서", contact_form: "상담 게시판" }

const inputCls = "w-full px-3.5 py-2.5 rounded-[10px] border border-[#d1d1cc] bg-white text-[14px] text-[#191f28] placeholder:text-[#b0b8c1] focus:outline-none focus:border-[#0062ff] focus:ring-2 focus:ring-[#0062ff]/15 transition"
const labelCls = "block text-[13px] font-semibold text-[#4e5968] mb-1.5"
const card = "bg-white rounded-2xl border border-[#d1d1cc]"
// 서버·클라이언트 동일 출력: KST 고정 포맷
const fmtKst = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000)
  const p2 = (n: number) => String(n).padStart(2, "0")
  return `${d.getUTCFullYear()}.${p2(d.getUTCMonth() + 1)}.${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`
}
const kstMonthKey = (iso: string) => fmtKst(iso).slice(0, 7)

export default function SiteLeadsClient({ clinicId, isMaster, source, leads, retentionDays }: Props) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [setupOpen, setSetupOpen] = useState(!source.connected && isMaster)
  const [statusSel, setStatusSel] = useState<string[]>([])
  const [q, setQ] = useState("")
  const [showSpam, setShowSpam] = useState(false)

  const summary = useMemo(() => {
    const now = Date.now()
    const month = kstMonthKey(new Date(now).toISOString())
    const valid = leads.filter((l) => l.status !== "spam")
    const thisMonth = valid.filter((l) => kstMonthKey(l.receivedAt) === month)
    const conv = thisMonth.filter((l) => l.status === "booked" || l.status === "visited").length
    return {
      fresh: valid.filter((l) => l.status === "new").length,
      overdue: valid.filter((l) => l.status === "new" && now - new Date(l.receivedAt).getTime() > 86400000).length,
      month: thisMonth.length,
      rate: thisMonth.length ? Math.round((conv / thisMonth.length) * 1000) / 10 : null,
    }
  }, [leads])

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return leads.filter((l) => {
      if (statusSel.length ? !statusSel.includes(l.status) : !showSpam && l.status === "spam") return false
      if (!kw) return true
      return [l.name, l.phone, l.subject, l.category, l.content].some((v) => v?.toLowerCase().includes(kw))
    })
  }, [leads, statusSel, q, showSpam])

  const sync = async (full = false) => {
    setSyncing(true); setMsg(null)
    try {
      const res = await fetch("/api/site-leads/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clinicId, full }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMsg({ kind: "ok", text: json.added ? `새 문의 ${json.added}건을 가져왔습니다` : "최신 상태입니다" })
      router.refresh()
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message })
    } finally {
      setSyncing(false)
    }
  }

  const toggle = (k: string) => setStatusSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
  const statusMeta = (k: string) => STATUSES.find((s) => s.key === k)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#191f28] flex items-center gap-2"><Inbox className="w-5 h-5 text-[#0062ff]" /> 홈페이지 문의</h1>
          <p className="text-[13px] text-[#8b95a1] mt-1">
            홈페이지 상담 게시판·빠른상담으로 들어온 문의입니다. 15분마다 자동으로 가져옵니다.
            {source.lastSyncAt && <> 마지막 수집 {fmtKst(source.lastSyncAt)}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {source.connected && (
            <Button variant="secondary" size="sm" onClick={() => sync(false)} loading={syncing}>
              {!syncing && <RefreshCw className="w-4 h-4" />} 지금 가져오기
            </Button>
          )}
          {isMaster && (
            <Button variant="ghost" size="sm" onClick={() => setSetupOpen((v) => !v)}><Settings className="w-4 h-4" /> 연결 설정</Button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 text-[13px] rounded-lg px-3 py-2 ${msg.kind === "ok" ? "text-[#05c072] bg-[#e5f9f0]" : "text-[#f04452] bg-[#fff0f1]"}`}>
          {msg.kind === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {msg.text}
        </div>
      )}
      {isMaster && source.lastSyncStatus === "FAILED" && source.lastSyncError && (
        <div className="flex items-center gap-2 text-[13px] text-[#f04452] bg-[#fff0f1] rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4 shrink-0" /> 마지막 수집 실패: {source.lastSyncError}</div>
      )}

      {isMaster && setupOpen && <SetupPanel clinicId={clinicId} source={source} onDone={() => { setSetupOpen(false); router.refresh() }} />}

      {!source.connected ? (
        <div className={`${card} p-10 text-center`}>
          <Inbox className="w-8 h-8 text-[#d1d6db] mx-auto" />
          <p className="text-[15px] font-semibold text-[#4e5968] mt-3">연결 안 됨</p>
          <p className="text-[13px] text-[#8b95a1] mt-1">이 치과 홈페이지는 아직 상담문의 연동이 설정되지 않았습니다.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="신규" value={`${summary.fresh}건`} sub="아직 연락 전" tone="blue" />
            <Kpi label="24시간 미응답" value={`${summary.overdue}건`} sub="신규로 하루 넘음" tone={summary.overdue ? "red" : undefined} />
            <Kpi label="이번 달 문의" value={`${summary.month}건`} sub="스팸 제외" />
            <Kpi label="이번 달 전환율" value={summary.rate === null ? "—" : `${summary.rate}%`} sub="예약+내원 ÷ 문의" />
          </div>

          <div className={`${card} p-4 space-y-3`}>
            <div className="flex flex-wrap items-center gap-2">
              {STATUSES.map((s) => (
                <button key={s.key} onClick={() => toggle(s.key)}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-semibold border transition ${statusSel.includes(s.key) ? "bg-[#0062ff] border-[#0062ff] text-white" : "bg-white border-[#d1d1cc] text-[#4e5968] hover:bg-[#f2f2ef]"}`}>
                  {s.label}
                </button>
              ))}
              {!statusSel.length && (
                <label className="flex items-center gap-1.5 text-[13px] text-[#8b95a1] ml-1">
                  <input type="checkbox" checked={showSpam} onChange={(e) => setShowSpam(e.target.checked)} /> 스팸 포함
                </label>
              )}
              <div className="relative ml-auto w-full sm:w-64">
                <Search className="w-4 h-4 text-[#b0b8c1] absolute left-3 top-1/2 -translate-y-1/2" />
                <input className={`${inputCls} pl-9 py-2`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름 · 연락처 · 제목 · 내용" />
              </div>
            </div>

            {list.length === 0 ? (
              <p className="text-[13px] text-[#8b95a1] py-10 text-center">조건에 맞는 문의가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto -mx-4">
                <table className="w-full text-[13px] min-w-[760px]">
                  <thead>
                    <tr className="text-left text-[12px] text-[#8b95a1] border-b border-[#e0e0db]">
                      <th className="px-4 py-2 font-medium">접수</th>
                      <th className="px-2 py-2 font-medium">이름</th>
                      <th className="px-2 py-2 font-medium">연락처</th>
                      <th className="px-2 py-2 font-medium">분류 · 제목</th>
                      <th className="px-2 py-2 font-medium">유입</th>
                      <th className="px-2 py-2 font-medium">상태</th>
                      <th className="px-4 py-2 font-medium text-right">홈페이지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((l) => {
                      const st = statusMeta(l.status)
                      const tel = (l.phone ?? "").replace(/[^\d+]/g, "")
                      return (
                        <tr key={l.id} className="border-b border-[#e0e0db] last:border-0 align-top">
                          <td className="px-4 py-3 whitespace-nowrap text-[#4e5968]">{fmtKst(l.receivedAt)}</td>
                          <td className="px-2 py-3 font-semibold text-[#191f28] whitespace-nowrap">{l.name || "이름 없음"}</td>
                          <td className="px-2 py-3 whitespace-nowrap">
                            {tel ? <a href={`tel:${tel}`} className="text-[#0062ff] inline-flex items-center gap-1"><Phone className="w-3 h-3" />{l.phone}</a> : <span className="text-[#b0b8c1]">—</span>}
                          </td>
                          <td className="px-2 py-3 text-[#191f28]">
                            <div className="text-[12px] text-[#8b95a1]">{[l.category, l.channel ? CHANNEL[l.channel] ?? l.channel : null].filter(Boolean).join(" · ") || "—"}</div>
                            <div className="line-clamp-1 max-w-[280px]">{l.subject || "(제목 없음)"}</div>
                            {l.content && (
                              <details className="mt-1 max-w-[360px]">
                                <summary className="text-[12px] text-[#0062ff] cursor-pointer select-none">상담 내용</summary>
                                <p className="mt-1 text-[13px] leading-relaxed text-[#333d4b] whitespace-pre-wrap break-words bg-[#f9fafb] rounded-[8px] px-3 py-2">{l.content}</p>
                              </details>
                            )}
                          </td>
                          <td className="px-2 py-3 text-[#4e5968]">
                            {l.srcLabel || "—"}{l.medLabel ? <span className="text-[#8b95a1]"> · {l.medLabel}</span> : null}
                            {l.campaign && <div className="text-[12px] text-[#8b95a1] truncate max-w-[160px]">{l.campaign}</div>}
                          </td>
                          <td className="px-2 py-3 whitespace-nowrap"><Badge variant={st?.variant ?? "gray"}>{l.statusLabel || st?.label || l.status}</Badge></td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <a href={`${source.siteUrl}/dashboard/lead.php?id=${l.siteLeadId}`} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#4e5968] hover:text-[#0062ff] inline-flex items-center gap-1">
                              상세·상태 변경 <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-[12px] text-[#8b95a1]">
            상태 변경·메모는 홈페이지 관리 화면(/dashboard)에서 하고, 여기에는 15분 안에 반영됩니다. 상담 내용은 암호화해 보관합니다.
            이름·연락처는 접수 후 {Math.round(retentionDays / 365)}년이 지나면 이 화면에서 자동 삭제됩니다.
          </p>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "blue" | "red" }) {
  const color = tone === "blue" ? "text-[#0062ff]" : tone === "red" ? "text-[#f04452]" : "text-[#191f28]"
  return (
    <div className={`${card} px-5 py-4`}>
      <div className="text-[12px] text-[#8b95a1]">{label}</div>
      <div className={`text-[20px] font-bold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-[12px] text-[#8b95a1] mt-0.5">{sub}</div>}
    </div>
  )
}

function SetupPanel({ clinicId, source, onDone }: { clinicId: string; source: SourceInfo; onDone: () => void }) {
  const [siteUrl, setSiteUrl] = useState(source.siteUrl)
  const [token, setToken] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [emails, setEmails] = useState(source.alertEmails)
  const [mailMsg, setMailMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const [testing, setTesting] = useState(false)
  const saveEmails = async (test = false) => {
    setMailMsg(null); if (test) setTesting(true)
    const res = await fetch("/api/site-leads/source", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clinicId, alertEmails: emails, test }) }).finally(() => setTesting(false))
    const json = await res.json()
    if (!res.ok) return setMailMsg({ kind: "err", text: json.error })
    setEmails(json.alertEmails)
    if (json.tested) return setMailMsg({ kind: "ok", text: "테스트 메일을 보냈습니다. 받은편지함(안 보이면 스팸함)을 확인해 주세요" })
    setMailMsg(json.mailReady ? { kind: "ok", text: json.alertEmails ? "저장했습니다. 새 문의가 들어오면 메일을 보냅니다" : "메일 알림을 껐습니다" } : { kind: "err", text: "저장했지만 서버 메일(SMTP) 설정이 없어 발송되지 않습니다" })
  }

  const save = async () => {
    setSaving(true); setErr(null)
    try {
      const res = await fetch("/api/site-leads/source", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clinicId, siteUrl, token }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onDone()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const disconnect = async () => {
    if (!confirm("연결을 해제할까요? 가져온 문의(이름·연락처 포함)도 Insight 에서 삭제됩니다.")) return
    await fetch(`/api/site-leads/source?clinicId=${clinicId}`, { method: "DELETE" })
    onDone()
  }

  return (
    <div className={`${card} p-4 space-y-2.5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold text-[#191f28] flex items-center gap-2"><Link2 className="w-4 h-4 text-[#0062ff]" /> 홈페이지 연결 (마스터)</h3>
          <p className="text-[13px] text-[#8b95a1] mt-1">
            홈페이지에 최고관리자로 로그인 → <b>/dashboard/insight.php</b> 에서 토큰을 발급해 붙여 넣으세요. 저장하면 연결을 확인하고 최근 1년치 문의를 가져옵니다.
          </p>
        </div>
        {source.connected && (
          <button onClick={disconnect} className="text-[12px] text-[#8b95a1] hover:text-[#f04452] flex items-center gap-1 shrink-0"><Unlink className="w-3 h-3" /> 연결 해제</button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>홈페이지 주소</label>
          <input className={inputCls} value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://example.com" />
        </div>
        <div>
          <label className={labelCls}>연동 토큰</label>
          <input type="password" autoComplete="off" className={inputCls} value={token} onChange={(e) => setToken(e.target.value)} placeholder={source.connected ? "변경할 때만 입력" : "홈페이지에서 발급한 토큰"} />
        </div>
      </div>
      {err && <div className="flex items-center gap-2 text-[13px] text-[#f04452] bg-[#fff0f1] rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4" /> {err}</div>}
      <div className="flex justify-end">
        <Button onClick={save} loading={saving} disabled={!siteUrl || (!source.connected && !token)}>{source.connected ? "저장" : "연결"}</Button>
      </div>
      {source.connected && (
        <div className="pt-4 border-t border-[#e0e0db]">
          <label className={labelCls}>새 문의 메일 알림</label>
          <div className="flex gap-2">
            <input className={inputCls} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="받을 메일 (여러 개는 쉼표로) · 비우면 끔" />
            <Button variant="secondary" onClick={() => saveEmails()}>저장</Button>
            <Button variant="secondary" onClick={() => saveEmails(true)} loading={testing} disabled={!emails.trim()}>테스트 메일</Button>
          </div>
          <p className="mt-1.5 text-[12px] text-[#8b95a1]">새 문의가 들어오면 1분 안에 메일로 보냅니다. 이름·연락처는 일부를 가려서 보냅니다.</p>
          {mailMsg && <p className={`mt-1.5 text-[13px] ${mailMsg.kind === "ok" ? "text-[#05c072]" : "text-[#f04452]"}`}>{mailMsg.text}</p>}
        </div>
      )}
    </div>
  )
}
