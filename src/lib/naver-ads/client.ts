import { createHmac } from "crypto"

// 네이버 검색광고 API (https://naver.github.io/searchad-apidoc/)
// 인증: X-Timestamp, X-API-KEY, X-Customer, X-Signature = base64(HMAC-SHA256(`${ts}.${METHOD}.${uri}`, secret))

const BASE = "https://api.searchad.naver.com"

export type NaverAdCredentials = { customerId: string; apiKey: string; secretKey: string }

export type NaverCampaign = {
  nccCampaignId: string
  name: string
  campaignTp: string // WEB_SITE | SHOPPING | POWER_CONTENTS | BRAND_SEARCH | PLACE
  status: string // ELIGIBLE | PAUSED | DELETED ...
  userLock: boolean
  dailyBudget?: number
  useDailyBudget?: boolean
}

export type NaverStatRow = {
  id: string
  dateStart?: string
  dateEnd?: string
  impCnt: number
  clkCnt: number
  salesAmt: number
  ctr?: number
  cpc?: number
  avgRnk?: number
  ccnt?: number
}

export class NaverAdsError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message)
  }
}

function sign(secret: string, ts: string, method: string, uri: string) {
  return createHmac("sha256", secret).update(`${ts}.${method}.${uri}`).digest("base64")
}

export async function naverGet<T>(cred: NaverAdCredentials, uri: string, query?: Record<string, string>): Promise<T> {
  const ts = String(Date.now())
  const qs = query ? "?" + new URLSearchParams(query).toString() : ""
  const res = await fetch(`${BASE}${uri}${qs}`, {
    method: "GET",
    headers: {
      "X-Timestamp": ts,
      "X-API-KEY": cred.apiKey,
      "X-Customer": cred.customerId,
      "X-Signature": sign(cred.secretKey, ts, "GET", uri),
      "Content-Type": "application/json; charset=UTF-8",
    },
    cache: "no-store",
  })
  const text = await res.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!res.ok) {
    const msg = body?.title || body?.message || `네이버 API 오류 (${res.status})`
    throw new NaverAdsError(msg, res.status, body)
  }
  return body as T
}

export const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  WEB_SITE: "파워링크",
  SHOPPING: "쇼핑검색",
  POWER_CONTENTS: "파워컨텐츠",
  BRAND_SEARCH: "브랜드검색",
  PLACE: "플레이스",
  BRAND_SEARCH_NEW: "신제품검색",
}

export async function fetchCampaigns(cred: NaverAdCredentials) {
  return naverGet<NaverCampaign[]>(cred, "/ncc/campaigns")
}

/** 캠페인별 일자별 성과. 네이버 /stats 는 timeIncrement=1(일별)을 단일 id 조회에서만, 기간은 92일 이내만 지원하므로
 *  캠페인마다 · 최대 90일 단위로 나눠 호출한다. */
export async function fetchDailyStats(cred: NaverAdCredentials, campaignIds: string[], since: string, until: string) {
  const out: NaverStatRow[] = []
  const windows: [string, string][] = []
  let s = new Date(`${since}T00:00:00Z`)
  const end = new Date(`${until}T00:00:00Z`)
  while (s <= end) {
    const e = new Date(s); e.setUTCDate(e.getUTCDate() + 89)
    const w = e < end ? e : end
    windows.push([s.toISOString().slice(0, 10), w.toISOString().slice(0, 10)])
    s = new Date(w); s.setUTCDate(s.getUTCDate() + 1)
  }
  for (const id of campaignIds) {
    for (const [ws, we] of windows) {
      const res = await naverGet<{ data: NaverStatRow[] }>(cred, "/stats", {
        id,
        fields: JSON.stringify(["impCnt", "clkCnt", "salesAmt", "ctr", "cpc", "avgRnk", "ccnt"]),
        timeRange: JSON.stringify({ since: ws, until: we }),
        timeIncrement: "1",
      })
      for (const r of res?.data ?? []) out.push({ ...r, id })
    }
  }
  return out
}

/** 비즈머니 잔액(원). 권한이 없으면 null. */
export async function fetchBizmoney(cred: NaverAdCredentials): Promise<number | null> {
  try {
    const res = await naverGet<{ bizmoney?: number; budgetLock?: boolean }>(cred, "/billing/bizmoney")
    return typeof res?.bizmoney === "number" ? res.bizmoney : null
  } catch {
    return null
  }
}

export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
