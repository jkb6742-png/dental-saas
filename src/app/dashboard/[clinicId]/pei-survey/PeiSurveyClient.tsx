"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import QRCode from "qrcode"
import { ClipboardList, Copy, Download, ExternalLink, QrCode, ChevronLeft, ChevronRight, Check, Table2 } from "lucide-react"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "@/components/charts/recharts"
import { AGE_RANGES, PEI_GRADES, itemLabel, peiGrade, isBuiltin, splitDoctorName } from "@/lib/pei-survey/questions"
import SurveyEditor from "./SurveyEditor"
import type { SurveyDTO, SurveyStats } from "@/lib/pei-survey/service"

type Props = { clinicId: string; initialSurvey: SurveyDTO; initialStats: SurveyStats; isMaster: boolean }

const card = "bg-white rounded-2xl border border-[#d1d1cc]"
const inputCls = "w-full px-3.5 py-2.5 rounded-[10px] border border-[#d1d1cc] bg-white text-[14px] text-[#191f28] placeholder:text-[#b0b8c1] focus:outline-none focus:border-[#0062ff] focus:ring-2 focus:ring-[#0062ff]/15 transition"
const labelCls = "block text-[13px] font-semibold text-[#4e5968] mb-1.5"
const tabCls = (on: boolean) => `px-4 py-2 rounded-[10px] text-[14px] font-semibold transition ${on ? "bg-white text-[#191f28]" : "text-[#6b7684] hover:text-[#191f28]"}`
const fmt2 = (v: number | null | undefined) => (v == null ? "-" : v.toFixed(2))
const toLoginIf401 = (res: Response) => {
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`
    return true
  }
  return false
}

export default function PeiSurveyClient({ clinicId, initialSurvey, initialStats, isMaster }: Props) {
  const [survey, setSurvey] = useState(initialSurvey)
  const [stats, setStats] = useState(initialStats)
  const [year, setYear] = useState(initialStats.year)
  const [month, setMonth] = useState(initialStats.month)
  const [origin, setOrigin] = useState("")
  const [qr, setQr] = useState("")
  const [copied, setCopied] = useState<"link" | "short" | "sms" | null>(null)
  const [tab, setTab] = useState<"stats" | "edit">("stats")
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  useEffect(() => { setOrigin(window.location.origin) }, [])
  const shortLink = origin ? `${origin}/s/${survey.token}` : ""
  const link = origin ? (survey.slug ? `${origin}/${survey.slug}` : shortLink) : "" // 한글 주소(/하얀드림치과설문) 우선
  const smsText = `[${survey.title.replace(/\s*진료만족도조사$/, "")}] 오늘 진료는 어떠셨나요? 1분 만족도 조사에 참여해 주시면 진료 환경 개선에 반영하겠습니다.\n${link}`

  useEffect(() => {
    if (!link) return
    QRCode.toDataURL(encodeURI(link), { width: 480, margin: 2, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(""))
  }, [link])

  const load = useCallback(async (y: number, m: number) => {
    const res = await fetch(`/api/pei-survey?clinicId=${clinicId}&year=${y}&month=${m}`)
    if (toLoginIf401(res) || !res.ok) return
    const json = await res.json()
    setSurvey(json.survey)
    setStats(json.stats)
  }, [clinicId])

  const shiftMonth = (d: number) => {
    let y = year, m = month + d
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setYear(y); setMonth(m)
    const url = new URL(window.location.href)
    url.searchParams.set("year", String(y)); url.searchParams.set("month", String(m))
    window.history.replaceState(null, "", url)
    load(y, m)
  }

  const copy = async (text: string, kind: "link" | "short" | "sms") => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setMsg({ kind: "err", text: "복사하지 못했습니다. 직접 선택해 복사해 주세요." })
    }
  }

  // 지금 설문에 들어 있는 PEI 점수 문항만 (지운 기본 문항은 빼고)
  const scoreQs = survey.questions.filter((q) => isBuiltin(q.id) && q.type === "scale5")
  const customQs = survey.questions.filter((q) => !isBuiltin(q.id))
  const itemRows = [
    ...scoreQs.map((q) => ({ key: q.id, label: itemLabel(q.id, q.text), text: q.text })),
    ...(survey.questions.some((q) => q.id === "recommend") ? [{ key: "recommend", label: "지인 권유 의향", text: "주위에 추천하시겠습니까? (10점 척도 ÷ 2)" }] : []),
  ]
  const optionRows = (id: string, groups: { name: string; count: number; pei: number | null }[]) => {
    const opts = survey.questions.find((q) => q.id === id)?.options ?? []
    const named = opts.map((o) => groups.find((g) => g.name === o) ?? { name: o, count: 0, pei: null })
    return [...named, ...groups.filter((g) => !opts.includes(g.name))] // 예전 선택지로 들어온 응답도 빠뜨리지 않게
  }
  const visitRows = optionRows("visit", stats.byVisit)
  const genderRows = optionRows("gender", stats.byGender)
  const ageRows = optionRows("age", stats.byAge)
  const ym = `${year}-${String(month).padStart(2, "0")}`
  const peiDelta = stats.pei != null && stats.prevPei != null ? stats.pei - stats.prevPei : null
  const trendData = stats.trend.map((t) => ({ ...t, label: `${Number(t.ym.slice(5))}월`, pei: t.pei == null ? null : Number(t.pei.toFixed(2)) }))
  const photoOf = (name: string) => survey.doctors.find((x) => x.name === name)?.photo

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#e8f3ff] flex items-center justify-center"><ClipboardList className="w-5 h-5 text-[#0062ff]" /></div>
          <div>
            <h1 className="text-[20px] font-bold text-[#191f28]">PEI 설문</h1>
            <p className="text-[13px] text-[#8b95a1]">환자 만족도 조사 링크를 보내고 응답을 모아 봅니다</p>
          </div>
        </div>
        {isMaster && (
          <div className="flex p-1 rounded-xl bg-[#f2f4f6]">
            <button type="button" onClick={() => setTab("stats")} className={tabCls(tab === "stats")}>응답 통계</button>
            <button type="button" onClick={() => setTab("edit")} className={tabCls(tab === "edit")}>설문 편집</button>
          </div>
        )}
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-xl text-[14px] ${msg.kind === "ok" ? "bg-[#e8f3ff] text-[#0052d6]" : "bg-[#fff0f1] text-[#d22030]"}`}>
          {msg.text}
        </div>
      )}

      {tab === "edit" ? (
        <SurveyEditor
          clinicId={clinicId}
          survey={survey}
          link={link}
          onSaved={(s, text) => { setSurvey(s); setMsg({ kind: "ok", text }); window.scrollTo({ top: 0, behavior: "smooth" }) }}
        />
      ) : (<>
      {/* 링크·QR */}
      <div className={`${card} p-3.5 grid gap-5 md:grid-cols-[1fr_auto]`}>
        <div className="min-w-0 space-y-2.5">
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-bold text-[#191f28]">{survey.title}</p>
            {survey.isActive ? <Badge variant="green">응답 받는 중</Badge> : <Badge variant="gray">중지됨</Badge>}
          </div>
          <div>
            <p className={labelCls}>설문 링크</p>
            <div className="flex gap-2">
              <input readOnly value={link} className={`${inputCls} font-mono text-[13px]`} onFocus={(e) => e.target.select()} />
              <Button variant="secondary" onClick={() => copy(link, "link")} disabled={!link}>
                {copied === "link" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <a href={link || "#"} target="_blank" rel="noreferrer" className="shrink-0">
                <Button variant="secondary"><ExternalLink className="w-4 h-4" /></Button>
              </a>
            </div>
            {survey.slug && shortLink && (
              <p className="mt-1.5 text-[12px] text-[#8b95a1] flex items-center gap-1.5 flex-wrap">
                한글 주소가 문자에서 링크로 안 잡히면 영문 링크
                <button type="button" onClick={() => copy(shortLink, "short")} className="font-mono text-[#4e5968] underline underline-offset-2">
                  {shortLink.replace(/^https?:\/\//, "")}
                </button>
                {copied === "short" && <Check className="w-3.5 h-3.5 text-[#0062ff]" />}
              </p>
            )}
          </div>
          <div>
            <p className={labelCls}>문자 발송 문구</p>
            <div className="flex gap-2 items-start">
              <textarea readOnly value={smsText} rows={3} className={`${inputCls} resize-none text-[13px]`} />
              <Button variant="secondary" onClick={() => copy(smsText, "sms")} disabled={!link}>
                {copied === "sms" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          {qr ? <img src={qr} alt="설문 QR 코드" className="w-40 h-40 rounded-xl border border-[#d1d1cc]" /> : <div className="w-40 h-40 rounded-xl bg-[#f2f4f6] flex items-center justify-center"><QrCode className="w-8 h-8 text-[#b0b8c1]" /></div>}
          {qr && (
            <a href={qr} download={`PEI설문_QR_${survey.title}.png`} className="text-[13px] font-semibold text-[#0062ff] flex items-center gap-1">
              <Download className="w-3.5 h-3.5" />QR 저장
            </a>
          )}
        </div>
      </div>

      {/* 월 선택 + 내보내기 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="w-9 h-9 rounded-lg hover:bg-[#f2f4f6] flex items-center justify-center" aria-label="이전 달"><ChevronLeft className="w-5 h-5 text-[#4e5968]" /></button>
          <p className="text-[17px] font-bold text-[#191f28] w-28 text-center">{year}년 {month}월</p>
          <button onClick={() => shiftMonth(1)} className="w-9 h-9 rounded-lg hover:bg-[#f2f4f6] flex items-center justify-center" aria-label="다음 달"><ChevronRight className="w-5 h-5 text-[#4e5968]" /></button>
        </div>
        <div className="flex gap-2">
          <a href={`/api/pei-survey/export?clinicId=${clinicId}&month=${ym}`}><Button variant="secondary"><Download className="w-4 h-4 mr-1.5" />{month}월 CSV</Button></a>
          <a href={`/api/pei-survey/export?clinicId=${clinicId}`}><Button variant="secondary"><Download className="w-4 h-4 mr-1.5" />전체 CSV</Button></a>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className={`${card} p-3.5`}>
          <p className="text-[13px] text-[#8b95a1]">응답 수</p>
          <p className="mt-1 text-[26px] font-bold text-[#191f28]">{stats.count.toLocaleString()}<span className="text-[15px] font-semibold text-[#8b95a1] ml-1">건</span></p>
        </div>
        <div className={`${card} p-3.5`}>
          <p className="text-[13px] text-[#8b95a1]">PEI 점수 (5점 만점)</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-[26px] font-bold" style={{ color: peiGrade(stats.pei)?.color ?? "#191f28" }}>{fmt2(stats.pei)}</p>
            <GradeBadge v={stats.pei} />
          </div>
          {peiDelta != null && (
            <p className={`mt-0.5 text-[13px] font-semibold ${peiDelta >= 0 ? "text-[#f04452]" : "text-[#0062ff]"}`}>
              전월 대비 {peiDelta >= 0 ? "▲" : "▼"} {Math.abs(peiDelta).toFixed(2)}
            </p>
          )}
        </div>
        <div className={`${card} p-3.5 col-span-2 md:col-span-1`}>
          <p className="text-[13px] text-[#8b95a1]">지인 권유 의향</p>
          <p className="mt-1 text-[26px] font-bold text-[#191f28]">{fmt2(stats.items.recommend)}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        {/* 항목별 점수 */}
        <div className={`${card} p-3.5`}>
          <p className="text-[15px] font-bold text-[#191f28] mb-3">항목별 점수</p>
          <div className="divide-y divide-[#f2f4f6]">
            {itemRows.map((r) => {
              const v = stats.items[r.key] ?? null
              return (
                <div key={r.key} className="py-2 flex items-center gap-3" title={r.text}>
                  <p className="w-36 shrink-0 text-[14px] font-semibold text-[#333d4b] truncate">{r.label}</p>
                  <div className="flex-1 h-2 rounded-full bg-[#f2f4f6] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${v ? (v / 5) * 100 : 0}%`, background: peiGrade(v)?.color ?? "#0062ff" }} />
                  </div>
                  <p className="w-12 text-right text-[15px] font-bold" style={{ color: peiGrade(v)?.color ?? "#191f28" }}>{fmt2(v)}</p>
                  <span className="w-[68px] text-right"><GradeBadge v={v} /></span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#8b95a1]">
            {PEI_GRADES.map((g, i) => (
              <span key={g.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                {g.label} {i === 0 ? `${g.min} 이상` : g.min === 0 ? `${PEI_GRADES[i - 1].min} 미만` : `${g.min}~${PEI_GRADES[i - 1].min}`}
              </span>
            ))}
          </div>
          <p className="mt-1 text-[12px] text-[#8b95a1]">경험 없음 응답은 평균에서 제외. PEI = 10개 항목 단순 평균</p>
        </div>

        <div className="space-y-5">
          {/* 의료진별 — 응답 수 + PEI */}
          <div className={`${card} p-3.5`}>
            <p className="text-[15px] font-bold text-[#191f28] mb-3">의료진별</p>
            {stats.byDoctor.length === 0 ? (
              <p className="text-[14px] text-[#8b95a1]">응답 없음</p>
            ) : (
              <div className="space-y-2.5">
                {stats.byDoctor.map((d) => {
                  const photo = photoOf(d.name)
                  return (
                    <div key={d.name} className="flex items-center gap-2.5 text-[14px]">
                      <span className="w-9 h-9 rounded-full bg-[#f2f4f6] overflow-hidden shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {photo && <img src={photo} alt="" className="w-full h-full object-cover object-top" />}
                      </span>
                      <span className="text-[#333d4b] truncate mr-auto">{splitDoctorName(d.name).title}</span>
                      <span className="text-[#8b95a1] w-10 text-right">{d.count}건</span>
                      <span className="font-bold text-[#191f28] w-11 text-right">{fmt2(d.pei)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 받은 진료별 (중복 선택이라 합계가 응답 수보다 많을 수 있음) */}
          <div className={`${card} p-3.5`}>
            <p className="text-[15px] font-bold text-[#191f28] mb-3">받은 진료별</p>
            {stats.byTreatment.length === 0 ? (
              <p className="text-[14px] text-[#8b95a1]">응답 없음</p>
            ) : (
              <div className="space-y-1.5">
                {stats.byTreatment.map((t) => (
                  <div key={t.name} className="flex items-center gap-2 text-[13px]">
                    <span className="w-28 text-[#4e5968] truncate">{t.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-[#f2f4f6] overflow-hidden">
                      <div className="h-full bg-[#90c2ff]" style={{ width: `${stats.count ? (t.count / stats.count) * 100 : 0}%` }} />
                    </div>
                    <span className="w-9 text-right text-[#8b95a1]">{t.count}건</span>
                    <span className="w-10 text-right font-semibold text-[#191f28]">{fmt2(t.pei)}</span>
                  </div>
                ))}
                <p className="pt-1 text-[12px] text-[#8b95a1]">중복 선택이라 합계가 응답 수보다 많을 수 있습니다</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 응답자 구성 — 방문 구분·성별·연령대별 응답 수, 비율, PEI */}
      <div className={`${card} p-3.5`}>
        <p className="text-[15px] font-bold text-[#191f28] mb-2.5">응답자 구성</p>
        {stats.count === 0 ? (
          <p className="text-[14px] text-[#8b95a1]">응답 없음</p>
        ) : (
          <div className={`grid gap-3 ${visitRows.length ? "md:grid-cols-[1fr_1fr_1.6fr]" : "md:grid-cols-[1fr_1.6fr]"}`}>
            {[
              ...(visitRows.length ? [{ title: "방문 구분", rows: visitRows, color: "#8b7cf6" }] : []),
              { title: "성별", rows: genderRows, color: "#0062ff" },
              { title: "연령대", rows: ageRows, color: "#4cc3b4" },
            ].map((g) => (
              <div key={g.title}>
                <div className="flex items-center text-[12px] text-[#8b95a1] mb-2">
                  <span className="mr-auto font-semibold text-[#4e5968]">{g.title}</span>
                  <span className="w-14 text-right">응답</span>
                  <span className="w-12 text-right">비율</span>
                  <span className="w-12 text-right">PEI</span>
                </div>
                <div className="space-y-2">
                  {g.rows.map((r) => (
                    <div key={r.name} className="flex items-center gap-2 text-[13px]">
                      <span className="w-[86px] shrink-0 text-[#4e5968]">
                        {r.name}
                        {AGE_RANGES[r.name] && <span className="block text-[11px] text-[#b0b8c1]">{AGE_RANGES[r.name]}</span>}
                      </span>
                      <div className="flex-1 h-5 rounded-md bg-[#f2f4f6] overflow-hidden">
                        <div className="h-full rounded-md" style={{ width: `${(r.count / stats.count) * 100}%`, background: g.color, opacity: r.count ? 0.85 : 0 }} />
                      </div>
                      <span className="w-12 text-right text-[#191f28] font-semibold">{r.count}건</span>
                      <span className="w-12 text-right text-[#8b95a1]">{Math.round((r.count / stats.count) * 100)}%</span>
                      <span className="w-12 text-right font-semibold text-[#191f28]">{r.count ? fmt2(r.pei) : "-"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 직접 더한 문항 — 선택형은 선택 수, 점수형은 평균, 글은 응답 수 (내용은 아래 응답 목록에서) */}
      {customQs.length > 0 && (
        <div className={`${card} p-3.5`}>
          <p className="text-[15px] font-bold text-[#191f28] mb-3">추가 문항</p>
          <div className="grid gap-5 md:grid-cols-2">
            {customQs.map((q) => {
              const vals = stats.responses.map((r) => r.answers[q.id]).filter((v) => v != null && v !== "")
              let body: React.ReactNode
              if (q.type === "single" || q.type === "multi") {
                body = (q.options ?? []).map((o) => {
                  const n = vals.filter((v) => (Array.isArray(v) ? v.includes(o) : v === o)).length
                  return (
                    <div key={o} className="flex items-center gap-2 text-[13px]">
                      <span className="w-28 text-[#4e5968] truncate">{o}</span>
                      <div className="flex-1 h-2 rounded-full bg-[#f2f4f6] overflow-hidden"><div className="h-full bg-[#90c2ff]" style={{ width: `${vals.length ? (n / vals.length) * 100 : 0}%` }} /></div>
                      <span className="w-9 text-right text-[#8b95a1]">{n}건</span>
                    </div>
                  )
                })
              } else if (q.type === "scale5" || q.type === "scale10") {
                const nums = vals.map(Number).filter((v) => v > 0)
                body = (
                  <p className="text-[22px] font-bold text-[#191f28]">
                    {nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : "-"}
                    <span className="ml-1 text-[13px] font-semibold text-[#8b95a1]">/ {q.type === "scale5" ? 5 : 10}</span>
                  </p>
                )
              } else {
                body = <p className="text-[13px] text-[#8b95a1]">글 응답 {vals.length}건 — 응답 시트에서 볼 수 있습니다</p>
              }
              return (
                <div key={q.id}>
                  <p className="text-[14px] font-semibold text-[#333d4b] mb-2">{q.text} <span className="text-[12px] font-normal text-[#8b95a1]">응답 {vals.length}</span></p>
                  <div className="space-y-1.5">{body}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 추이 — 응답 수(막대) + PEI(선) */}
      <div className={`${card} p-3.5`}>
        <p className="text-[15px] font-bold text-[#191f28] mb-3">최근 12개월 추이</p>
        {trendData.length === 0 ? (
          <p className="text-[14px] text-[#8b95a1] py-3 text-center">응답 없음</p>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="#f2f4f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="c" tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis yAxisId="p" orientation="right" domain={[1, 5]} tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any, k: any) => (k === "pei" ? [v, "PEI"] : [`${v}건`, "응답"])} labelFormatter={(l) => String(l)} />
                <Line isAnimationActive={false} type="monotone" strokeWidth={2} dot={{ r: 3 }} yAxisId="c" dataKey="count" stroke="#c9e2ff" />
                <Line isAnimationActive={false} yAxisId="p" dataKey="pei" stroke="#0062ff" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 응답 원문은 월별 시트 화면에서 */}
      <Link href={`/dashboard/${clinicId}/pei-survey/responses?year=${year}&month=${month}`} className={`${card} p-3.5 flex items-center gap-3 hover:bg-[#f2f2ef] transition`}>
        <div className="w-10 h-10 rounded-xl bg-[#e8f3ff] flex items-center justify-center shrink-0"><Table2 className="w-5 h-5 text-[#0062ff]" /></div>
        <div className="mr-auto">
          <p className="text-[15px] font-bold text-[#191f28]">응답 시트</p>
          <p className="text-[13px] text-[#8b95a1]">{month}월 응답 {stats.count}건 · 월별 탭으로 응답 원문을 한 줄씩 봅니다</p>
        </div>
        <ChevronRight className="w-5 h-5 text-[#b0b8c1]" />
      </Link>
      </>)}
    </div>
  )
}

/** 점수 등급 배지 — 매우 우수 / 우수 / 보통 / 개선 필요 */
function GradeBadge({ v }: { v: number | null | undefined }) {
  const g = peiGrade(v)
  if (!g) return null
  return (
    <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap" style={{ color: g.color, background: g.bg }}>
      {g.label}
    </span>
  )
}
