import OpenAI from "openai"
import { prisma } from "@/lib/db"
import { ymd, CAMPAIGN_TYPE_LABEL } from "./client"
import { syncClinic, getCredentials } from "./service"
import { createNotifications } from "@/lib/notifications"
import { isMailConfigured, sendMail, parseEmails } from "@/lib/mail"

// 네이버 검색광고 운영 보고서
// 1) 기간·비교기간의 일별 성과를 DB에서 집계(수치는 전부 코드가 계산)
// 2) GPT 에는 집계 수치와 운영 메모만 주고 해석 문장(JSON)만 받는다
// 3) 기존 수기 보고서(네이버광고보고서/*.html)와 같은 레이아웃으로 HTML 을 만들어 저장

export type ReportInput = {
  clinicId: string
  since: string // YYYY-MM-DD
  until: string
  compareSince?: string
  compareUntil?: string
  memo?: string
  createdBy?: string
}

type Day = { date: string; impressions: number; clicks: number; cost: number; conversions: number }
type Agg = {
  impressions: number; clicks: number; cost: number; conversions: number
  days: number; activeDays: number
  ctr: number; cpc: number; clicksPer1kImp: number; clicksPer1mWon: number
  avgImp: number; avgClicks: number; avgCost: number; costVat: number
}
type Segment = Agg & { label: string; from: string; to: string }
type Campaign = Agg & { id: string; name: string; type: string }
export type PeriodData = {
  since: string; until: string; label: string; isFullMonth: boolean
  total: Agg; daily: Day[]; segments: Segment[]; weekday: Agg; weekend: Agg; zeroDays: string[]; campaigns: Campaign[]
}
export type ReportData = { clinicName: string; current: PeriodData; compare: PeriodData; generatedAt: string }

export type Narrative = {
  subtitle: string
  basisNote: string
  basisRows: { k: string; v: string }[]
  headline: string
  kpiComment: string
  segmentComment: string
  impressionChartComment: string
  ctrChartComment: string
  efficiencyComment: string
  interpretation: string[]
  nextIntro: string
  nextSteps: { title: string; body: string }[]
}

// ───────────── 날짜 유틸 ─────────────
const d2 = (n: number) => String(n).padStart(2, "0")
const parse = (s: string) => new Date(`${s}T00:00:00Z`)
const addDays = (s: string, n: number) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000) + 1
const md = (s: string) => `${parse(s).getUTCMonth() + 1}/${parse(s).getUTCDate()}`

export function monthRange(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { since: `${year}-${d2(month)}-01`, until: `${year}-${d2(month)}-${d2(last)}` }
}

function isFullMonth(since: string, until: string) {
  const s = parse(since), u = parse(until)
  return s.getUTCDate() === 1 && s.getUTCMonth() === u.getUTCMonth() && s.getUTCFullYear() === u.getUTCFullYear() && u.getUTCDate() === new Date(Date.UTC(u.getUTCFullYear(), u.getUTCMonth() + 1, 0)).getUTCDate()
}

/** 직전 같은 길이의 기간. 한 달 전체면 전월 전체 */
export function prevRange(since: string, until: string) {
  if (isFullMonth(since, until)) {
    const s = parse(since)
    return monthRange(s.getUTCMonth() === 0 ? s.getUTCFullYear() - 1 : s.getUTCFullYear(), s.getUTCMonth() === 0 ? 12 : s.getUTCMonth())
  }
  const n = daysBetween(since, until)
  return { since: addDays(since, -n), until: addDays(since, -1) }
}

export function periodLabel(since: string, until: string) {
  if (isFullMonth(since, until)) return `${parse(since).getUTCMonth() + 1}월`
  return `${md(since)}~${md(until)}`
}

// ───────────── 집계 ─────────────
function agg(days: Day[], calendarDays: number): Agg {
  const t = days.reduce((a, d) => ({ impressions: a.impressions + d.impressions, clicks: a.clicks + d.clicks, cost: a.cost + d.cost, conversions: a.conversions + d.conversions }), { impressions: 0, clicks: 0, cost: 0, conversions: 0 })
  const activeDays = days.filter((d) => d.impressions > 0 || d.cost > 0).length
  return {
    ...t,
    days: calendarDays,
    activeDays,
    ctr: t.impressions ? +((t.clicks / t.impressions) * 100).toFixed(2) : 0,
    cpc: t.clicks ? Math.round(t.cost / t.clicks) : 0,
    clicksPer1kImp: t.impressions ? +((t.clicks / t.impressions) * 1000).toFixed(1) : 0,
    clicksPer1mWon: t.cost ? Math.round((t.clicks / t.cost) * 1_000_000) : 0,
    avgImp: activeDays ? Math.round(t.impressions / activeDays) : 0,
    avgClicks: activeDays ? +(t.clicks / activeDays).toFixed(1) : 0,
    avgCost: activeDays ? Math.round(t.cost / activeDays) : 0,
    costVat: Math.round(t.cost * 1.1),
  }
}

async function periodData(clinicId: string, since: string, until: string): Promise<PeriodData> {
  const rows = await prisma.naverAdDailyStat.findMany({ where: { clinicId, date: { gte: parse(since), lte: parse(until) } }, orderBy: { date: "asc" } })
  const byDate = new Map<string, Day>()
  const n = daysBetween(since, until)
  for (let i = 0; i < n; i++) { const k = addDays(since, i); byDate.set(k, { date: k, impressions: 0, clicks: 0, cost: 0, conversions: 0 }) }
  const camp = new Map<string, { name: string; type: string; days: Map<string, Day> }>()
  for (const r of rows) {
    const k = r.date.toISOString().slice(0, 10)
    const d = byDate.get(k); if (!d) continue
    d.impressions += r.impressions; d.clicks += r.clicks; d.cost += r.cost; d.conversions += r.conversions
    const c = camp.get(r.campaignId) ?? { name: r.campaignName, type: CAMPAIGN_TYPE_LABEL[r.campaignType ?? ""] ?? r.campaignType ?? "-", days: new Map() }
    c.days.set(k, { date: k, impressions: r.impressions, clicks: r.clicks, cost: r.cost, conversions: r.conversions })
    camp.set(r.campaignId, c)
  }
  const daily = Array.from(byDate.values())
  const full = isFullMonth(since, until)

  // 구간: 월이면 1~10·11~20·21~말일, 아니면 3등분
  const bounds: [number, number][] = []
  if (full && n >= 28) bounds.push([0, 9], [10, 19], [20, n - 1])
  else if (n >= 6) { const a = Math.floor(n / 3), b = Math.floor((2 * n) / 3); bounds.push([0, a - 1], [a, b - 1], [b, n - 1]) }
  else bounds.push([0, n - 1])
  const segments: Segment[] = bounds.map(([a, b]) => {
    const slice = daily.slice(a, b + 1)
    return { ...agg(slice, slice.length), label: `${md(slice[0].date)} ~ ${md(slice[slice.length - 1].date)}`, from: slice[0].date, to: slice[slice.length - 1].date }
  })
  const wk = daily.filter((d) => { const w = parse(d.date).getUTCDay(); return w >= 1 && w <= 5 })
  const we = daily.filter((d) => { const w = parse(d.date).getUTCDay(); return w === 0 || w === 6 })

  return {
    since, until, label: periodLabel(since, until), isFullMonth: full,
    total: agg(daily, n), daily, segments,
    weekday: agg(wk, wk.length), weekend: agg(we, we.length),
    zeroDays: daily.filter((d) => d.impressions === 0 && d.cost === 0).map((d) => d.date),
    campaigns: Array.from(camp.entries()).map(([id, c]) => ({ id, name: c.name, type: c.type, ...agg(Array.from(c.days.values()), n) })).sort((a, b) => b.cost - a.cost),
  }
}

export async function buildReportData(clinicId: string, cur: { since: string; until: string }, cmp: { since: string; until: string }): Promise<ReportData> {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } })
  const [current, compare] = await Promise.all([periodData(clinicId, cur.since, cur.until), periodData(clinicId, cmp.since, cmp.until)])
  return { clinicName: clinic?.name ?? "", current, compare, generatedAt: new Date().toISOString() }
}

// ───────────── GPT 해석 ─────────────
const SYSTEM_PROMPT = `당신은 치과 마케팅 대행사 THINKLAB 의 경영실장이다. 네이버 검색광고 운영 보고서를 치과 원장에게 보낸다.
수치는 전부 주어진 데이터에서만 쓰고 새로 계산하거나 추정하지 않는다. 데이터에 없는 사실(경쟁사, 시장 상황, 날씨 등)은 쓰지 않는다.

문장 규칙
- 문체는 원장에게 보고하는 존댓말 "~입니다 / ~했습니다 / ~합니다" 체. "~한다 / ~했다 / ~부탁드린다" 같은 평어체 금지.
- 원장에게 필요한 말만 짧게. 자화자찬, 메타 설명("이 보고서는", "살펴보겠습니다"), 인사말 금지.
- 추측 어조 금지: "~로 보입니다", "~로 판단됩니다", "~할 수 있습니다", "한계가 있다", "조정 구간" 같은 표현 대신 수치 단정문으로 쓴다.
- 달력·휴일·진료일 차이를 핑계로 쓰지 않는다. 감소했으면 일별 데이터에서 어느 구간·어느 날이 빠졌는지 수치로 분해한다. 운영 메모에 미송출·입금 지연 같은 사실이 있으면 그 사실만 적는다.
- 수사의문문 금지. 제목·소제목은 평서 명사구.
- 숫자는 천 단위 쉼표, 원 단위 금액. CTR 은 소수점 둘째 자리(1.68%), 증감률은 소수점 첫째 자리(-18.8%). 변화는 "A → B(+C, +D%)" 형태. 날짜는 9/9 처럼 앞자리 0 없이.
- 데이터·메모에 없는 설정이나 요청(결제수단, 콜트래킹, UTM, 자동충전 등)을 쓰지 않는다. 운영 방향은 입찰·예산·소재·시간/요일·전환 추적 범위 안에서 데이터 근거와 함께 쓴다.
- 효율 판단 기준: CTR 높을수록, CPC 낮을수록 우수. 송출일이 다르면 합계가 아니라 일평균·CTR·CPC 로 비교한다.
- 전환수가 0이면 "전환 추적 미설정" 으로 적고 광고 효과로 해석하지 않는다.
- 운영 방향(nextSteps)은 4~6개, 각 항목은 제목(명사구)과 1~3문장. 원장이 결정해야 하는 항목은 제목 끝에 " — 원장님 확인 필요" 를 붙인다. 마지막 항목은 항상 지표 산출 기준(총클릭/총노출, 총실집행비/총클릭, 미송출일 제외 일평균)이다.

출력은 아래 키를 모두 가진 JSON 하나. 모든 값은 한국어 문자열이며 HTML 태그는 쓰지 않는다(강조는 **굵게** 만 허용).
{
 "subtitle": "헤더 부제 한 줄. 예: 8월 vs 9월 성과 비교 — 미송출 4일 영향 분리 및 예산 상한 결정",
 "basisNote": "운영 기준 안내 문단(2~3문장). 두 기간의 송출일 차이와 비교 기준",
 "basisRows": [{"k":"비교 구간","v":"..."},{"k":"...","v":"..."}],  // 2~3개. 비교 구간, 송출일 차이, 운영 메모의 결정 사항. 데이터 출처는 쓰지 않는다(자동 추가)
 "headline": "이번 기간을 한 문장으로 요약(📌 없이)",
 "kpiComment": "클릭·노출·CTR·CPC 변화를 수치로 한 문단(2~3문장)",
 "segmentComment": "구간별 흐름 표 해석 한 문단. 어느 구간이 끌어내렸는지/끌어올렸는지 수치로",
 "impressionChartComment": "일별 노출 추이 해석 1~2문장(최고·최저일 포함)",
 "ctrChartComment": "일별 CTR 추이 해석 1~2문장(CTR 3% 초과 일수 등)",
 "efficiencyComment": "노출 1,000회당 클릭·광고비 100만원당 클릭 변화 해석 한 문단",
 "interpretation": ["결과 해석 문장 5~7개. 각 1~2문장. 미송출→반응→구간→CPC→광고비→전환 추적 순"],
 "nextIntro": "다음 기간 운영 방향 도입 한 줄",
 "nextSteps": [{"title":"...","body":"..."}]
}`

function compactForPrompt(p: PeriodData) {
  const pick = (a: Agg) => ({ 노출: a.impressions, 클릭: a.clicks, 실집행비: a.cost, VAT포함: a.costVat, 전환: a.conversions, 달력일수: a.days, 송출일: a.activeDays, CTR: a.ctr, CPC: a.cpc, 노출1000회당클릭: a.clicksPer1kImp, 광고비100만원당클릭: a.clicksPer1mWon, 일평균노출: a.avgImp, 일평균클릭: a.avgClicks, 일평균광고비: a.avgCost })
  return {
    기간: `${p.since}~${p.until}`, 라벨: p.label,
    합계: pick(p.total),
    구간: p.segments.map((s) => ({ 구간: s.label, ...pick(s) })),
    평일: pick(p.weekday), 주말: pick(p.weekend),
    미송출일: p.zeroDays,
    일별: p.daily.map((d) => [d.date.slice(5), d.impressions, d.clicks, d.cost, d.conversions]),
    캠페인: p.campaigns.map((c) => ({ 이름: c.name, 유형: c.type, ...pick(c) })),
  }
}

async function writeNarrative(data: ReportData, memo?: string): Promise<{ narrative: Narrative; model: string }> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY 가 설정되어 있지 않습니다")
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const user = [
    `치과: ${data.clinicName}`,
    `보고 기간(현재): ${data.current.label} (${data.current.since}~${data.current.until})`,
    `비교 기간: ${data.compare.label} (${data.compare.since}~${data.compare.until})`,
    `운영 메모(사실로 취급): ${memo?.trim() || "없음"}`,
    `일별 배열 형식: [월-일, 노출, 클릭, 실집행비, 전환]`,
    "",
    "현재 기간 데이터:", JSON.stringify(compactForPrompt(data.current)),
    "",
    "비교 기간 데이터:", JSON.stringify(compactForPrompt(data.compare)),
  ].join("\n")

  const preferred = process.env.OPENAI_REPORT_MODEL || "gpt-5"
  const candidates = Array.from(new Set([preferred, "gpt-4o"]))
  let lastErr: any = null
  for (const model of candidates) {
    try {
      const res = await openai.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        // gpt-5 계열은 추론 단계가 길어 기본값이면 3분 넘게 걸린다. 수치가 이미 계산돼 있으므로 low 로 충분
        ...(model.startsWith("gpt-5") ? { reasoning_effort: "low" as const } : {}),
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: user }],
      })
      const text = res.choices[0]?.message?.content ?? "{}"
      const j = JSON.parse(text)
      const str = (v: any, fb = "") => (typeof v === "string" ? v.trim() : fb)
      const narrative: Narrative = {
        subtitle: str(j.subtitle, `${data.compare.label} vs ${data.current.label} 성과 비교`),
        basisNote: str(j.basisNote),
        basisRows: Array.isArray(j.basisRows) ? j.basisRows.filter((r: any) => r && r.k && r.v).map((r: any) => ({ k: str(r.k), v: str(r.v) })) : [],
        headline: str(j.headline),
        kpiComment: str(j.kpiComment),
        segmentComment: str(j.segmentComment),
        impressionChartComment: str(j.impressionChartComment),
        ctrChartComment: str(j.ctrChartComment),
        efficiencyComment: str(j.efficiencyComment),
        interpretation: Array.isArray(j.interpretation) ? j.interpretation.map((x: any) => str(x)).filter(Boolean) : [],
        nextIntro: str(j.nextIntro),
        nextSteps: Array.isArray(j.nextSteps) ? j.nextSteps.filter((s: any) => s && s.title).map((s: any) => ({ title: str(s.title), body: str(s.body) })) : [],
      }
      return { narrative, model }
    } catch (e: any) {
      lastErr = e
      console.error(`[naver-ads/report] ${model} 실패:`, e?.message)
    }
  }
  throw new Error(`GPT 해석 생성 실패: ${lastErr?.message ?? lastErr}`)
}

// ───────────── HTML ─────────────
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const rich = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`
const num = (n: number) => n.toLocaleString("ko-KR")
const pct = (n: number) => `${n.toFixed(2)}%`
const pctChange = (cur: number, prev: number) => (prev ? +(((cur - prev) / prev) * 100).toFixed(1) : null)
const signed = (n: number, unit = "", digits = 0) => `${n > 0 ? "+" : ""}${digits ? n.toFixed(digits) : num(Math.round(n))}${unit}`
const cls = (n: number | null, goodWhenUp = true) => (n === null || n === 0 ? "flat" : (n > 0) === goodWhenUp ? "pos" : "neg")

function barCompare(title: string, aLabel: string, a: number, bLabel: string, b: number, fmt: (n: number) => string, goodWhenUp: boolean) {
  const max = Math.max(a, b, 1e-9)
  const h = (v: number) => Math.max(4, (v / max) * 69)
  const better = goodWhenUp ? b >= a : b <= a
  const color = better ? "#0E7C7B" : "#B45309"
  return `<div class="chartwrap"><h3>${esc(title)}</h3><svg viewBox="0 0 900 150" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard,sans-serif"><line x1="40" y1="110" x2="860" y2="110" stroke="#D9E2EC"/><rect x="230" y="${(110 - h(a)).toFixed(1)}" width="180" height="${h(a).toFixed(1)}" rx="4" fill="#9FB3C8"/><rect x="560" y="${(110 - h(b)).toFixed(1)}" width="180" height="${h(b).toFixed(1)}" rx="4" fill="${color}"/><text x="320" y="${(102 - h(a)).toFixed(1)}" font-size="17" font-weight="800" fill="#486581" text-anchor="middle">${esc(fmt(a))}</text><text x="650" y="${(102 - h(b)).toFixed(1)}" font-size="17" font-weight="800" fill="${color}" text-anchor="middle">${esc(fmt(b))}</text><text x="320" y="130" font-size="12" fill="#627D98" text-anchor="middle">${esc(aLabel)}</text><text x="650" y="130" font-size="12" fill="#102A43" font-weight="700" text-anchor="middle">${esc(bLabel)}</text></svg></div>`
}

function lineChart(title: string, cmp: PeriodData, cur: PeriodData, pickVal: (d: Day) => number | null, fmt: (n: number) => string) {
  const W = 900, H = 190, L = 48, R = 20, T = 18, B = 34
  const n = Math.max(cmp.daily.length, cur.daily.length, 2)
  const x = (i: number) => L + (i * (W - L - R)) / (n - 1)
  const vals = [...cmp.daily, ...cur.daily].map(pickVal).filter((v): v is number => v !== null)
  const max = Math.max(...vals, 1e-9)
  const y = (v: number) => T + (1 - v / max) * (H - T - B)
  const path = (days: Day[]) => {
    let out = "", open = false
    days.forEach((d, i) => { const v = pickVal(d); if (v === null) { open = false; return } out += `${open ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `; open = true })
    return out.trim()
  }
  // 미송출일 음영(현재 기간)
  const bands = cur.daily.map((d, i) => (d.impressions === 0 && d.cost === 0 ? `<rect x="${(x(i) - (W - L - R) / (n - 1) / 2).toFixed(1)}" y="${T}" width="${((W - L - R) / (n - 1)).toFixed(1)}" height="${H - T - B}" fill="#FEF6E7"/>` : "")).join("")
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="${L}" y1="${y(max * f).toFixed(1)}" x2="${W - R}" y2="${y(max * f).toFixed(1)}" stroke="#EEF1F5"/>`).join("")
  const labels = [0, 0.5, 1].map((f) => `<text x="${L - 6}" y="${(y(max * f) + 4).toFixed(1)}" font-size="10" fill="#9AA5B1" text-anchor="end">${esc(fmt(max * f))}</text>`).join("")
  const step = Math.max(1, Math.ceil(n / 10))
  const xlabels = cur.daily.map((d, i) => (i % step === 0 || i === cur.daily.length - 1 ? `<text x="${x(i).toFixed(1)}" y="${H - 14}" font-size="10" fill="#9AA5B1" text-anchor="middle">${md(d.date)}</text>` : "")).join("")
  const legend = `<g font-size="11"><line x1="${L}" y1="${H - 2}" x2="${L + 22}" y2="${H - 2}" stroke="#9FB3C8" stroke-width="2" stroke-dasharray="5 4"/><text x="${L + 27}" y="${H + 2}" fill="#627D98">${esc(cmp.label)}</text><line x1="${L + 90}" y1="${H - 2}" x2="${L + 112}" y2="${H - 2}" stroke="#0E7C7B" stroke-width="2.5"/><text x="${L + 117}" y="${H + 2}" fill="#102A43" font-weight="700">${esc(cur.label)}</text>${cur.zeroDays.length ? `<rect x="${L + 180}" y="${H - 9}" width="14" height="9" fill="#FEF6E7" stroke="#F3E0BC"/><text x="${L + 199}" y="${H + 2}" fill="#8a6516">미송출</text>` : ""}</g>`
  return `<div class="chartwrap"><h3>${esc(title)}</h3><svg viewBox="0 0 ${W} ${H + 8}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard,sans-serif">${bands}${ticks}${labels}<path d="${path(cmp.daily)}" fill="none" stroke="#9FB3C8" stroke-width="2" stroke-dasharray="5 4"/><path d="${path(cur.daily)}" fill="none" stroke="#0E7C7B" stroke-width="2.5" stroke-linejoin="round"/>${xlabels}${legend}</svg></div>`
}

const CSS = `:root{--navy:#102A43;--navy2:#243B53;--teal:#0E7C7B;--teal-l:#ECF8F7;--ink:#334E68;--muted:#627D98;--line:#E6EBF1;--bg:#F4F6F9;--warn:#B45309;--warn-l:#FEF6E7}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Pretendard',-apple-system,sans-serif;color:var(--ink);background:#E9EDF2;-webkit-font-smoothing:antialiased;line-height:1.6;padding:24px 12px}
.page{max-width:880px;margin:0 auto 22px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 28px rgba(16,42,67,.10)}
.pad{padding:30px 34px}
header{background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;padding:30px 34px}
.brand{font-size:11px;letter-spacing:4px;font-weight:800;color:#7FD8D4;margin-bottom:14px}
header h1{font-size:23px;font-weight:800;letter-spacing:-.4px}
header .sub{margin-top:6px;font-size:13.5px;color:#BCCCDC;font-weight:500}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
.chip{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);border-radius:20px;padding:5px 13px;font-size:11.5px;color:#E3ECF5;font-weight:600}
.chip b{color:#7FD8D4}
h2{font-size:15px;font-weight:800;color:var(--navy);margin-bottom:14px;padding-left:11px;border-left:4px solid var(--teal)}
.sec{border-top:1px solid var(--line)}
p.note{font-size:13px;color:var(--muted)}
.basis{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:16px 18px}
.basis .row{display:grid;grid-template-columns:118px 1fr;gap:6px 14px;font-size:13px;padding:5px 0}
.basis .row+.row{border-top:1px dashed #DCE3EB}
.basis .k{color:var(--muted);font-weight:700}
.warnbox{background:#FFF8EC;border:1px solid #F3E0BC;border-radius:8px;padding:11px 14px;font-size:12.5px;color:#8a6516;margin-top:12px}
.kpis{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.kpi{border:1px solid var(--line);border-radius:12px;padding:18px 20px;position:relative}
.kpi .lab{font-size:12px;color:var(--muted);font-weight:700}
.kpi .big{font-size:30px;font-weight:800;color:var(--teal);margin:6px 0 2px}
.kpi.down .big{color:var(--warn)}
.kpi .flow{font-size:12.5px;color:#486581;font-weight:600}
.kpi .flow s{text-decoration:none;color:#9AA5B1}
.kpi .delta{position:absolute;top:16px;right:18px;font-size:12px;font-weight:800;background:var(--teal-l);color:var(--teal);border-radius:20px;padding:3px 10px}
.kpi.down .delta{background:var(--warn-l);color:var(--warn)}
.easy{background:linear-gradient(135deg,#0E7C7B,#13988f);border-radius:12px;padding:4px;display:grid;grid-template-columns:1fr 1fr;gap:4px}
.easy.down{background:linear-gradient(135deg,#B45309,#d97706)}
.ecard{background:#fff;border-radius:9px;padding:18px 20px;text-align:center}
.ecard .q{font-size:13px;font-weight:700;color:var(--navy);margin-bottom:12px}
.ecard .vs{display:flex;align-items:center;justify-content:center;gap:14px}
.ecard .num{display:flex;flex-direction:column;align-items:center}
.ecard .num .n{font-size:26px;font-weight:800;line-height:1}
.ecard .num small{font-size:11px;color:var(--muted);margin-top:3px;font-weight:600}
.ecard .old .n{color:#9AA5B1}
.ecard .new .n{color:var(--teal)}
.ecard .new.bad .n{color:var(--warn)}
.ecard .arr{font-size:20px;color:var(--teal);font-weight:800}
.ecard .gain{margin-top:11px;font-size:12px;font-weight:800;color:var(--teal);background:var(--teal-l);border-radius:20px;padding:3px 12px;display:inline-block}
.ecard .gain.bad{color:var(--warn);background:var(--warn-l)}
.oneline{margin-top:14px;background:var(--bg);border-left:4px solid var(--teal);border-radius:8px;padding:13px 16px;font-size:13.5px;color:var(--navy);font-weight:600}
.oneline.warn{border-left-color:var(--warn)}
.oneline b{color:var(--teal)}
.oneline.warn b{color:var(--warn)}
table{width:100%;border-collapse:collapse;font-size:12.7px}
th,td{padding:9px 8px;text-align:right;border-bottom:1px solid var(--line)}
th:first-child,td:first-child{text-align:left}
thead th{background:var(--navy);color:#fff;font-size:12px}
tbody tr:nth-child(even){background:#FAFBFC}
tr.hl td{background:#F2FBFA;font-weight:700;color:var(--teal)}
tr.spike td{background:#FEF6E7}
.pos{color:var(--teal);font-weight:800} .neg{color:var(--warn);font-weight:800} .flat{color:#627D98;font-weight:700}
.small{font-size:11px;color:#9AA5B1;margin-top:8px}
.chartwrap{border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:12px}
.chartwrap h3{font-size:12.5px;color:var(--muted);font-weight:700;margin-bottom:8px;text-align:center}
ul.read{list-style:none}
ul.read li{position:relative;padding:8px 0 8px 22px;font-size:13px;border-bottom:1px dashed #E6EBF1;line-height:1.65}
ul.read li:before{content:"";position:absolute;left:4px;top:14px;width:7px;height:7px;border-radius:50%;background:var(--teal)}
ul.read li b{color:var(--ink)}
.pl{display:grid;grid-template-columns:196px 1fr;gap:14px;border:1px solid var(--line);border-radius:9px;padding:12px 15px;font-size:12.8px;margin-bottom:10px}
.pl .h{font-weight:800;color:var(--teal)}
.pl.urgent{border-color:#F3E0BC;background:#FFFDF8}
.pl.urgent .h{color:var(--warn)}
footer{background:var(--bg);padding:18px 34px;font-size:11.5px;color:var(--muted);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
footer b{color:var(--navy)}
@media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0;margin:0;max-width:100%}@page{size:A4;margin:12mm}}
@media(max-width:680px){.kpis,.easy{grid-template-columns:1fr}.pl,.basis .row{grid-template-columns:1fr}}`

const AUTHOR = process.env.REPORT_AUTHOR || "THINKLAB 경영실장 장규복"

export function renderReportHtml(data: ReportData, n: Narrative): string {
  const cur = data.current, cmp = data.compare
  const t = cur.total, p = cmp.total
  const ctrPp = +(t.ctr - p.ctr).toFixed(2)
  const ctrPct = pctChange(t.ctr, p.ctr)
  const cpcPct = pctChange(t.cpc, p.cpc)
  const costPct = pctChange(t.cost, p.cost)
  const clicksPct = pctChange(t.clicks, p.clicks)
  const ctrDown = ctrPp < 0
  const cpcUp = t.cpc > p.cpc
  const title = `${data.clinicName} · 네이버 광고 운영 보고서`
  const gen = new Date(new Date(data.generatedAt).getTime() + 9 * 3600 * 1000)
  const genStr = `${gen.getUTCFullYear()}.${d2(gen.getUTCMonth() + 1)}.${d2(gen.getUTCDate())}`
  const rangeStr = (x: PeriodData) => `${x.since.replace(/-/g, ".")}~${x.until.slice(5).replace("-", ".")}`

  const segRow = (s: Agg & { label?: string }, hl = false, spike = false, label?: string) =>
    `<tr${hl ? ' class="hl"' : spike ? ' class="spike"' : ""}><td>${hl ? `<b>${esc(label ?? s.label ?? "")}</b>` : esc(label ?? s.label ?? "")}</td><td>${s.activeDays}</td><td>${num(s.impressions)}</td><td>${num(s.avgImp)}</td><td>${num(s.clicks)}</td><td>${s.impressions ? pct(s.ctr) : "&mdash;"}</td><td>${won(s.cost)}</td></tr>`
  const segTable = `<table><thead><tr><th>구간</th><th>송출일</th><th>노출수</th><th>일평균 노출</th><th>클릭수</th><th>CTR</th><th>실집행비</th></tr></thead><tbody>
${cmp.segments.map((s) => segRow(s, false, s.impressions === 0)).join("")}${segRow(cmp.total, true, false, `${cmp.label} 전체${cmp.total.activeDays !== cmp.total.days ? ` (${cmp.total.activeDays}일)` : ""}`)}
${cur.segments.map((s) => segRow(s, false, s.impressions === 0)).join("")}${segRow(cur.total, true, false, `${cur.label} 전체${cur.total.activeDays !== cur.total.days ? ` (${cur.total.activeDays}일)` : ""}`)}
</tbody></table>`

  const cmpRow = (k: string, a: string, b: string, d: string) => `<tr><td>${k}</td><td>${a}</td><td>${b}</td><td>${d}</td></tr>`
  const detail = `<table><thead><tr><th>항목</th><th>${esc(cmp.label)}</th><th>${esc(cur.label)}</th><th>증감</th></tr></thead><tbody>
${cmpRow("집행 구간", `${md(cmp.since)} ~ ${md(cmp.until)}`, `${md(cur.since)} ~ ${md(cur.until)}`, "&mdash;")}
${cmpRow("송출 일수", `${p.activeDays}일`, `${t.activeDays}일`, `<span class="${cls(t.activeDays - p.activeDays)}">${signed(t.activeDays - p.activeDays, "일")}</span>${cur.zeroDays.length ? ` (미송출 ${cur.zeroDays.map(md).join("·")})` : ""}`)}
${cmpRow("노출수", num(p.impressions), num(t.impressions), `<span class="${cls(t.impressions - p.impressions)}">${signed(t.impressions - p.impressions)} (${signed(pctChange(t.impressions, p.impressions) ?? 0, "%", 1)})</span>`)}
${cmpRow("일평균 노출 (송출일 기준)", num(p.avgImp), num(t.avgImp), `<span class="${cls(t.avgImp - p.avgImp)}">${signed(t.avgImp - p.avgImp)}</span>`)}
${cmpRow("클릭수", num(p.clicks), num(t.clicks), `<span class="${cls(t.clicks - p.clicks)}">${signed(t.clicks - p.clicks)} (${signed(clicksPct ?? 0, "%", 1)})</span>`)}
${cmpRow("일평균 클릭 (송출일 기준)", String(p.avgClicks), String(t.avgClicks), `<span class="${cls(t.avgClicks - p.avgClicks)}">${signed(t.avgClicks - p.avgClicks, "", 1)}</span>`)}
${cmpRow("클릭률 (CTR)", pct(p.ctr), pct(t.ctr), `<span class="${cls(ctrPp)}">${signed(ctrPp, "%p", 2)} (${signed(ctrPct ?? 0, "%", 1)})</span>`)}
${cmpRow("평균 CPC", won(p.cpc), won(t.cpc), `<span class="${cls(t.cpc - p.cpc, false)}">${signed(t.cpc - p.cpc, "원")} (${signed(cpcPct ?? 0, "%", 1)})</span>`)}
${cmpRow("노출 1,000회당 클릭", `${p.clicksPer1kImp}회`, `${t.clicksPer1kImp}회`, `<span class="${cls(t.clicksPer1kImp - p.clicksPer1kImp)}">${signed(t.clicksPer1kImp - p.clicksPer1kImp, "회", 1)}</span>`)}
${cmpRow("광고비 100만원당 클릭", `${num(p.clicksPer1mWon)}회`, `${num(t.clicksPer1mWon)}회`, `<span class="${cls(t.clicksPer1mWon - p.clicksPer1mWon)}">${signed(t.clicksPer1mWon - p.clicksPer1mWon, "회")}</span>`)}
${cmpRow("일평균 광고비 (송출일 기준)", won(p.avgCost), won(t.avgCost), `<span class="${cls(t.avgCost - p.avgCost, false)}">${signed(t.avgCost - p.avgCost, "원")}</span>`)}
${cmpRow("전환수", num(p.conversions), num(t.conversions), t.conversions || p.conversions ? `<span class="${cls(t.conversions - p.conversions)}">${signed(t.conversions - p.conversions)}</span>` : '<span class="flat">전환 추적 미설정</span>')}
${cmpRow("총 광고비(VAT 포함)", won(p.costVat), won(t.costVat), `<span class="${cls(t.costVat - p.costVat, false)}">${signed(t.costVat - p.costVat, "원")}</span>`)}
</tbody></table>
<p class="small">※ CTR=총클릭/총노출, CPC=총실집행비/총클릭 기준입니다. 총 광고비(VAT 포함)=실집행비×1.1. 실집행비 ${esc(cmp.label)} ${won(p.cost)} · ${esc(cur.label)} ${won(t.cost)}. 플랫폼 요약본은 CTR·CPC를 일별 평균으로 계산하므로 수치가 다릅니다.</p>`

  const campaignTable = cur.campaigns.length > 1 ? `<div class="pad sec"><h2>캠페인별 성과 (${esc(cur.label)})</h2>
<table><thead><tr><th>캠페인</th><th>유형</th><th>노출</th><th>클릭</th><th>CTR</th><th>CPC</th><th>실집행비</th></tr></thead><tbody>
${cur.campaigns.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.type)}</td><td>${num(c.impressions)}</td><td>${num(c.clicks)}</td><td>${c.impressions ? pct(c.ctr) : "&mdash;"}</td><td>${won(c.cpc)}</td><td>${won(c.cost)}</td></tr>`).join("")}
</tbody></table></div>` : ""

  const easyDown = t.clicksPer1kImp < p.clicksPer1kImp
  const easy = `<div class="easy${easyDown ? " down" : ""}">
<div class="ecard"><div class="q">광고를 1,000번 보여주면<br>클릭은 몇 번?</div><div class="vs"><div class="num old"><span class="n">${p.clicksPer1kImp}</span><small>${esc(cmp.label)}</small></div><div class="arr">&rarr;</div><div class="num new${t.clicksPer1kImp < p.clicksPer1kImp ? " bad" : ""}"><span class="n">${t.clicksPer1kImp}</span><small>${esc(cur.label)}</small></div></div><div class="gain${t.clicksPer1kImp < p.clicksPer1kImp ? " bad" : ""}">클릭 ${signed(t.clicksPer1kImp - p.clicksPer1kImp, "회", 1)} (${signed(pctChange(t.clicksPer1kImp, p.clicksPer1kImp) ?? 0, "%", 0)})</div></div>
<div class="ecard"><div class="q">광고비 100만원을 쓰면<br>클릭은 몇 번?</div><div class="vs"><div class="num old"><span class="n">${num(p.clicksPer1mWon)}</span><small>${esc(cmp.label)}</small></div><div class="arr">&rarr;</div><div class="num new${t.clicksPer1mWon < p.clicksPer1mWon ? " bad" : ""}"><span class="n">${num(t.clicksPer1mWon)}</span><small>${esc(cur.label)}</small></div></div><div class="gain${t.clicksPer1mWon < p.clicksPer1mWon ? " bad" : ""}">클릭 ${signed(t.clicksPer1mWon - p.clicksPer1mWon, "회")} (${signed(pctChange(t.clicksPer1mWon, p.clicksPer1mWon) ?? 0, "%", 1)})</div></div>
</div>`

  const basisRows = [
    ...(n.basisRows.length ? n.basisRows.filter((r) => !/출처/.test(r.k)) : [
      { k: "비교 구간", v: `${cmp.label} = ${md(cmp.since)}~${md(cmp.until)}(${p.activeDays}일) · ${cur.label} = ${md(cur.since)}~${md(cur.until)}(${t.activeDays}일 송출)` },
    ]),
    { k: "데이터 출처", v: `네이버 검색광고 API 일별 집행 내역 (${rangeStr(cur)})` },
  ]

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(data.clinicName)} · ${esc(cur.label)} 네이버 광고 운영 보고서</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<style>${CSS}</style>
</head>
<body>
<div class="page">
<header>
<div class="brand">T H I N K L A B &nbsp;&middot;&nbsp; MANAGEMENT REPORT</div>
<h1>${esc(title)}</h1>
<div class="sub">${esc(n.subtitle)}</div>
<div class="meta"><span class="chip">비교 기간 <b>${esc(cmp.label)} vs ${esc(cur.label)}</b></span><span class="chip">클릭률 <b>${ctrPct === null ? "-" : signed(ctrPct, "%", 1)}</b></span><span class="chip">CPC <b>${cpcPct === null ? "-" : signed(cpcPct, "%", 1)}</b></span><span class="chip">광고비 <b>${costPct === null ? "-" : signed(costPct, "%", 1)}</b></span><span class="chip">송출 <b>${t.activeDays}일 / ${t.days}일</b></span></div>
</header>

<div class="pad">
<h2>운영 기준 안내</h2>
${n.basisNote ? `<p class="note" style="margin-bottom:14px">${rich(n.basisNote)}</p>` : ""}
<div class="basis">${basisRows.map((r) => `<div class="row"><div class="k">${esc(r.k)}</div><div>${rich(r.v)}</div></div>`).join("")}</div>
${n.headline ? `<div class="warnbox">📌 ${rich(n.headline)}</div>` : ""}
</div>

<div class="pad sec">
<h2>핵심 성과 요약</h2>
<div class="kpis">
<div class="kpi${ctrDown ? " down" : ""}"><div class="delta">${ctrPct === null ? "-" : signed(ctrPct, "%", 0)}</div><div class="lab">클릭률 (CTR)</div><div class="big">${t.ctr.toFixed(2)}<span style="font-size:15px">%</span></div><div class="flow"><s>${esc(cmp.label)} ${pct(p.ctr)}</s> &rarr; <b style="color:${ctrDown ? "#B45309" : "#0E7C7B"}">${pct(t.ctr)}</b> (${signed(ctrPp, "%p", 2)})</div></div>
<div class="kpi${cpcUp ? " down" : ""}"><div class="delta">${cpcPct === null ? "-" : signed(cpcPct, "%", 1)}</div><div class="lab">평균 클릭비용 (CPC)</div><div class="big">${num(t.cpc)}<span style="font-size:15px">원</span></div><div class="flow"><s>${esc(cmp.label)} ${won(p.cpc)}</s> &rarr; <b style="color:${cpcUp ? "#B45309" : "#0E7C7B"}">${won(t.cpc)}</b> (${signed(t.cpc - p.cpc, "원")})</div></div>
</div>
${n.kpiComment ? `<div class="oneline${ctrDown ? " warn" : ""}">${rich(n.kpiComment)}</div>` : ""}
</div>

<div class="pad sec">
<h2>기간 내 구간별 흐름</h2>
${segTable}
${n.segmentComment ? `<div class="oneline${ctrDown ? " warn" : ""}">${rich(n.segmentComment)}</div>` : ""}
</div>

<div class="pad sec">
<h2>효율 지표 비교</h2>
${barCompare("클릭률 (CTR) — 높을수록 우수", cmp.label, p.ctr, cur.label, t.ctr, pct, true)}
${barCompare("평균 클릭비용 (CPC) — 낮을수록 우수", cmp.label, p.cpc, cur.label, t.cpc, won, false)}
${lineChart("일별 노출수 추이", cmp, cur, (d) => d.impressions, (v) => num(Math.round(v)))}
${n.impressionChartComment ? `<p class="note" style="margin:-4px 0 14px">${rich(n.impressionChartComment)}</p>` : ""}
${lineChart("일별 클릭률(CTR) 추이", cmp, cur, (d) => (d.impressions > 0 ? +((d.clicks / d.impressions) * 100).toFixed(2) : null), (v) => `${v.toFixed(1)}%`)}
${n.ctrChartComment ? `<p class="note" style="margin:-4px 0 0">${rich(n.ctrChartComment)}</p>` : ""}
</div>

<div class="pad sec">
<h2>효율성 분석</h2>
${easy}
${n.efficiencyComment ? `<div class="oneline${easyDown ? " warn" : ""}">${rich(n.efficiencyComment)}</div>` : ""}
</div>

<div class="pad sec">
<h2>${esc(cmp.label)} · ${esc(cur.label)} 상세 비교</h2>
${detail}
</div>
${campaignTable}
${n.interpretation.length ? `<div class="pad sec"><h2>결과 해석</h2><ul class="read">${n.interpretation.map((s) => `<li>${rich(s)}</li>`).join("")}</ul></div>` : ""}
${n.nextSteps.length ? `<div class="pad sec"><h2>다음 기간 운영 방향</h2>${n.nextIntro ? `<p class="note" style="margin-bottom:14px">${rich(n.nextIntro)}</p>` : ""}${n.nextSteps.map((s, i) => `<div class="pl${/확인 필요/.test(s.title) ? " urgent" : ""}"><div class="h">${"①②③④⑤⑥⑦⑧"[i] ?? ""} ${rich(s.title)}</div><div>${rich(s.body)}</div></div>`).join("")}</div>` : ""}
<footer><span>${esc(cmp.label)} vs ${esc(cur.label)} 효율 비교 자료 · 출처: 네이버 검색광고 API 일별 집행 내역 · 작성일 ${genStr}</span><span>작성 · <b>${esc(AUTHOR)}</b></span></footer>
</div>
</body>
</html>`
}

// ───────────── 생성 ─────────────
/** 보고서 행을 만들고(GENERATING) id 를 돌려준다. 실제 생성은 processReport */
export async function createReport(input: ReportInput) {
  const { clinicId, since, until } = input
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until) || since > until) throw new Error("기간이 올바르지 않습니다")
  if (daysBetween(since, until) > 92) throw new Error("기간은 최대 92일까지입니다")
  const cmp = input.compareSince && input.compareUntil ? { since: input.compareSince, until: input.compareUntil } : prevRange(since, until)
  if (cmp.since > cmp.until || daysBetween(cmp.since, cmp.until) > 92) throw new Error("비교 기간이 올바르지 않습니다")

  const cred = await getCredentials(clinicId)
  if (!cred) throw new Error("네이버 검색광고 계정이 연결되어 있지 않습니다")
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } })

  const report = await prisma.naverAdReport.create({
    data: {
      clinicId,
      title: `${clinic?.name ?? ""} · ${periodLabel(since, until)} 네이버 광고 운영 보고서`,
      periodStart: parse(since), periodEnd: parse(until),
      compareStart: parse(cmp.since), compareEnd: parse(cmp.until),
      memo: input.memo?.trim() || null,
      status: "GENERATING",
      createdBy: input.createdBy ?? null,
    },
  })
  return { id: report.id }
}

/** 동기화 → 집계 → GPT 해석 → HTML 저장. 실패하면 FAILED 로 기록하고 throw */
export async function processReport(id: string) {
  const report = await prisma.naverAdReport.findUnique({ where: { id } })
  if (!report) throw new Error("보고서가 없습니다")
  const clinicId = report.clinicId
  const since = report.periodStart.toISOString().slice(0, 10), until = report.periodEnd.toISOString().slice(0, 10)
  const cmp = { since: report.compareStart.toISOString().slice(0, 10), until: report.compareEnd.toISOString().slice(0, 10) }
  try {
    // 최신 수치 확보: 비교 시작일 ~ 어제까지(또는 종료일) 동기화
    const yesterday = ymd(new Date(Date.now() - 24 * 3600 * 1000))
    const syncSince = cmp.since < since ? cmp.since : since
    const syncUntil = until < yesterday ? until : yesterday
    if (syncSince <= syncUntil) await syncClinic(clinicId, syncSince, syncUntil)

    const data = await buildReportData(clinicId, { since, until }, cmp)
    if (!data.current.total.impressions && !data.current.total.cost) throw new Error("보고 기간에 집행 데이터가 없습니다")
    const { narrative, model } = await writeNarrative(data, report.memo ?? undefined)
    const html = renderReportHtml(data, narrative)
    const t = data.current.total, p = data.compare.total
    await prisma.naverAdReport.update({
      where: { id },
      data: {
        status: "DONE", model, html, error: null,
        summary: { impressions: t.impressions, clicks: t.clicks, cost: t.cost, ctr: t.ctr, cpc: t.cpc, activeDays: t.activeDays, days: t.days, prevCtr: p.ctr, prevCpc: p.cpc, prevCost: p.cost, currentLabel: data.current.label, compareLabel: data.compare.label },
      },
    })
    // 완료 알림: 자동 생성은 마스터+치과 계정 모두, 수동 생성은 마스터(생성자 제외)
    const auto = report.createdBy === "scheduler"
    const link = `/dashboard/${clinicId}/naver-ads/reports/${id}`
    await createNotifications({
      type: "NAVER_REPORT", clinicId, audience: auto ? "all" : "masters", exclude: auto ? [] : [report.createdBy ?? ""],
      title: `${data.clinicName} ${data.current.label} 네이버 광고 운영 보고서 ${auto ? "자동 생성 완료" : "생성 완료"}`,
      body: `광고비 ${t.cost.toLocaleString("ko-KR")}원 · CTR ${t.ctr}% · CPC ${t.cpc.toLocaleString("ko-KR")}원 (${data.compare.label} 대비 CTR ${p.ctr}%, CPC ${p.cpc.toLocaleString("ko-KR")}원)`,
      link,
    }).catch((e) => console.error("[naver-ads/report] 알림 실패", e?.message))
    if (auto && isMailConfigured()) {
      const acc = await prisma.naverAdAccount.findUnique({ where: { clinicId } })
      const emails = parseEmails(acc?.alertEmails)
      if (emails.length) {
        const abs = `${(process.env.NEXTAUTH_URL || "https://thinklabinsight.com").replace(/\/$/, "")}${link}`
        await sendMail({ to: emails, subject: `[THINKLAB] ${data.clinicName} ${data.current.label} 네이버 광고 운영 보고서`, html: `<p style="font-family:sans-serif;font-size:14px">${data.clinicName} ${data.current.label} 네이버 광고 운영 보고서가 준비되었습니다.</p><p><a href="${abs}">보고서 보기</a></p>` }).catch((e) => console.error("[naver-ads/report] 메일 실패", e?.message))
      }
    }
  } catch (e: any) {
    await prisma.naverAdReport.update({ where: { id }, data: { status: "FAILED", error: String(e?.message ?? e).slice(0, 500) } })
    throw e
  }
}

/** 생성 끝까지 기다리는 버전(스케줄러용) */
export async function generateReport(input: ReportInput) {
  const { id } = await createReport(input)
  await processReport(id)
  return { id }
}
