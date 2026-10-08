// 네이버 플레이스 공개 리뷰 페이지에서 리뷰를 읽는다 (브라우저 없이 HTML 안의 Apollo 상태를 파싱).
// 한 번에 최신 10건만 실려 오며, 그 이후 페이지(GraphQL)는 캡차로 막히므로 요청하지 않는다.
// 그래서 하루 몇 번 짧게 폴링해 새 리뷰를 쌓고, 월별 리뷰 수는 전체 리뷰 수(visitorTotal) 변화로 센다.

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

export interface NaverReview {
  id: string            // 네이버 리뷰 ID (스마트플레이스 답글 주소에 쓰이는 값)
  body: string
  authorName: string | null
  createdAt: Date | null
  originType: string | null  // 영수증, 결제내역, 예약 등
  replyBody: string | null
  replyAt: Date | null
}

export interface NaverPlaceReviews {
  placeId: string
  name: string | null
  visitorTotal: number
  blogTotal: number | null
  reviews: NaverReview[]
}

// 지원 형식: 숫자 ID, m.place.naver.com/hospital/123, map.naver.com/p/entry/place/123, naver.me 단축 주소
export async function resolveNaverPlaceId(input: string): Promise<string | null> {
  const trimmed = input.trim()
  if (/^\d{5,}$/.test(trimmed)) return trimmed
  const direct = extractPlaceId(trimmed)
  if (direct) return direct
  if (/naver\.me\//.test(trimmed)) {
    const res = await fetch(trimmed, { redirect: "follow", headers: { "user-agent": MOBILE_UA } })
    return extractPlaceId(res.url)
  }
  return null
}

function extractPlaceId(url: string): string | null {
  const m = url.match(/(?:place\.naver\.com\/(?:hospital|place|restaurant)|\/entry\/place|\/place)\/(\d{5,})/)
  return m ? m[1] : null
}

export async function fetchNaverPlaceReviews(placeId: string): Promise<NaverPlaceReviews> {
  const res = await fetch(`https://m.place.naver.com/hospital/${placeId}/review/visitor`, {
    headers: { "user-agent": MOBILE_UA, "accept-language": "ko-KR,ko;q=0.9" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`네이버 플레이스 응답 ${res.status}`)
  const state = extractApolloState(await res.text())
  if (!state) throw new Error("네이버 플레이스 페이지 구조가 바뀌었거나 차단되었습니다 (리뷰 데이터 없음)")

  const base = state[`PlaceDetailBase:${placeId}`] || {}
  const now = new Date()
  const reviews: NaverReview[] = []
  for (const value of Object.values<any>(state)) {
    // created 가 없는 항목은 사진 탭용 옛 리뷰 조각이라 제외
    if (value?.__typename !== "VisitorReview" || !value.id || !value.created) continue
    const author = value.author?.__ref ? state[value.author.__ref] : value.author
    reviews.push({
      id: value.id,
      body: value.body || "",
      authorName: author?.nickname || null,
      createdAt: parseNaverDate(value.created, now),
      originType: value.originType || null,
      replyBody: value.reply?.body || null,
      replyAt: value.reply?.date ? parseNaverDate(value.reply.date, now) : null,
    })
  }

  return {
    placeId,
    name: base.name ?? null,
    visitorTotal: Number(base.visitorReviewsTotal ?? 0),
    blogTotal: base.cafeBlogReviewsTotal != null ? Number(base.cafeBlogReviewsTotal) : null,
    reviews,
  }
}

function extractApolloState(html: string): Record<string, any> | null {
  const marker = html.indexOf("window.__APOLLO_STATE__")
  if (marker < 0) return null
  const start = html.indexOf("{", marker)
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < html.length; i++) {
    const c = html[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === "\\") esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === "{") depth++
    else if (c === "}" && --depth === 0) return JSON.parse(html.slice(start, i + 1))
  }
  return null
}

// "10.7.수"(올해) / "21.10.22.금"(연도 포함) → KST 자정 Date
export function parseNaverDate(text: string, now = new Date()): Date | null {
  const parts = text.split(".").map((p) => p.trim()).filter((p) => /^\d+$/.test(p)).map(Number)
  const kstNow = new Date(now.getTime() + 9 * 3600 * 1000)
  let year: number, month: number, day: number
  if (parts.length >= 3) [year, month, day] = [parts[0] > 99 ? parts[0] : 2000 + parts[0], parts[1], parts[2]] // "2024.10.22." 처럼 네 자리 연도도 허용
  else if (parts.length === 2) [year, month, day] = [kstNow.getUTCFullYear(), parts[0], parts[1]]
  else return null
  let date = new Date(Date.UTC(year, month - 1, day) - 9 * 3600 * 1000)
  // 연도 없는 날짜가 미래로 계산되면(1월에 본 12월 리뷰) 작년으로
  if (parts.length === 2 && date.getTime() > now.getTime() + 86400000) {
    date = new Date(Date.UTC(year - 1, month - 1, day) - 9 * 3600 * 1000)
  }
  return date
}
