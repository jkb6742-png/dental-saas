import { prisma } from "@/lib/db"
import { encryptText, decryptText } from "@/lib/security/encryption"
import { fetchCampaigns, fetchDailyStats, fetchBizmoney, ymd, CAMPAIGN_TYPE_LABEL, type NaverAdCredentials } from "./client"
import { isMailConfigured, sendMail, parseEmails } from "@/lib/mail"
import { createNotifications } from "@/lib/notifications"

export { ymd }

// 비밀값 저장: APP_ENCRYPTION_KEY 가 있으면 암호화, 없으면(구 NAS .env) 평문에 접두어를 붙여 구분
const PLAIN = "plain:"
export function protect(v: string) {
  try {
    return encryptText(v)
  } catch {
    return PLAIN + v
  }
}
export function reveal(v: string) {
  if (v.startsWith(PLAIN)) return v.slice(PLAIN.length)
  try {
    return decryptText(v)
  } catch {
    return v
  }
}

export function mask(v: string) {
  if (!v) return ""
  if (v.length <= 6) return "••••"
  return `${v.slice(0, 3)}••••${v.slice(-3)}`
}

export async function getCredentials(clinicId: string): Promise<(NaverAdCredentials & { accountId: string }) | null> {
  const acc = await prisma.naverAdAccount.findUnique({ where: { clinicId } })
  if (!acc || !acc.isActive) return null
  return { accountId: acc.id, customerId: acc.customerId, apiKey: reveal(acc.apiKey), secretKey: reveal(acc.secretKey) }
}

/** since~until(YYYY-MM-DD) 기간의 캠페인별 일 성과를 받아 upsert. 반환: 처리 행 수 */
export async function syncClinic(clinicId: string, since: string, until: string) {
  const cred = await getCredentials(clinicId)
  if (!cred) throw new Error("네이버 검색광고 계정이 연결되어 있지 않습니다")

  try {
    const campaigns = await fetchCampaigns(cred)
    const active = campaigns.filter((c) => c.status !== "DELETED")
    const byId = new Map(active.map((c) => [c.nccCampaignId, c]))
    const rows = active.length ? await fetchDailyStats(cred, active.map((c) => c.nccCampaignId), since, until) : []

    let n = 0
    for (const r of rows) {
      const dateStr = r.dateStart
      if (!dateStr) continue
      const c = byId.get(r.id)
      await prisma.naverAdDailyStat.upsert({
        where: { clinicId_date_campaignId: { clinicId, date: new Date(dateStr), campaignId: r.id } },
        create: {
          clinicId,
          date: new Date(dateStr),
          campaignId: r.id,
          campaignName: c?.name ?? r.id,
          campaignType: c?.campaignTp ?? null,
          impressions: r.impCnt ?? 0,
          clicks: r.clkCnt ?? 0,
          cost: Math.round(r.salesAmt ?? 0),
          avgRank: r.avgRnk ?? null,
          conversions: r.ccnt ?? 0,
        },
        update: {
          campaignName: c?.name ?? r.id,
          campaignType: c?.campaignTp ?? null,
          impressions: r.impCnt ?? 0,
          clicks: r.clkCnt ?? 0,
          cost: Math.round(r.salesAmt ?? 0),
          avgRank: r.avgRnk ?? null,
          conversions: r.ccnt ?? 0,
        },
      })
      n++
    }
    await prisma.naverAdAccount.update({ where: { id: cred.accountId }, data: { lastSyncAt: new Date(), lastSyncStatus: "SUCCESS", lastSyncError: null } })
    return { rows: n, campaigns: active.length }
  } catch (e: any) {
    await prisma.naverAdAccount.update({ where: { id: cred.accountId }, data: { lastSyncAt: new Date(), lastSyncStatus: "FAILED", lastSyncError: String(e?.message ?? e).slice(0, 500) } })
    throw e
  }
}

/** 기본 동기화 범위: 최근 35일 (이번 달 + 전월 비교분) */
export function defaultRange() {
  const until = new Date()
  until.setDate(until.getDate() - 1) // 전일까지 확정치
  const since = new Date(until)
  since.setDate(since.getDate() - 34)
  return { since: ymd(since), until: ymd(until) }
}

type Totals = { impressions: number; clicks: number; cost: number; conversions: number }
const zero = (): Totals => ({ impressions: 0, clicks: 0, cost: 0, conversions: 0 })
const add = (t: Totals, r: Totals) => { t.impressions += r.impressions; t.clicks += r.clicks; t.cost += r.cost; t.conversions += r.conversions }

/** 월 단위 집계(대시보드용) */
export async function monthlyStats(clinicId: string, year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  const prevStart = new Date(Date.UTC(year, month - 2, 1))

  const [rows, prevRows, account, avgDailyCost7] = await Promise.all([
    prisma.naverAdDailyStat.findMany({ where: { clinicId, date: { gte: start, lt: end } }, orderBy: { date: "asc" } }),
    prisma.naverAdDailyStat.findMany({ where: { clinicId, date: { gte: prevStart, lt: start } } }),
    prisma.naverAdAccount.findUnique({ where: { clinicId } }),
    recentAvgDailyCost(clinicId, 7),
  ])

  const total = zero()
  const prev = zero()
  rows.forEach((r) => add(total, r))
  prevRows.forEach((r) => add(prev, r))

  const daily = new Map<string, Totals & { date: string }>()
  for (const r of rows) {
    const key = ymd(new Date(r.date.getTime() + r.date.getTimezoneOffset() * 60000))
    const cur = daily.get(key) ?? { date: key, ...zero() }
    add(cur, r)
    daily.set(key, cur)
  }

  const campaigns = new Map<string, Totals & { campaignId: string; name: string; type: string; rankSum: number; rankN: number }>()
  for (const r of rows) {
    const cur = campaigns.get(r.campaignId) ?? { campaignId: r.campaignId, name: r.campaignName, type: CAMPAIGN_TYPE_LABEL[r.campaignType ?? ""] ?? r.campaignType ?? "-", rankSum: 0, rankN: 0, ...zero() }
    add(cur, r)
    if (r.avgRank && r.impressions > 0) { cur.rankSum += r.avgRank * r.impressions; cur.rankN += r.impressions }
    campaigns.set(r.campaignId, cur)
  }

  const kpi = (t: Totals) => ({
    ...t,
    ctr: t.impressions ? +(t.clicks / t.impressions * 100).toFixed(2) : 0,
    cpc: t.clicks ? Math.round(t.cost / t.clicks) : 0,
    cpa: t.conversions ? Math.round(t.cost / t.conversions) : 0,
  })

  return {
    year, month,
    hasData: rows.length > 0,
    avgDailyCost7,
    mailConfigured: isMailConfigured(),
    total: kpi(total),
    prev: kpi(prev),
    daily: Array.from(daily.values()),
    campaigns: Array.from(campaigns.values())
      .filter((c) => c.impressions > 0 || c.cost > 0) // 그 달에 송출이 없던 캠페인은 표에서 제외
      .map((c) => ({ ...kpi(c), campaignId: c.campaignId, name: c.name, type: c.type, avgRank: c.rankN ? +(c.rankSum / c.rankN).toFixed(1) : null }))
      .sort((a, b) => b.cost - a.cost),
    account: account ? {
      connected: true,
      isActive: account.isActive,
      customerId: account.customerId,
      lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
      lastSyncStatus: account.lastSyncStatus,
      lastSyncError: account.lastSyncError,
      alert: {
        enabled: account.alertEnabled,
        threshold: account.alertThreshold,
        threshold2: account.alertThreshold2,
        days: account.alertDays,
        emails: account.alertEmails ?? "",
        onSyncFail: account.alertOnSyncFail,
        autoMonthlyReport: account.autoMonthlyReport,
        lastAlertAt: account.lastAlertAt?.toISOString() ?? null,
      },
      lastBizmoney: account.lastBizmoney,
      lastBizmoneyAt: account.lastBizmoneyAt?.toISOString() ?? null,
    } : { connected: false, isActive: false, customerId: null, lastSyncAt: null, lastSyncStatus: null, lastSyncError: null, alert: null, lastBizmoney: null, lastBizmoneyAt: null },
  }
}

export type MonthlyStats = Awaited<ReturnType<typeof monthlyStats>>

/** 치과(조회 전용) 계정에는 알림 설정·키 정보·동기화 오류 내용을 내려주지 않는다 */
export function stripForViewer(stats: MonthlyStats) {
  stats.mailConfigured = false
  if (stats.account.connected) {
    stats.account.alert = null
    stats.account.customerId = null
    stats.account.lastSyncError = null
    stats.account.lastSyncStatus = null
  }
  return stats
}

export async function bizmoney(clinicId: string) {
  const cred = await getCredentials(clinicId)
  if (!cred) return null
  return fetchBizmoney(cred)
}

// ───────────────────────── 알림 ─────────────────────────

const wonFmt = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`
const dashboardUrl = (clinicId: string) => `${(process.env.NEXTAUTH_URL || "https://thinklabinsight.com").replace(/\/$/, "")}/dashboard/${clinicId}/naver-ads`

/** 최근 N일 중 광고가 나간 날 기준 일평균 광고비(원). 데이터 없으면 0 */
export async function recentAvgDailyCost(clinicId: string, days = 7) {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - days)
  const rows = await prisma.naverAdDailyStat.groupBy({ by: ["date"], where: { clinicId, date: { gte: since } }, _sum: { cost: true } })
  const active = rows.filter((r) => (r._sum.cost ?? 0) > 0)
  if (!active.length) return 0
  return Math.round(active.reduce((a, r) => a + (r._sum.cost ?? 0), 0) / active.length)
}

/** 네이버에서 비즈머니 잔액을 받아 저장. 실패하면 null */
export async function refreshBizmoney(clinicId: string) {
  const cred = await getCredentials(clinicId)
  if (!cred) return null
  const b = await fetchBizmoney(cred)
  if (b === null) return null
  const balance = Math.round(b)
  await prisma.naverAdAccount.update({ where: { id: cred.accountId }, data: { lastBizmoney: balance, lastBizmoneyAt: new Date() } })
  return balance
}

function mailLayout(title: string, body: string) {
  return `<div style="font-family:Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#191f28">
  <div style="font-size:11px;letter-spacing:3px;font-weight:800;color:#0E7C7B;margin-bottom:8px">THINKLAB INSIGHT</div>
  <h2 style="font-size:20px;margin:0 0 16px">${title}</h2>
  ${body}
  <p style="font-size:12px;color:#8b95a1;margin-top:28px">이 메일은 THINKLAB Insight 의 네이버 검색광고 알림 설정에 따라 자동 발송되었습니다.</p>
</div>`
}
const row = (k: string, v: string) => `<tr><td style="padding:8px 0;color:#6b7684;font-size:13px;width:150px">${k}</td><td style="padding:8px 0;font-size:14px;font-weight:600">${v}</td></tr>`

/**
 * 비즈머니 잔액을 확인하고 기준 이하이면 메일 발송.
 * - 평소: 알림 켜짐 + 기준 이하 + 24시간 내 미발송일 때만
 * - test: 조건과 무관하게 현재 잔액으로 메일을 보내 수신 확인(lastAlertAt 갱신 안 함)
 */
export async function checkBizmoneyAlert(clinicId: string, opts: { force?: boolean; test?: boolean } = {}) {
  const acc = await prisma.naverAdAccount.findUnique({ where: { clinicId }, include: { clinic: { select: { name: true } } } })
  if (!acc || !acc.isActive) return { sent: false, reason: "계정 미연결", balance: null as number | null }
  const emails = parseEmails(acc.alertEmails)
  const balance = await refreshBizmoney(clinicId)
  const avg = await recentAvgDailyCost(clinicId)
  const daysLeft = balance !== null && avg > 0 ? Math.floor(balance / avg) : null
  // 기준: alertDays 가 있으면 '일평균 × N일' 이하(1단계), 없으면 금액 기준(1차, 선택적으로 2차)
  // 단계마다 1회만 보내고, 잔액이 1차 기준 위로 올라오면(충전) 다시 보낼 수 있게 초기화한다
  const byDays = !!acc.alertDays && avg > 0
  const t1 = byDays ? Math.round(avg * acc.alertDays!) : acc.alertThreshold
  const t2 = !byDays && acc.alertThreshold2 != null && acc.alertThreshold2 < t1 ? acc.alertThreshold2 : null
  const level = balance === null ? 0 : t2 !== null && balance <= t2 ? 2 : balance <= t1 ? 1 : 0
  const low = level > 0
  const thresholdWon = level === 2 ? t2! : t1
  const thresholdText = byDays
    ? `${acc.alertDays}일분(일평균 ${wonFmt(avg)} × ${acc.alertDays}일 = ${wonFmt(t1)})`
    : t2 !== null ? (level === 2 ? `2차 ${wonFmt(t2)} (1차 ${wonFmt(t1)})` : `1차 ${wonFmt(t1)} (2차 ${wonFmt(t2)})`) : wonFmt(t1)
  const levelTag = t2 !== null && low ? ` ${level}차` : ""

  if (!opts.test) {
    if (!acc.alertEnabled) return { sent: false, reason: "알림 꺼짐", balance }
    if (balance === null) return { sent: false, reason: "잔액 조회 실패", balance }
    if (!low) {
      if (acc.lastAlertLevel !== 0) await prisma.naverAdAccount.update({ where: { id: acc.id }, data: { lastAlertLevel: 0 } })
      return { sent: false, reason: "기준 초과", balance }
    }
    if (!opts.force && level <= acc.lastAlertLevel) return { sent: false, reason: `${level}차 알림은 이미 보냄(충전되면 초기화)`, balance }
  }
  const name = acc.clinic.name
  const balanceText = balance === null ? "조회 실패" : wonFmt(balance)
  const subject = low
    ? `[THINKLAB] ${name} 네이버 검색광고 비즈머니 부족${levelTag} — 잔액 ${balanceText}`
    : `[THINKLAB] ${name} 네이버 검색광고 알림 테스트 (잔액 ${balanceText})`
  const body = `
  <p style="font-size:14px;line-height:1.6">${name} 네이버 검색광고 비즈머니 잔액이 ${low ? `설정한 기준(${thresholdText}) 이하로 내려왔습니다.` : "아래와 같습니다."}${opts.test ? " <b>(테스트 발송)</b>" : ""}</p>
  <table style="border-collapse:collapse;width:100%;margin:12px 0;border-top:1px solid #e5e8eb;border-bottom:1px solid #e5e8eb">
    ${row("현재 잔액", `<span style="color:${low ? "#f04452" : "#191f28"}">${balanceText}</span>`)}
    ${row("알림 기준", thresholdText)}
    ${row("최근 7일 일평균 광고비", avg ? wonFmt(avg) : "-")}
    ${row("예상 소진", daysLeft === null ? "-" : daysLeft <= 0 ? "오늘 중 소진" : `약 ${daysLeft}일분`)}
  </table>
  <p style="font-size:14px"><a href="https://searchad.naver.com" style="color:#0E7C7B;font-weight:700">네이버 광고관리시스템에서 충전하기</a></p>
  <p style="font-size:13px;color:#6b7684"><a href="${dashboardUrl(clinicId)}" style="color:#6b7684">THINKLAB Insight 에서 광고 현황 보기</a></p>`
  // 1) 앱 알림(마스터 전원) — 항상
  const daysText = daysLeft === null ? "" : daysLeft <= 0 ? " · 오늘 중 소진" : ` · 약 ${daysLeft}일분`
  const inApp = await createNotifications({
    type: "NAVER_BIZMONEY", clinicId,
    title: `${name} 비즈머니 ${low ? `부족${levelTag}` : "잔액 안내"}${opts.test ? " (테스트)" : ""} — ${balanceText}`,
    body: `${low ? `기준 ${byDays ? `${acc.alertDays}일분` : wonFmt(thresholdWon)} 이하. ` : ""}최근 7일 일평균 ${avg ? wonFmt(avg) : "-"}${daysText}. 네이버 광고관리시스템에서 충전이 필요합니다.`,
    link: `/dashboard/${clinicId}/naver-ads`, audience: "masters",
  })
  // 2) 메일 — 수신 메일과 SMTP 가 있을 때
  let mailed = 0
  let mailError: string | undefined
  if (emails.length && isMailConfigured()) {
    try { await sendMail({ to: emails, subject, html: mailLayout(low ? "비즈머니 잔액이 부족합니다" : "네이버 검색광고 잔액 안내", body) }); mailed = emails.length }
    catch (e: any) { mailError = e?.message }
  } else if (emails.length) mailError = "메일 서버(SMTP) 미설정"
  if (!opts.test) await prisma.naverAdAccount.update({ where: { id: acc.id }, data: { lastAlertAt: new Date(), lastAlertLevel: Math.max(level, acc.lastAlertLevel) } })
  return { sent: true, to: emails, balance, daysLeft, inApp, mailed, mailError }
}

/** 자동 동기화 실패 알림 (성공→실패로 바뀐 때 1회) */
export async function notifySyncFailure(clinicId: string, error: string) {
  const acc = await prisma.naverAdAccount.findUnique({ where: { clinicId }, include: { clinic: { select: { name: true } } } })
  if (!acc?.alertOnSyncFail) return false
  await createNotifications({
    type: "NAVER_SYNC_FAIL", clinicId, audience: "masters",
    title: `${acc.clinic.name} 네이버 검색광고 동기화 실패`,
    body: `${error.slice(0, 200)} — API 키 만료·권한 변경 여부를 확인해 주세요.`,
    link: `/dashboard/${clinicId}/naver-ads`,
  })
  const emails = parseEmails(acc.alertEmails)
  if (!emails.length || !isMailConfigured()) return true
  const body = `<p style="font-size:14px;line-height:1.6">${acc.clinic.name} 네이버 검색광고 자동 동기화가 실패했습니다. API 키 만료·권한 변경 여부를 확인해 주세요.</p>
  <pre style="background:#f2f4f6;border-radius:8px;padding:12px;font-size:12px;white-space:pre-wrap">${error.replace(/</g, "&lt;")}</pre>
  <p style="font-size:13px;color:#6b7684"><a href="${dashboardUrl(clinicId)}" style="color:#6b7684">연결 설정 열기</a></p>`
  await sendMail({ to: emails, subject: `[THINKLAB] ${acc.clinic.name} 네이버 검색광고 동기화 실패`, html: mailLayout("동기화 실패", body) })
  return true
}

// ───────────────────────── 기간별 현황(일·주·월) ─────────────────────────

export type Granularity = "day" | "week" | "month"

const kstDateStr = (d: Date) => ymd(new Date(d.getTime() + d.getTimezoneOffset() * 60000))
const isoWeekStart = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7 // 월=0
  d.setUTCDate(d.getUTCDate() - dow)
  return d
}

/** since~until 의 일 성과를 일/주/월 버킷으로 묶는다. 빈 날짜도 0 으로 채운다(일별만). */
export async function timelineStats(clinicId: string, since: string, until: string, granularity: Granularity) {
  const [rows, latest] = await Promise.all([
    prisma.naverAdDailyStat.findMany({
      where: { clinicId, date: { gte: new Date(`${since}T00:00:00Z`), lte: new Date(`${until}T00:00:00Z`) } },
      orderBy: { date: "asc" },
    }),
    prisma.naverAdDailyStat.findFirst({ where: { clinicId }, orderBy: { date: "desc" }, select: { date: true } }),
  ])
  // 아직 수집되지 않은 날(마지막 수집일 이후)은 미송출이 아니라 '미수집'으로 표시하고 평균에서 뺀다
  const lastDataDate = latest ? kstDateStr(latest.date) : ""
  type B = Totals & { key: string; label: string; start: string; end: string; activeDays: number; _days: Set<string> }
  const buckets = new Map<string, B>()
  const bucketOf = (dateStr: string): { key: string; label: string; start: string; end: string } => {
    const d = new Date(`${dateStr}T00:00:00Z`)
    if (granularity === "day") {
      const w = "일월화수목금토"[d.getUTCDay()]
      return { key: dateStr, label: `${d.getUTCMonth() + 1}/${d.getUTCDate()} (${w})`, start: dateStr, end: dateStr }
    }
    if (granularity === "week") {
      const ws = isoWeekStart(dateStr)
      const we = new Date(ws); we.setUTCDate(we.getUTCDate() + 6)
      const k = ws.toISOString().slice(0, 10)
      return { key: k, label: `${ws.getUTCMonth() + 1}/${ws.getUTCDate()}~${we.getUTCMonth() + 1}/${we.getUTCDate()}`, start: k, end: we.toISOString().slice(0, 10) }
    }
    const k = dateStr.slice(0, 7)
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
    return { key: k, label: `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`, start: `${k}-01`, end: last }
  }
  const ensure = (dateStr: string) => {
    const b = bucketOf(dateStr)
    let cur = buckets.get(b.key)
    if (!cur) { cur = { ...b, ...zero(), activeDays: 0, _days: new Set() }; buckets.set(b.key, cur) }
    return cur
  }
  // 일별은 빈 날짜도 채움
  if (granularity === "day") {
    for (let d = new Date(`${since}T00:00:00Z`); d <= new Date(`${until}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) ensure(d.toISOString().slice(0, 10))
  }
  for (const r of rows) {
    const ds = kstDateStr(r.date)
    const b = ensure(ds)
    add(b, r)
    if (r.impressions > 0 || r.cost > 0) b._days.add(ds)
  }
  const list = Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key))
  // 일별: 뒤쪽의 미수집일은 목록 끝에서 제거(마지막 수집일 이후 전부 비었을 때)
  while (granularity === "day" && list.length > 1 && list[list.length - 1].key > lastDataDate && list[list.length - 1]._days.size === 0) list.pop()
  let cum = 0
  const out = list.map((b, i) => {
    cum += b.cost
    const prev = list[i - 1]
    const activeDays = b._days.size
    const pending = granularity === "day" && b.key > lastDataDate
    return {
      key: b.key, label: b.label, start: b.start, end: b.end, pending,
      impressions: b.impressions, clicks: b.clicks, cost: b.cost, conversions: b.conversions,
      ctr: b.impressions ? +((b.clicks / b.impressions) * 100).toFixed(2) : 0,
      cpc: b.clicks ? Math.round(b.cost / b.clicks) : 0,
      activeDays,
      avgCost: activeDays ? Math.round(b.cost / activeDays) : 0,
      cumCost: cum,
      costDelta: prev && prev.cost ? +(((b.cost - prev.cost) / prev.cost) * 100).toFixed(1) : null,
    }
  })
  const total = zero()
  list.forEach((b) => add(total, b))
  const activeDays = new Set(list.flatMap((b) => Array.from(b._days))).size
  return {
    since, until, granularity, lastDataDate,
    buckets: out,
    total: {
      ...total,
      ctr: total.impressions ? +((total.clicks / total.impressions) * 100).toFixed(2) : 0,
      cpc: total.clicks ? Math.round(total.cost / total.clicks) : 0,
      activeDays,
      avgCost: activeDays ? Math.round(total.cost / activeDays) : 0,
      avgBucketCost: out.length ? Math.round(total.cost / out.length) : 0,
    },
  }
}
export type TimelineStats = Awaited<ReturnType<typeof timelineStats>>
