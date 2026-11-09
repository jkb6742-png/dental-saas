import { auth } from "@/auth"
import { NextResponse } from "next/server"

// 개발 중 쓰던 계정·데이터 조작 주소. 운영에서 열려 있으면 안 되므로 누구에게도 열지 않는다.
const BLOCKED = [
  "/setup-master",
  "/test-account",
  "/test-clinic",
  "/test-signup",
  "/api/debug/reset-password",
  "/api/debug/update-admin",
  "/api/debug/force-fix",
  "/api/debug/force-reset",
  "/api/debug/super-fix",
  "/api/debug/create-test-agencies",
  "/api/admin/create-dev-user",
  "/api/admin/fix-roles",
  "/api/admin/setup",
  "/api/admin/setup-initial",
  "/api/fix-ethinkdent",
  "/api/patients/fix-waiting-time",
  "/api/ultra-simple",
]

// 로그인 없이 쓰는 주소: 인증, 회원가입, 환자 설문, 자체 비밀값으로 보호되는 예약 호출
const PUBLIC_API = ["/api/auth", "/api/public", "/api/signup", "/api/reviews/auto-sync"]

// 마스터 전용 (읽기 포함)
const MASTER_ONLY = [
  "/admin",
  "/reports",
  "/pei-reports",
  "/api/admin",
  "/api/debug",
  "/api/debug-clinic",
  "/api/debug-excel",
  "/api/check-db-data",
  "/api/cleanup-orphaned",
  "/api/generate-patient-stats",
  "/api/excel-upload",
  "/api/pei/generate",
  "/api/pei/generate-excel",
  "/api/pei/pdf_disabled",
  "/api/requests/init-db",
  "/api/reviews/init-db",
]

// 비마스터가 변경 요청을 보낼 수 있는 API. 각 라우트가 소속 치과·역할을 직접 검사한다.
// 여기에 없는 API 의 변경 요청은 마스터만 가능하다 (기본 거부).
const VIEWER_WRITE_API = [
  "/api/notifications",
  "/api/requests",
  "/api/action-plans",
  "/api/site-leads/sync",
  "/api/reviews/manual",
  "/api/reviews/crawl",
  "/api/reviews/config",
  "/api/reports",
  "/api/report-management",
  "/api/naver-ads",
  "/api/pei-survey",
  "/api/pei/upload-html",
  "/api/goals",
]

// 한 단계 주소 중 한글 설문 주소(/지음치과설문)가 아닌 것
const RESERVED_ROOT = new Set(["dashboard", "admin", "api", "login", "signup", "reports", "pei-reports", "s"])

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)

const denied = (status: 401 | 403 | 404, isApi: boolean, redirectTo: URL) => {
  if (isApi) {
    const error = status === 401 ? "인증이 필요합니다" : status === 403 ? "권한이 없습니다" : "Not found"
    return NextResponse.json({ error }, { status })
  }
  return status === 404 ? new NextResponse("Not found", { status: 404 }) : NextResponse.redirect(redirectTo)
}

export default auth(async (req) => {
  const { nextUrl } = req
  const path = nextUrl.pathname
  const method = req.method.toUpperCase()
  const isRead = method === "GET" || method === "HEAD"
  const isApi = under(path, "/api")

  // 리버스 프록시 뒤에서도 브라우저가 보는 주소로 이동시킨다
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? nextUrl.host
  const proto = req.headers.get("x-forwarded-proto") ?? nextUrl.protocol.replace(":", "")
  const to = (p: string) => new URL(p, `${proto}://${host}`)

  const user = req.auth?.user as { role?: string; clinicId?: string | null; status?: string } | undefined
  // 인증 설정 오류 때 req.auth 에는 사용자 대신 오류 메시지가 들어온다. 사용자 정보로만 판단한다.
  // 승인이 취소된 계정은 로그인하지 않은 것으로 다룬다.
  const isLoggedIn = !!user && user.status === "APPROVED"
  const isMaster = isLoggedIn && user?.role === "MASTER"

  if (BLOCKED.some((p) => under(path, p))) return denied(404, isApi, to("/login"))

  if (isApi && PUBLIC_API.some((p) => under(path, p))) return NextResponse.next()

  const isAuthPage = under(path, "/login") || under(path, "/signup")
  if (path === "/") return NextResponse.redirect(to(isLoggedIn ? "/dashboard" : "/login"))
  if (isAuthPage) return isLoggedIn ? NextResponse.redirect(to("/dashboard")) : NextResponse.next()

  // 환자 설문: /s/<token>, /<치과명>설문
  const segments = path.split("/").filter(Boolean)
  const isSurvey = under(path, "/s") || (segments.length === 1 && !RESERVED_ROOT.has(segments[0]))
  if (isSurvey) return NextResponse.next()

  if (!isLoggedIn) return denied(401, isApi, to("/login"))
  if (isMaster) return NextResponse.next()

  // ---------- 이하 비마스터 ----------
  const forbidden = () => denied(403, isApi, to("/dashboard"))

  // 치과 안의 운영자 전용 화면: /dashboard/<clinicId>/data-check 등
  const isOperatorPage = segments[0] === "dashboard" && ["excel-upload", "data-check", "database"].includes(segments[2] ?? "")
  if (isOperatorPage || MASTER_ONLY.some((p) => under(path, p))) return forbidden()

  // 변경 요청은 허용 목록만. PEI 보고서는 POST 로 읽기 때문에 POST 만 예외로 둔다.
  if (isApi && !isRead) {
    const allowed = VIEWER_WRITE_API.some((p) => under(path, p)) || (path === "/api/pei/reports" && method === "POST")
    if (!allowed) return forbidden()
  }

  // 다른 치과 자료 요청 차단: 주소의 clinicId
  const queryClinic = nextUrl.searchParams.get("clinicId")
  if (queryClinic && queryClinic !== user?.clinicId) return forbidden()

  // 다른 치과 자료 요청 차단: JSON 본문의 clinicId (라우트 검사와 이중 방어)
  if (isApi && !isRead && (req.headers.get("content-type") ?? "").includes("application/json")) {
    const body = await req.clone().json().catch(() => null)
    const bodyClinic = body && typeof body === "object" ? (body as { clinicId?: unknown }).clinicId : undefined
    if (typeof bodyClinic === "string" && bodyClinic !== user?.clinicId) return forbidden()
  }

  return NextResponse.next()
})

export const config = {
  // 환자 설문이 쓰는 의료진 사진·로고는 로그인 없이 보인다
  matcher: ["/((?!_next/static|_next/image|favicon.ico|pei-doctors|pei-logos).*)"],
}
