"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Megaphone, RefreshCw, Settings, AlertCircle, CheckCircle2, Link2, Unlink, ExternalLink, Wallet, Bell, FileText, Plus, Trash2, Download, X, Loader2, Send } from "lucide-react"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import MetricSwitchChart, { type SwitchMetric } from "@/components/charts/MetricSwitchChart"
import type { MonthlyStats } from "@/lib/naver-ads/service"

type Props = { clinicId: string; initial: MonthlyStats; isMaster: boolean }

type Report = {
  id: string; title: string; periodStart: string; periodEnd: string; compareStart: string; compareEnd: string
  memo: string | null; status: string; error: string | null; model: string | null; createdBy: string | null; createdAt: string
  summary: { impressions: number; clicks: number; cost: number; ctr: number; cpc: number; activeDays: number; days: number; prevCtr: number; prevCpc: number; prevCost: number; currentLabel: string; compareLabel: string } | null
}

const won = (v: number) => `${v.toLocaleString("ko-KR")}원`
const num = (v: number) => v.toLocaleString("ko-KR")
const pct = (v: number) => `${v.toFixed(2)}%`
// 서버·클라이언트 동일 출력(하이드레이션 불일치 방지): KST 고정 포맷
const fmtKst = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000)
  const p2 = (n: number) => String(n).padStart(2, "0")
  return `${d.getUTCFullYear()}.${p2(d.getUTCMonth() + 1)}.${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`
}
const d2 = (n: number) => String(n).padStart(2, "0")
const ymdLocal = (d: Date) => `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}`
const dot = (s: string) => s.replace(/-/g, ".")

function delta(cur: number, prev: number) {
  if (!prev) return null
  return +(((cur - prev) / prev) * 100).toFixed(1)
}

const inputCls = "w-full px-3.5 py-2.5 rounded-[10px] border border-[#d1d1cc] bg-white text-[14px] text-[#191f28] placeholder:text-[#b0b8c1] focus:outline-none focus:border-[#0062ff] focus:ring-2 focus:ring-[#0062ff]/15 transition disabled:bg-[#f2f2ef] disabled:text-[#8b95a1]"
const labelCls = "block text-[13px] font-semibold text-[#4e5968] mb-1.5"
const card = "bg-white rounded-2xl border border-[#d1d1cc]"
// 세션이 풀린 상태(401)면 메시지 대신 로그인 화면으로 보낸다
const toLoginIf401 = (res: Response) => {
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`
    return true
  }
  return false
}

export default function NaverAdsClient({ clinicId, initial, isMaster }: Props) {
  const router = useRouter()
  const [stats, setStats] = useState<MonthlyStats>(initial)
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [bizmoney, setBizmoney] = useState<number | null>(initial.account.lastBizmoney ?? null)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [setupOpen, setSetupOpen] = useState(!initial.account.connected && isMaster)
  const [alertOpen, setAlertOpen] = useState(false)
  const [reports, setReports] = useState<Report[]>([])
  const [reportModal, setReportModal] = useState(false)

  useEffect(() => { setStats(initial) }, [initial])

  const load = useCallback(async (y: number, m: number, withBiz = false) => {
    const res = await fetch(`/api/naver-ads/stats?clinicId=${clinicId}&year=${y}&month=${m}${withBiz ? "&bizmoney=1" : ""}`)
    if (toLoginIf401(res) || !res.ok) return
    const json = await res.json()
    setStats(json)
    if (withBiz && typeof json.bizmoney === "number") setBizmoney(Math.round(json.bizmoney))
  }, [clinicId])

  const loadReports = useCallback(async () => {
    const res = await fetch(`/api/naver-ads/reports?clinicId=${clinicId}`)
    if (toLoginIf401(res) || !res.ok) return
    const json = await res.json()
    setReports(json.reports ?? [])
  }, [clinicId])

  useEffect(() => {
    if (initial.account.connected) { load(year, month, true); loadReports() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 생성 중인 보고서가 있으면 5초마다 목록 갱신
  const generating = reports.some((r) => r.status === "GENERATING")
  useEffect(() => {
    if (!generating) return
    const t = setInterval(loadReports, 5000)
    return () => clearInterval(t)
  }, [generating, loadReports])

  const changeMonth = (y: number, m: number) => {
    setYear(y); setMonth(m)
    router.replace(`?year=${y}&month=${m}`)
    load(y, m)
  }

  const sync = async () => {
    setSyncing(true); setMsg(null)
    try {
      const first = `${year}-${d2(month)}-01`
      const lastDay = new Date(year, month, 0)
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
      const untilD = lastDay < yesterday ? lastDay : yesterday
      const res = await fetch("/api/naver-ads/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clinicId, since: first, until: ymdLocal(untilD) }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMsg({ kind: "ok", text: `${json.since} ~ ${json.until} 캠페인 ${json.campaigns}개 · ${json.rows}행 반영` })
      await load(year, month, true)
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message })
    } finally {
      setSyncing(false)
    }
  }

  const deleteReport = async (id: string) => {
    if (!confirm("이 보고서를 삭제할까요?")) return
    await fetch(`/api/naver-ads/reports/${id}`, { method: "DELETE" })
    loadReports()
  }

  const t = stats.total
  const p = stats.prev
  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i)
  const alert = stats.account.alert
  const daysLeft = bizmoney !== null && stats.avgDailyCost7 > 0 ? Math.floor(bizmoney / stats.avgDailyCost7) : null
  const lowBalance = bizmoney !== null && !!alert && (alert.days ? daysLeft !== null && daysLeft <= alert.days : bizmoney <= alert.threshold)

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 border-b border-[#d1d1cc] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Megaphone className="w-8 h-8 text-[#03c75a]" />
            <h1 className="text-[18px] font-bold text-[#191f28]">네이버 검색광고</h1>
            {stats.account.connected ? (
              isMaster && stats.account.lastSyncStatus === "FAILED" ? <Badge variant="red">동기화 실패</Badge> : <Badge variant="green">연결됨</Badge>
            ) : <Badge variant="gray">미연결</Badge>}
            {isMaster && alert?.enabled && <Badge variant="blue">잔액 알림 켜짐</Badge>}
          </div>
          <p className="text-[14px] text-[#6b7684]">
            네이버 검색광고 API 로 캠페인별 노출·클릭·광고비를 가져와 월 단위로 보여줍니다.
            {stats.account.lastSyncAt && <span className="ml-1 text-[#8b95a1]">마지막 동기화 {fmtKst(stats.account.lastSyncAt)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <select className="px-3 py-2 rounded-[10px] border border-[#d1d1cc] text-[13px] bg-white" value={year} onChange={(e) => changeMonth(Number(e.target.value), month)}>
            {years.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select className="px-3 py-2 rounded-[10px] border border-[#d1d1cc] text-[13px] bg-white" value={month} onChange={(e) => changeMonth(year, Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
          </select>
          {isMaster && stats.account.connected && (
            <Button onClick={sync} loading={syncing} size="md"><RefreshCw className="w-4 h-4" /> 동기화</Button>
          )}
          {isMaster && stats.account.connected && (
            <Button variant={alertOpen ? "primary" : "secondary"} size="md" onClick={() => { setAlertOpen((v) => !v); setSetupOpen(false) }}><Bell className="w-4 h-4" /> 알림 설정</Button>
          )}
          {isMaster && (
            <Button variant={setupOpen ? "primary" : "secondary"} size="md" onClick={() => { setSetupOpen((v) => !v); setAlertOpen(false) }}><Settings className="w-4 h-4" /> 연결 설정</Button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 text-[13px] rounded-xl px-4 py-3 ${msg.kind === "ok" ? "bg-[#e8f7f1] text-[#05c072]" : "bg-[#fff0f1] text-[#f04452]"}`}>
          {msg.kind === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {msg.text}
        </div>
      )}
      {isMaster && stats.account.lastSyncStatus === "FAILED" && stats.account.lastSyncError && !msg && (
        <div className="flex items-center gap-2 text-[13px] rounded-xl px-4 py-3 bg-[#fff0f1] text-[#f04452]"><AlertCircle className="w-4 h-4" /> 마지막 동기화 오류: {stats.account.lastSyncError}</div>
      )}
      {isMaster && lowBalance && !msg && (
        <div className="flex items-center gap-2 text-[13px] rounded-xl px-4 py-3 bg-[#fff8ec] text-[#b45309]"><Wallet className="w-4 h-4" /> 비즈머니 잔액 {won(bizmoney!)} — 알림 기준({alert!.days ? `${alert!.days}일분` : won(alert!.threshold)}) 이하입니다. 충전이 필요합니다.</div>
      )}

      {isMaster && setupOpen && (
        <SetupPanel clinicId={clinicId} account={stats.account} onDone={() => { setSetupOpen(false); router.refresh(); load(year, month, true) }} />
      )}
      {isMaster && alertOpen && alert && (
        <AlertPanel clinicId={clinicId} alert={alert} mailConfigured={stats.mailConfigured} bizmoney={bizmoney} onSaved={() => { router.refresh(); load(year, month) }} />
      )}

      {!stats.account.connected && !isMaster && (
        <div className={`${card} p-10 text-center`}>
          <Megaphone className="w-10 h-10 text-[#d1d6db] mx-auto mb-3" />
          <p className="text-[15px] font-semibold text-[#191f28]">아직 검색광고 계정이 연결되지 않았습니다</p>
          <p className="text-[13px] text-[#8b95a1] mt-1">THINKLAB 담당자가 광고계정을 연결하면 이곳에서 성과를 확인할 수 있습니다. 요청사항 메뉴로 연결을 요청해 주세요.</p>
        </div>
      )}

      {stats.account.connected && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi label="광고비" value={won(t.cost)} d={delta(t.cost, p.cost)} invert />
            <Kpi label="노출" value={num(t.impressions)} d={delta(t.impressions, p.impressions)} />
            <Kpi label="클릭" value={num(t.clicks)} d={delta(t.clicks, p.clicks)} />
            <Kpi label="클릭률 (CTR)" value={pct(t.ctr)} d={delta(t.ctr, p.ctr)} />
            <Kpi label="클릭당 비용 (CPC)" value={won(t.cpc)} d={delta(t.cpc, p.cpc)} invert />
            <Kpi
              label="비즈머니 잔액"
              value={bizmoney === null ? "-" : won(bizmoney)}
              icon={<Wallet className="w-3.5 h-3.5" />}
              warn={lowBalance}
              sub={bizmoney === null ? undefined : daysLeft === null ? "최근 집행 없음" : daysLeft <= 0 ? "오늘 중 소진" : `약 ${daysLeft}일분 · 일평균 ${won(stats.avgDailyCost7)}`}
            />
          </div>

          {/* 기간별 광고비 현황 (일 · 주 · 월) */}
          <TimelineSection clinicId={clinicId} />

          {!stats.hasData ? (
            <div className={`${card} p-10 text-center`}>
              <p className="text-[15px] font-semibold text-[#191f28]">{year}년 {month}월 데이터가 없습니다</p>
              <p className="text-[13px] text-[#8b95a1] mt-1">{isMaster ? "동기화 버튼을 누르면 네이버에서 이 달의 성과를 가져옵니다." : "아직 이 달 성과가 수집되지 않았습니다."}</p>
            </div>
          ) : (
            <>
              {/* 캠페인 표 */}
              <div className={`${card} overflow-hidden`}>
                <div className="px-4 py-3 border-b border-[#e0e0db] flex items-center justify-between">
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#191f28]">캠페인별 성과</h3>
                    <p className="text-[13px] text-[#8b95a1] mt-0.5">광고비 많은 순</p>
                  </div>
                  <a href="https://searchad.naver.com" target="_blank" rel="noreferrer" className="text-[12px] text-[#8b95a1] hover:text-[#191f28] flex items-center gap-1">네이버 광고관리 <ExternalLink className="w-3 h-3" /></a>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-[#8b95a1] text-left border-b border-[#e0e0db]">
                        <th className="px-4 py-3 font-medium">캠페인</th>
                        <th className="px-3 py-3 font-medium">유형</th>
                        <th className="px-3 py-3 font-medium text-right">노출</th>
                        <th className="px-3 py-3 font-medium text-right">클릭</th>
                        <th className="px-3 py-3 font-medium text-right">CTR</th>
                        <th className="px-3 py-3 font-medium text-right">CPC</th>
                        <th className="px-3 py-3 font-medium text-right">평균순위</th>
                        <th className="px-4 py-3 font-medium text-right">광고비</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.campaigns.map((c) => (
                        <tr key={c.campaignId} className="border-b border-[#e0e0db] last:border-0 hover:bg-[#f2f2ef]">
                          <td className="px-4 py-3 font-medium text-[#191f28]">{c.name}</td>
                          <td className="px-3 py-3"><Badge variant="gray">{c.type}</Badge></td>
                          <td className="px-3 py-3 text-right text-[#4e5968]">{num(c.impressions)}</td>
                          <td className="px-3 py-3 text-right text-[#4e5968]">{num(c.clicks)}</td>
                          <td className="px-3 py-3 text-right text-[#4e5968]">{pct(c.ctr)}</td>
                          <td className="px-3 py-3 text-right text-[#4e5968]">{won(c.cpc)}</td>
                          <td className="px-3 py-3 text-right text-[#4e5968]">{c.avgRank ?? "-"}</td>
                          <td className="px-4 py-3 text-right font-semibold text-[#191f28]">{won(c.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#f2f2ef] font-semibold text-[#191f28]">
                        <td className="px-4 py-3" colSpan={2}>합계</td>
                        <td className="px-3 py-3 text-right">{num(t.impressions)}</td>
                        <td className="px-3 py-3 text-right">{num(t.clicks)}</td>
                        <td className="px-3 py-3 text-right">{pct(t.ctr)}</td>
                        <td className="px-3 py-3 text-right">{won(t.cpc)}</td>
                        <td className="px-3 py-3 text-right">-</td>
                        <td className="px-4 py-3 text-right">{won(t.cost)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* 운영 보고서 */}
          <div className={`${card} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-[#e0e0db] flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-semibold text-[#191f28] flex items-center gap-2"><FileText className="w-4 h-4 text-[#0062ff]" /> 운영 보고서</h3>
                <p className="text-[13px] text-[#8b95a1] mt-0.5">{isMaster ? `기간을 정하면 직전 기간과 비교한 보고서를 자동으로 만듭니다. ${alert?.autoMonthlyReport ? "매월 1일 전월 보고서가 자동 생성됩니다." : ""}` : "THINKLAB 이 작성한 네이버 광고 운영 보고서입니다."}</p>
              </div>
              {isMaster && <Button size="md" onClick={() => setReportModal(true)}><Plus className="w-4 h-4" /> 보고서 만들기</Button>}
            </div>
            {reports.filter((r) => isMaster || r.status === "DONE").length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px] text-[#8b95a1]">아직 만들어진 보고서가 없습니다.</div>
            ) : (
              <ul className="divide-y divide-[#f2f4f6]">
                {reports.filter((r) => isMaster || r.status === "DONE").map((r) => (
                  <li key={r.id} className="px-4 py-4 flex items-center gap-3 hover:bg-[#f2f2ef]">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/dashboard/${clinicId}/naver-ads/reports/${r.id}`} className="text-[14px] font-semibold text-[#191f28] hover:text-[#0062ff] truncate">{r.title}</Link>
                        {r.status === "DONE" ? <Badge variant="green">완료</Badge> : r.status === "FAILED" ? <Badge variant="red">실패</Badge> : <Badge variant="yellow"><Loader2 className="w-3 h-3 animate-spin inline mr-1" />생성 중</Badge>}
                        {isMaster && r.createdBy === "scheduler" && <Badge variant="gray">자동</Badge>}
                      </div>
                      <div className="text-[12px] text-[#8b95a1] mt-0.5">
                        {dot(r.periodStart)}~{dot(r.periodEnd)} · 비교 {dot(r.compareStart)}~{dot(r.compareEnd)} · 생성 {fmtKst(r.createdAt)}
                        {r.summary && <span> · 광고비 {won(r.summary.cost)} · CTR {pct(r.summary.ctr)} · CPC {won(r.summary.cpc)}</span>}
                        {isMaster && r.status === "FAILED" && r.error && <span className="text-[#f04452]"> · {r.error}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {r.status === "DONE" && (
                        <>
                          <Link href={`/dashboard/${clinicId}/naver-ads/reports/${r.id}`}><Button variant="secondary" size="sm">보기</Button></Link>
                          <a href={`/api/naver-ads/reports/${r.id}?format=html&download=1`} className="p-2 rounded-lg text-[#8b95a1] hover:bg-[#f2f4f6] hover:text-[#191f28]" title="HTML 다운로드"><Download className="w-4 h-4" /></a>
                        </>
                      )}
                      {isMaster && <button onClick={() => deleteReport(r.id)} className="p-2 rounded-lg text-[#8b95a1] hover:bg-[#fff0f1] hover:text-[#f04452]" title="삭제"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {reportModal && (
        <CreateReportModal
          clinicId={clinicId}
          onClose={() => setReportModal(false)}
          onCreated={() => { setReportModal(false); loadReports(); setMsg({ kind: "ok", text: "보고서를 만들고 있습니다. 1~2분 뒤 아래 목록에서 열 수 있습니다." }) }}
        />
      )}
    </div>
  )
}

function Kpi({ label, value, d, invert, icon, sub, warn }: { label: string; value: string; d?: number | null; invert?: boolean; icon?: React.ReactNode; sub?: string; warn?: boolean }) {
  const good = d === null || d === undefined ? null : invert ? d <= 0 : d >= 0
  return (
    <div className={`${card} px-5 py-4 ${warn ? "ring-2 ring-[#f5b14c]/60" : ""}`}>
      <div className="text-[12px] text-[#8b95a1] flex items-center gap-1">{icon}{label}</div>
      <div className={`text-[20px] font-bold mt-1 truncate ${warn ? "text-[#b45309]" : "text-[#191f28]"}`}>{value}</div>
      {d !== null && d !== undefined && (
        <div className={`text-[12px] mt-0.5 ${good ? "text-[#05c072]" : "text-[#f04452]"}`}>
          전월 대비 {d > 0 ? "+" : ""}{d}%
        </div>
      )}
      {sub && <div className={`text-[12px] mt-0.5 ${warn ? "text-[#b45309]" : "text-[#8b95a1]"}`}>{sub}</div>}
    </div>
  )
}

function SetupPanel({ clinicId, account, onDone }: { clinicId: string; account: MonthlyStats["account"]; onDone: () => void }) {
  const [customerId, setCustomerId] = useState(account.customerId ?? "")
  const [apiKey, setApiKey] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    setSaving(true); setErr(null)
    try {
      const res = await fetch("/api/naver-ads/account", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clinicId, customerId, apiKey, secretKey }) })
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
    if (!confirm("연결을 해제할까요? 수집된 성과 데이터는 남습니다.")) return
    await fetch(`/api/naver-ads/account?clinicId=${clinicId}`, { method: "DELETE" })
    onDone()
  }

  return (
    <div className={`${card} p-4 space-y-2.5`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-[#191f28] flex items-center gap-2"><Link2 className="w-4 h-4 text-[#03c75a]" /> 광고계정 연결 (마스터)</h3>
          <p className="text-[13px] text-[#8b95a1] mt-1">
            네이버 광고관리시스템 → 도구 → API 사용 관리에서 액세스 라이선스·비밀키를 발급받고, 같은 화면의 CUSTOMER_ID 를 입력하세요.
            치과 대행 계정이면 해당 치과 광고주의 CUSTOMER_ID 를 넣습니다.
          </p>
        </div>
        {account.connected && (
          <button onClick={disconnect} className="text-[12px] text-[#8b95a1] hover:text-[#f04452] flex items-center gap-1 shrink-0"><Unlink className="w-3 h-3" /> 연결 해제</button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>CUSTOMER_ID</label>
          <input className={inputCls} value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="예) 1234567" inputMode="numeric" />
        </div>
        <div>
          <label className={labelCls}>액세스 라이선스 (API KEY)</label>
          <input className={inputCls} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={account.connected ? "변경할 때만 입력" : "0100000000..."} />
        </div>
        <div>
          <label className={labelCls}>비밀키 (SECRET KEY)</label>
          <input type="password" className={inputCls} value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder={account.connected ? "변경할 때만 입력" : "AQAAAA..."} />
        </div>
      </div>
      {err && <div className="flex items-center gap-2 text-[13px] text-[#f04452] bg-[#fff0f1] rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4" /> {err}</div>}
      <div className="flex justify-end gap-2">
        <Button onClick={save} loading={saving} disabled={!customerId || !apiKey || !secretKey}>인증 확인 후 저장</Button>
      </div>
    </div>
  )
}

type AlertSettings = NonNullable<MonthlyStats["account"]["alert"]>

function Toggle({ on, onChange, label, help }: { on: boolean; onChange: (v: boolean) => void; label: string; help?: string }) {
  return (
    <div className="flex items-start gap-3 select-none">
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative mt-0.5 w-11 h-6 rounded-full transition shrink-0 ${on ? "bg-[#0062ff]" : "bg-[#d1d6db]"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
      </button>
      <button type="button" onClick={() => onChange(!on)} className="text-left">
        <span className="block text-[14px] font-semibold text-[#191f28]">{label}</span>
        {help && <span className="block text-[12px] text-[#8b95a1] mt-0.5">{help}</span>}
      </button>
    </div>
  )
}

function AlertPanel({ clinicId, alert, mailConfigured, bizmoney, onSaved }: { clinicId: string; alert: AlertSettings; mailConfigured: boolean; bizmoney: number | null; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(alert.enabled)
  const [threshold, setThreshold] = useState(String(alert.threshold))
  const [threshold2, setThreshold2] = useState(alert.threshold2 ? String(alert.threshold2) : "")
  const [mode, setMode] = useState<"days" | "won">(alert.days ? "days" : "won")
  const [days, setDays] = useState(String(alert.days ?? 3))
  const [emails, setEmails] = useState(alert.emails)
  const [onSyncFail, setOnSyncFail] = useState(alert.onSyncFail)
  const [autoReport, setAutoReport] = useState(alert.autoMonthlyReport)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const persist = async () => {
    const res = await fetch("/api/naver-ads/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clinicId, alertEnabled: enabled, alertThreshold: Number(threshold || 0), alertThreshold2: mode === "won" && threshold2 ? Number(threshold2) : null, alertDays: mode === "days" ? Number(days || 0) : null, alertEmails: emails, alertOnSyncFail: onSyncFail, autoMonthlyReport: autoReport }) })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
  }

  const save = async () => {
    setSaving(true); setNote(null)
    try {
      await persist()
      setNote({ kind: "ok", text: "알림 설정을 저장했습니다" })
      onSaved()
    } catch (e: any) {
      setNote({ kind: "err", text: e.message })
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true); setNote(null)
    try {
      await persist()
      const res = await fetch("/api/naver-ads/alert-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clinicId }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setNote({ kind: "ok", text: `테스트 발송: 앱 알림 ${json.inApp ?? 0}명${json.mailed ? ` · 메일 ${json.mailed}건` : ""}${json.mailError ? ` · 메일 안 감(${json.mailError})` : ""} — 현재 잔액 ${json.balance === null ? "조회 실패" : won(json.balance)}. 상단 종 아이콘을 확인해 보세요.` })
      onSaved()
    } catch (e: any) {
      setNote({ kind: "err", text: e.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className={`${card} p-4 space-y-5`}>
      <div>
        <h3 className="text-[16px] font-semibold text-[#191f28] flex items-center gap-2"><Bell className="w-4 h-4 text-[#0062ff]" /> 알림 · 자동화 설정 (마스터)</h3>
        <p className="text-[13px] text-[#8b95a1] mt-1">서버가 매시간(08~22시) 비즈머니 잔액을 확인하고, 매일 아침 최근 7일 성과를 자동으로 동기화합니다. 알림은 화면 상단 종 아이콘(마스터 전원)으로 항상 가고, 메일은 아래 주소로 함께 보냅니다.</p>
      </div>
      {!mailConfigured && (
        <div className="flex items-start gap-2 text-[13px] text-[#b45309] bg-[#fff8ec] rounded-lg px-3 py-2.5">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>메일 서버가 아직 설정되지 않아 메일은 나가지 않습니다(앱 알림은 갑니다). 서버 .env 에 SMTP_HOST · SMTP_PORT · SMTP_USER · SMTP_PASS(구글은 앱 비밀번호)를 넣고 재시작하면 됩니다.</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2.5">
          <Toggle on={enabled} onChange={setEnabled} label="비즈머니 부족 알림" help="잔액이 기준 이하로 내려오면 앱 알림과 메일을 보냅니다. 기준마다 1회씩 보내고, 충전돼서 1차 기준 위로 올라오면 다시 보냅니다." />
          <div>
            <label className={labelCls}>알림 기준</label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setMode("days")} className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border ${mode === "days" ? "bg-[#191f28] border-[#191f28] text-white" : "bg-white border-[#d1d1cc] text-[#4e5968]"}`}>남은 일수</button>
              <button type="button" onClick={() => setMode("won")} className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border ${mode === "won" ? "bg-[#191f28] border-[#191f28] text-white" : "bg-white border-[#d1d1cc] text-[#4e5968]"}`}>금액</button>
            </div>
            {mode === "days" ? (
              <div className="flex items-center gap-2">
                <input className={`${inputCls} w-24`} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/[^\d]/g, ""))} placeholder="3" />
                <span className="text-[13px] text-[#4e5968]">일분 이하로 남으면 알림</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-[#4e5968] w-14 shrink-0">1차 기준</span>
                  <input className={inputCls} inputMode="numeric" value={Number(threshold || 0).toLocaleString("ko-KR")} onChange={(e) => setThreshold(e.target.value.replace(/[^\d]/g, ""))} placeholder="100,000" />
                  <span className="text-[13px] text-[#4e5968] shrink-0">원 이하</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-[#4e5968] w-14 shrink-0">2차 기준</span>
                  <input className={inputCls} inputMode="numeric" value={threshold2 ? Number(threshold2).toLocaleString("ko-KR") : ""} onChange={(e) => setThreshold2(e.target.value.replace(/[^\d]/g, ""))} placeholder="비워 두면 1차만 (예: 50,000)" />
                  <span className="text-[13px] text-[#4e5968] shrink-0">원 이하</span>
                </div>
              </div>
            )}
            <p className="text-[12px] text-[#8b95a1] mt-1">
              {mode === "days" ? "최근 7일 송출일 일평균 광고비 × 일수로 계산합니다. " : ""}현재 잔액 {bizmoney === null ? "-" : won(bizmoney)}{alert.lastAlertAt ? ` · 마지막 알림 ${fmtKst(alert.lastAlertAt)}` : ""}
            </p>
          </div>
          <div>
            <label className={labelCls}>수신 메일 (여러 개는 쉼표로)</label>
            <input className={inputCls} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="name@example.com, other@example.com" />
          </div>
        </div>
        <div className="space-y-2.5">
          <Toggle on={onSyncFail} onChange={setOnSyncFail} label="동기화 실패 알림" help="자동 동기화가 새로 실패하면(키 만료 등) 메일을 보냅니다." />
          <Toggle on={autoReport} onChange={setAutoReport} label="월간 보고서 자동 생성" help="매월 1일 전월 운영 보고서를 자동으로 만들어 아래 목록에 넣습니다." />
        </div>
      </div>
      {note && (
        <div className={`flex items-center gap-2 text-[13px] rounded-lg px-3 py-2 ${note.kind === "ok" ? "bg-[#e8f7f1] text-[#05c072]" : "bg-[#fff0f1] text-[#f04452]"}`}>
          {note.kind === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {note.text}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={test} loading={testing}><Send className="w-4 h-4" /> 테스트 알림 보내기</Button>
        <Button onClick={save} loading={saving}>저장</Button>
      </div>
    </div>
  )
}

// 기간 → 직전 같은 길이(월 전체면 전월)
function prevRangeClient(since: string, until: string) {
  const s = new Date(since + "T00:00:00"), u = new Date(until + "T00:00:00")
  const lastOfMonth = new Date(u.getFullYear(), u.getMonth() + 1, 0).getDate()
  if (s.getDate() === 1 && s.getMonth() === u.getMonth() && s.getFullYear() === u.getFullYear() && u.getDate() === lastOfMonth) {
    const ps = new Date(s.getFullYear(), s.getMonth() - 1, 1)
    const pe = new Date(s.getFullYear(), s.getMonth(), 0)
    return { since: ymdLocal(ps), until: ymdLocal(pe) }
  }
  const n = Math.round((u.getTime() - s.getTime()) / 86400000) + 1
  const pe = new Date(s); pe.setDate(pe.getDate() - 1)
  const ps = new Date(s); ps.setDate(ps.getDate() - n)
  return { since: ymdLocal(ps), until: ymdLocal(pe) }
}

function CreateReportModal({ clinicId, onClose, onCreated }: { clinicId: string; onClose: () => void; onCreated: () => void }) {
  const now = new Date()
  const lastMonth = { since: ymdLocal(new Date(now.getFullYear(), now.getMonth() - 1, 1)), until: ymdLocal(new Date(now.getFullYear(), now.getMonth(), 0)) }
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
  const thisMonth = { since: ymdLocal(new Date(now.getFullYear(), now.getMonth(), 1)), until: ymdLocal(yesterday) }

  const [preset, setPreset] = useState<"last" | "this" | "custom">("last")
  const [since, setSince] = useState(lastMonth.since)
  const [until, setUntil] = useState(lastMonth.until)
  const [cmpAuto, setCmpAuto] = useState(true)
  const [cmpSince, setCmpSince] = useState(() => prevRangeClient(lastMonth.since, lastMonth.until).since)
  const [cmpUntil, setCmpUntil] = useState(() => prevRangeClient(lastMonth.since, lastMonth.until).until)
  const [memo, setMemo] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const applyRange = (s: string, u: string) => {
    setSince(s); setUntil(u)
    if (cmpAuto && s && u && s <= u) { const p = prevRangeClient(s, u); setCmpSince(p.since); setCmpUntil(p.until) }
  }
  const choose = (k: "last" | "this" | "custom") => {
    setPreset(k)
    if (k === "last") applyRange(lastMonth.since, lastMonth.until)
    if (k === "this") applyRange(thisMonth.since, thisMonth.until)
  }

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      const res = await fetch("/api/naver-ads/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clinicId, since, until, compareSince: cmpSince, compareUntil: cmpUntil, memo }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onCreated()
    } catch (e: any) {
      setErr(e.message)
      setBusy(false)
    }
  }

  const presetBtn = (k: "last" | "this" | "custom", label: string) => (
    <button type="button" onClick={() => choose(k)} className={`px-3.5 py-2 rounded-[10px] text-[13px] font-semibold border transition ${preset === k ? "bg-[#0062ff] border-[#0062ff] text-white" : "bg-white border-[#d1d1cc] text-[#4e5968] hover:bg-[#f2f2ef]"}`}>{label}</button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={busy ? undefined : onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[560px] shadow-xl border border-[#d1d1cc]" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#e0e0db] flex items-center justify-between">
          <div>
            <h3 className="text-[17px] font-bold text-[#191f28]">운영 보고서 만들기</h3>
            <p className="text-[12px] text-[#8b95a1] mt-0.5">네이버에서 최신 수치를 받아 집계하고, GPT 가 해석 문장을 씁니다. 1~2분 걸리며 완료되면 목록에 표시됩니다.</p>
          </div>
          <button onClick={onClose} disabled={busy} className="p-2 rounded-lg text-[#8b95a1] hover:bg-[#f2f4f6]"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 py-3 space-y-2.5">
          <div>
            <label className={labelCls}>보고 기간</label>
            <div className="flex gap-2 mb-2">{presetBtn("last", "지난달")}{presetBtn("this", "이번달 (어제까지)")}{presetBtn("custom", "직접 입력")}</div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className={inputCls} value={since} disabled={preset !== "custom"} onChange={(e) => applyRange(e.target.value, until)} />
              <input type="date" className={inputCls} value={until} disabled={preset !== "custom"} onChange={(e) => applyRange(since, e.target.value)} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`${labelCls} mb-0`}>비교 기간</label>
              <label className="text-[12px] text-[#6b7684] flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={cmpAuto} onChange={(e) => { setCmpAuto(e.target.checked); if (e.target.checked) { const p = prevRangeClient(since, until); setCmpSince(p.since); setCmpUntil(p.until) } }} /> 직전 기간 자동</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className={inputCls} value={cmpSince} disabled={cmpAuto} onChange={(e) => setCmpSince(e.target.value)} />
              <input type="date" className={inputCls} value={cmpUntil} disabled={cmpAuto} onChange={(e) => setCmpUntil(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>운영 메모 (선택)</label>
            <textarea className={`${inputCls} min-h-[88px] resize-y`} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={"보고서에 반영할 사실만 적습니다.\n예) 9/10~9/13 광고비 미입금으로 미송출 · 8/19 자료에서 일 예산 상한 B안(28,000원) 권장, 결정 대기"} />
          </div>
          {err && <div className="flex items-center gap-2 text-[13px] text-[#f04452] bg-[#fff0f1] rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4" /> {err}</div>}
        </div>
        <div className="px-4 py-4 border-t border-[#e0e0db] flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>취소</Button>
          <Button onClick={submit} loading={busy} disabled={!since || !until || since > until || !cmpSince || !cmpUntil}>{busy ? <><Loader2 className="w-4 h-4 animate-spin" /> 생성 중…</> : "보고서 생성"}</Button>
        </div>
      </div>
    </div>
  )
}

// ───────── 기간별 광고비 현황 (일 · 주 · 월) ─────────
type Granularity = "day" | "week" | "month"
type Timeline = {
  since: string; until: string; granularity: Granularity; lastDataDate: string
  buckets: { key: string; label: string; start: string; end: string; pending: boolean; impressions: number; clicks: number; cost: number; conversions: number; ctr: number; cpc: number; activeDays: number; avgCost: number; cumCost: number; costDelta: number | null }[]
  total: { impressions: number; clicks: number; cost: number; conversions: number; ctr: number; cpc: number; activeDays: number; avgCost: number; avgBucketCost: number }
}
type Preset = "thisMonth" | "4w" | "12w" | "6m" | "year" | "custom"
const PRESETS: { key: Preset; label: string }[] = [
  { key: "thisMonth", label: "이번 달" }, { key: "4w", label: "최근 4주" }, { key: "12w", label: "최근 12주" }, { key: "6m", label: "최근 6개월" }, { key: "year", label: "올해" }, { key: "custom", label: "직접 입력" },
]
function presetRange(p: Preset): { since: string; until: string } {
  const now = new Date()
  const y = new Date(now); y.setDate(y.getDate() - 1) // 어제까지 확정치
  const until = ymdLocal(y)
  const s = new Date(y)
  if (p === "thisMonth") return { since: ymdLocal(new Date(now.getFullYear(), now.getMonth(), 1)), until }
  if (p === "4w") { s.setDate(s.getDate() - 27); return { since: ymdLocal(s), until } }
  if (p === "12w") { s.setDate(s.getDate() - 83); return { since: ymdLocal(s), until } }
  if (p === "6m") return { since: ymdLocal(new Date(now.getFullYear(), now.getMonth() - 5, 1)), until }
  if (p === "year") return { since: `${now.getFullYear()}-01-01`, until }
  return { since: ymdLocal(new Date(now.getFullYear(), now.getMonth(), 1)), until }
}
const G_LABEL: Record<Granularity, string> = { day: "일별", week: "주별", month: "월별" }

// 광고비는 연한 막대로 항상 뒤에 깔고, 버튼으로 고른 지표 하나를 선으로 그린다(내원경로 화면 형태)
const COST_METRIC: SwitchMetric = { key: "cost", name: "광고비", color: "#0062ff", light: "#e8f0ff", unit: "원", type: "bar", summary: "sum" }
const PERF_METRICS: SwitchMetric[] = [
  COST_METRIC,
  { key: "impressions", name: "노출수", color: "#6366f1", light: "#eef2ff", unit: "회", summary: "sum" },
  { key: "clicks", name: "클릭수", color: "#03c75a", light: "#e8f7f1", unit: "회", summary: "sum" },
  { key: "ctr", name: "클릭률", color: "#0ea5e9", light: "#e0f2fe", unit: "%", decimals: 2, summary: "avg" },
  { key: "cpc", name: "클릭당 비용", color: "#f04452", light: "#fff0f1", unit: "원", summary: "avg" },
  { key: "conversions", name: "전환수", color: "#b45309", light: "#fff8ec", unit: "회", summary: "sum" },
]

function TimelineSection({ clinicId }: { clinicId: string }) {
  const [g, setG] = useState<Granularity>("day")
  const [preset, setPreset] = useState<Preset>("thisMonth")
  const [range, setRange] = useState(() => presetRange("thisMonth"))
  const [data, setData] = useState<Timeline | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    fetch(`/api/naver-ads/timeline?clinicId=${clinicId}&since=${range.since}&until=${range.until}&granularity=${g}`)
      .then(async (r) => { if (toLoginIf401(r)) return null; const j = await r.json(); if (!r.ok) throw new Error(j.error); return j })
      .then((j) => { if (alive && j) setData(j) })
      .catch((e) => { if (alive) setErr(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [clinicId, range.since, range.until, g])

  const choosePreset = (p: Preset) => { setPreset(p); if (p !== "custom") setRange(presetRange(p)) }
  const chooseG = (ng: Granularity) => {
    setG(ng)
    if (preset === "custom") return
    const p: Preset = ng === "day" ? (preset === "thisMonth" || preset === "4w" ? preset : "4w") : ng === "week" ? (preset === "12w" || preset === "6m" ? preset : "12w") : (preset === "6m" || preset === "year" ? preset : "6m")
    setPreset(p); setRange(presetRange(p))
  }

  const t = data?.total
  const rows = data?.buckets ?? []
  const chartData = rows.map((b) => ({ label: g === "day" ? b.label.replace(/ \(.\)$/, "") : b.label, cost: b.cost, clicks: b.clicks, impressions: b.impressions, ctr: b.impressions ? b.ctr : null, cpc: b.clicks ? b.cpc : null, conversions: b.conversions }))
  const tab = (active: boolean) => `px-3.5 py-1.5 rounded-[8px] text-[13px] font-semibold transition ${active ? "bg-white text-[#191f28]" : "text-[#6b7684] hover:text-[#191f28]"}`
  const chip = (active: boolean) => `px-3 py-1.5 rounded-full text-[12px] font-semibold border transition ${active ? "bg-[#191f28] border-[#191f28] text-white" : "bg-white border-[#d1d1cc] text-[#4e5968] hover:bg-[#f2f2ef]"}`

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-[#e0e0db] flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[16px] font-semibold text-[#191f28]">광고비 현황</h3>
          <p className="text-[13px] text-[#8b95a1] mt-0.5">{dot(range.since)} ~ {dot(range.until)} · {G_LABEL[g]} 집계{data?.lastDataDate ? ` · ${dot(data.lastDataDate)}까지 수집됨` : ""}</p>
        </div>
        <div className="flex items-center gap-1 bg-[#f2f4f6] rounded-[10px] p-1">
          {(["day", "week", "month"] as Granularity[]).map((k) => <button key={k} className={tab(g === k)} onClick={() => chooseG(k)}>{G_LABEL[k]}</button>)}
        </div>
      </div>
      <div className="px-4 py-3 border-b border-[#e0e0db] flex items-center gap-2 flex-wrap">
        {PRESETS.map((p) => <button key={p.key} className={chip(preset === p.key)} onClick={() => choosePreset(p.key)}>{p.label}</button>)}
        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-1">
            <input type="date" className="px-2.5 py-1.5 rounded-[8px] border border-[#d1d1cc] text-[12px]" value={range.since} max={range.until} onChange={(e) => e.target.value && setRange((r) => ({ ...r, since: e.target.value }))} />
            <span className="text-[12px] text-[#8b95a1]">~</span>
            <input type="date" className="px-2.5 py-1.5 rounded-[8px] border border-[#d1d1cc] text-[12px]" value={range.until} min={range.since} onChange={(e) => e.target.value && setRange((r) => ({ ...r, until: e.target.value }))} />
          </div>
        )}
      </div>

      {err && <div className="px-4 py-3 text-[13px] text-[#f04452] bg-[#fff0f1]">{err}</div>}

      {t && (
        <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-[#e0e0db]">
          <Mini label="기간 광고비" value={won(t.cost)} />
          <Mini label={`${G_LABEL[g]} 평균 광고비`} value={won(t.avgBucketCost)} />
          <Mini label="송출일 일평균" value={won(t.avgCost)} sub={`${t.activeDays}일 송출`} />
          <Mini label="클릭 · CPC" value={`${num(t.clicks)}회 · ${won(t.cpc)}`} sub={`CTR ${pct(t.ctr)}`} />
        </div>
      )}

      <div className={`p-4 space-y-3 ${loading ? "opacity-50" : ""}`}>
        {rows.length === 0 ? (
          <div className="py-4 text-center text-[13px] text-[#8b95a1]">{loading ? "불러오는 중…" : "이 기간에 수집된 데이터가 없습니다. 동기화 후 다시 확인해 주세요."}</div>
        ) : (
          <div className="rounded-2xl border border-[#e0e0db] p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-[15px] font-bold text-[#191f28]">광고비 · 성과 지표</h4>
              <span className="text-[12px] text-[#8b95a1]">{G_LABEL[g]} 광고비는 막대로 항상 보이고, 버튼으로 고른 지표가 선으로 겹쳐집니다</span>
            </div>
            <MetricSwitchChart data={chartData} metrics={PERF_METRICS} background={COST_METRIC} storageKey="naverads.timeline.metric" height={320} periodLabel="기간" />
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto border-t border-[#e0e0db]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[#8b95a1] text-left border-b border-[#e0e0db]">
                <th className="px-4 py-3 font-medium">구간</th>
                <th className="px-3 py-3 font-medium text-right">송출일</th>
                <th className="px-3 py-3 font-medium text-right">노출</th>
                <th className="px-3 py-3 font-medium text-right">클릭</th>
                <th className="px-3 py-3 font-medium text-right">CTR</th>
                <th className="px-3 py-3 font-medium text-right">CPC</th>
                <th className="px-3 py-3 font-medium text-right">광고비</th>
                <th className="px-3 py-3 font-medium text-right">전 구간 대비</th>
                <th className="px-4 py-3 font-medium text-right">누적 광고비</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.key} className={`border-b border-[#e0e0db] last:border-0 hover:bg-[#f2f2ef] ${b.activeDays === 0 ? "text-[#b0b8c1]" : ""}`}>
                  <td className="px-4 py-2.5 font-medium text-[#191f28]">{b.label}{b.activeDays === 0 && <span className="ml-2 text-[11px] text-[#b45309] bg-[#fff8ec] rounded px-1.5 py-0.5">미송출</span>}</td>
                  <td className="px-3 py-2.5 text-right text-[#4e5968]">{g === "day" ? (b.activeDays ? "○" : "-") : `${b.activeDays}일`}</td>
                  <td className="px-3 py-2.5 text-right text-[#4e5968]">{num(b.impressions)}</td>
                  <td className="px-3 py-2.5 text-right text-[#4e5968]">{num(b.clicks)}</td>
                  <td className="px-3 py-2.5 text-right text-[#4e5968]">{b.impressions ? pct(b.ctr) : "-"}</td>
                  <td className="px-3 py-2.5 text-right text-[#4e5968]">{b.clicks ? won(b.cpc) : "-"}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#191f28]">{won(b.cost)}</td>
                  <td className={`px-3 py-2.5 text-right ${b.costDelta === null ? "text-[#b0b8c1]" : b.costDelta > 0 ? "text-[#f04452]" : "text-[#05c072]"}`}>{b.costDelta === null ? "-" : `${b.costDelta > 0 ? "+" : ""}${b.costDelta}%`}</td>
                  <td className="px-4 py-2.5 text-right text-[#4e5968]">{won(b.cumCost)}</td>
                </tr>
              ))}
            </tbody>
            {t && (
              <tfoot>
                <tr className="bg-[#f2f2ef] font-semibold text-[#191f28]">
                  <td className="px-4 py-3">합계</td>
                  <td className="px-3 py-3 text-right">{t.activeDays}일</td>
                  <td className="px-3 py-3 text-right">{num(t.impressions)}</td>
                  <td className="px-3 py-3 text-right">{num(t.clicks)}</td>
                  <td className="px-3 py-3 text-right">{pct(t.ctr)}</td>
                  <td className="px-3 py-3 text-right">{won(t.cpc)}</td>
                  <td className="px-3 py-3 text-right">{won(t.cost)}</td>
                  <td className="px-3 py-3 text-right text-[#8b95a1]">{G_LABEL[g]} 평균 {won(t.avgBucketCost)}</td>
                  <td className="px-4 py-3 text-right">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-[#f2f2ef] px-4 py-3">
      <div className="text-[12px] text-[#8b95a1]">{label}</div>
      <div className="text-[16px] font-bold text-[#191f28] mt-0.5 truncate">{value}</div>
      {sub && <div className="text-[11px] text-[#8b95a1] mt-0.5">{sub}</div>}
    </div>
  )
}
