"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import Link from "next/link"

type Account = {
  id: string
  name: string
  email: string
  role: string
  status: string
  lastLoginAt: Date | string | null
}

type LoginRow = {
  userName: string
  email: string
  at: Date | string
  ip: string | null
}

type ClinicData = {
  id: string
  name: string
  code: string
  agencyName: string
  createdAt: Date | string
  accounts: Account[]
  freshness: {
    lastUpload: Date | string | null
    lastReception: Date | string | null
    receptionCount: number
    lastMonthly: Date | string | null
  }
  recentLogins: LoginRow[]
}

function relTime(v: Date | string | null): string {
  if (!v) return "기록 없음"
  const d = new Date(v)
  const diff = Date.now() - d.getTime()
  if (Number.isNaN(diff)) return "기록 없음"
  const min = Math.floor(diff / 60000)
  if (min < 1) return "방금 전"
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}일 전`
  const mon = Math.floor(day / 30)
  if (mon < 12) return `${mon}개월 전`
  return `${Math.floor(mon / 12)}년 전`
}

function fullDate(v: Date | string | null): string {
  if (!v) return "-"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return "-"
  // 서버와 브라우저의 표기(PM/오후)가 달라지지 않도록 한국 시각으로 직접 조립한다
  const k = new Date(d.getTime() + 9 * 3600 * 1000)
  const p2 = (n: number) => String(n).padStart(2, "0")
  const h = k.getUTCHours()
  return `${k.getUTCFullYear()}. ${p2(k.getUTCMonth() + 1)}. ${p2(k.getUTCDate())}. ${h < 12 ? "오전" : "오후"} ${p2(h % 12 === 0 ? 12 : h % 12)}:${p2(k.getUTCMinutes())}`
}

function roleBadge(role: string) {
  const map: Record<string, { label: string; cls: string }> = {
    MASTER: { label: "마스터", cls: "bg-[#fff4e5] text-[#b25e00]" },
    ADMIN: { label: "관리자", cls: "bg-[#e8f0ff] text-[#0052d6]" },
    ANALYST: { label: "분석가", cls: "bg-[#eef7f0] text-[#0f7b3f]" },
    VIEWER: { label: "뷰어", cls: "bg-[#f2f4f6] text-[#4e5968]" },
  }
  const r = map[role] ?? { label: role, cls: "bg-[#f2f4f6] text-[#4e5968]" }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${r.cls}`}>
      {r.label}
    </span>
  )
}

function statusDot(status: string) {
  const ok = status === "APPROVED"
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[#8b95a1]">
      <span
        className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-[#22c55e]" : "bg-[#f59e0b]"}`}
      />
      {ok ? "승인됨" : status === "PENDING" ? "대기중" : "거부됨"}
    </span>
  )
}

export default function MasterWorkspace({
  clinics,
  masterName,
}: {
  clinics: ClinicData[]
  masterName: string
}) {
  const [selectedId, setSelectedId] = useState(clinics[0]?.id ?? "")
  const [query, setQuery] = useState("")

  const filtered = useMemo(
    () =>
      clinics.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [clinics, query]
  )

  const selected = clinics.find((c) => c.id === selectedId) ?? clinics[0]

  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function createAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: selected.id, ...form }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error ?? "생성 실패")
        return
      }
      setForm({ name: "", email: "", password: "" })
      setShowAdd(false)
      router.refresh()
    } catch {
      setMsg("네트워크 오류")
    } finally {
      setBusy(false)
    }
  }

  async function deleteAccount(id: string, email: string) {
    if (
      !confirm(
        `'${email}' 계정을 삭제할까요?\n삭제하면 이 계정으로 더 이상 로그인할 수 없습니다.`
      )
    )
      return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error ?? "삭제 실패")
        return
      }
      router.refresh()
    } catch {
      setMsg("네트워크 오류")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* ── 좌측 사이드바 (클로드/GPT 스타일) ── */}
      <aside className="w-[288px] shrink-0 flex flex-col bg-[#f7f7f8] border-r border-[#d1d1cc]">
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[20px]">🦷</span>
            <div>
              <div className="text-[15px] font-bold text-[#191f28] leading-tight">
                치과 워크스페이스
              </div>
              <div className="text-[11px] text-[#8b95a1]">마스터 관리</div>
            </div>
          </div>

          <Link
            href="/admin/clinics"
            className="flex items-center justify-center gap-1.5 w-full py-2.5 mb-3 bg-[#0062ff] hover:bg-[#0052d6] text-white text-[13px] font-semibold rounded-[10px] transition-colors"
          >
            <span className="text-[15px] leading-none">＋</span> 새 치과 추가
          </Link>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="치과 검색"
            className="w-full px-3 py-2 text-[13px] bg-white border border-[#d1d1cc] rounded-[10px] outline-none focus:border-[#0062ff] transition-colors"
          />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {filtered.map((c) => {
            const active = c.id === selected?.id
            const lastActivity =
              c.recentLogins[0]?.at ?? c.freshness.lastUpload ?? null
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-3 py-2.5 mb-1 rounded-[10px] transition-colors ${
                  active
                    ? "bg-white border border-[#d1d1cc]"
                    : "hover:bg-[#ececee] border border-transparent"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-[#191f28] truncate">
                    {c.name}
                  </span>
                  <span className="text-[11px] text-[#adb5bd] shrink-0">
                    {c.accounts.length}계정
                  </span>
                </div>
                <div
                  className="text-[11px] text-[#8b95a1] mt-0.5"
                  suppressHydrationWarning
                >
                  최근 활동 {relTime(lastActivity)}
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className="px-3 py-3 text-center text-[12px] text-[#adb5bd]">
              검색 결과 없음
            </div>
          )}
        </nav>

        <div className="px-4 py-3 border-t border-[#d1d1cc] flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#191f28] text-white flex items-center justify-center text-[12px] shrink-0">
            👑
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-[#191f28] truncate">
              {masterName}
            </div>
            <div className="text-[11px] text-[#8b95a1]">마스터 관리자</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="로그아웃"
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium text-[#8b95a1] hover:text-[#f04452] hover:bg-[#fff0f1] rounded-[8px] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* ── 우측 본문 ── */}
      <main className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="max-w-[900px] mx-auto px-4 py-4">
            {/* 헤더 */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-[18px] font-bold text-[#191f28]">
                  {selected.name}
                </h1>
                <p className="text-[13px] text-[#8b95a1] mt-1">
                  {selected.agencyName} · 코드 {selected.code} · 등록{" "}
                  {fullDate(selected.createdAt)}
                </p>
              </div>
              <Link
                href={`/dashboard/${selected.id}`}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#191f28] hover:bg-black text-white text-[13px] font-semibold rounded-[10px] transition-colors"
              >
                대시보드 열기 →
              </Link>
            </div>

            {/* 자료 업데이트 현황 */}
            <section className="mb-3">
              <h2 className="text-[13px] font-bold text-[#4e5968] mb-3">
                자료 업데이트 현황
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FreshTile
                  label="마지막 업로드"
                  rel={relTime(selected.freshness.lastUpload)}
                  full={fullDate(selected.freshness.lastUpload)}
                />
                <FreshTile
                  label="접수수납 최신"
                  rel={relTime(selected.freshness.lastReception)}
                  full={fullDate(selected.freshness.lastReception)}
                />
                <FreshTile
                  label="접수수납 건수"
                  rel={`${selected.freshness.receptionCount.toLocaleString()}건`}
                  full=""
                />
                <FreshTile
                  label="월간요약 갱신"
                  rel={relTime(selected.freshness.lastMonthly)}
                  full={fullDate(selected.freshness.lastMonthly)}
                />
              </div>
            </section>

            {/* 전용 계정 */}
            <section className="mb-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[13px] font-bold text-[#4e5968]">
                  이 치과 전용 로그인 계정{" "}
                  <span className="text-[#adb5bd]">
                    ({selected.accounts.length})
                  </span>
                </h2>
                <button
                  onClick={() => {
                    setShowAdd((v) => !v)
                    setMsg(null)
                  }}
                  className="text-[12px] font-semibold text-[#0062ff] hover:underline"
                >
                  {showAdd ? "닫기" : "＋ 계정 생성"}
                </button>
              </div>

              <p className="text-[11px] text-[#adb5bd] mb-2">
                여기서 만든 계정은 <b className="text-[#8b95a1]">{selected.name}</b>{" "}
                데이터에만 접근할 수 있고, 다른 치과에는 절대 접근할 수 없습니다.
              </p>

              {showAdd && (
                <form
                  onSubmit={createAccount}
                  className="mb-3 p-4 bg-[#f2f2ef] border border-[#d1d1cc] rounded-[12px]"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="이름"
                      className="px-3 py-2 text-[13px] bg-white border border-[#d1d1cc] rounded-[8px] outline-none focus:border-[#0062ff]"
                    />
                    <input
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="이메일 (로그인 ID)"
                      className="px-3 py-2 text-[13px] bg-white border border-[#d1d1cc] rounded-[8px] outline-none focus:border-[#0062ff]"
                    />
                    <input
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                      placeholder="비밀번호 (6자 이상)"
                      className="px-3 py-2 text-[13px] bg-white border border-[#d1d1cc] rounded-[8px] outline-none focus:border-[#0062ff]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-4 py-2 bg-[#0062ff] hover:bg-[#0052d6] disabled:opacity-50 text-white text-[13px] font-semibold rounded-[8px]"
                    >
                      {busy ? "생성 중..." : "계정 생성"}
                    </button>
                    {msg && (
                      <span className="text-[12px] text-[#e03131]">{msg}</span>
                    )}
                  </div>
                </form>
              )}

              {!showAdd && msg && (
                <div className="mb-2 text-[12px] text-[#e03131]">{msg}</div>
              )}

              <div className="border border-[#d1d1cc] rounded-[12px] overflow-hidden">
                {selected.accounts.length === 0 && (
                  <div className="px-4 py-4 text-center text-[13px] text-[#adb5bd]">
                    아직 이 치과에 연결된 계정이 없습니다. 위 “＋ 계정 생성”으로
                    추가하세요.
                  </div>
                )}
                {selected.accounts.map((a, i) => (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 px-4 py-3 group ${
                      i > 0 ? "border-t border-[#e0e0db]" : ""
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#e8f0ff] text-[#0052d6] flex items-center justify-center text-[13px] font-bold shrink-0">
                      {a.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-[#191f28] truncate">
                          {a.name}
                        </span>
                        {roleBadge(a.role)}
                      </div>
                      <div className="text-[12px] text-[#8b95a1] truncate">
                        {a.email}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className="text-[12px] text-[#4e5968]"
                        suppressHydrationWarning
                      >
                        마지막 로그인 {relTime(a.lastLoginAt)}
                      </div>
                      <div className="mt-0.5">{statusDot(a.status)}</div>
                    </div>
                    <button
                      onClick={() => deleteAccount(a.id, a.email)}
                      disabled={busy}
                      title="계정 삭제"
                      className="shrink-0 ml-1 px-2 py-1 text-[12px] text-[#8b95a1] hover:text-[#e03131] hover:bg-[#fff0f0] rounded-[6px] transition-colors disabled:opacity-40"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* 로그인 이력 */}
            <section>
              <h2 className="text-[13px] font-bold text-[#4e5968] mb-3">
                최근 로그인 이력
              </h2>
              <div className="border border-[#d1d1cc] rounded-[12px] overflow-hidden">
                {selected.recentLogins.length === 0 && (
                  <div className="px-4 py-4 text-center text-[13px] text-[#adb5bd]">
                    아직 로그인 기록이 없습니다. (이번 업데이트 이후부터 자동
                    수집됩니다)
                  </div>
                )}
                {selected.recentLogins.map((l, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-2.5 ${
                      i > 0 ? "border-t border-[#e0e0db]" : ""
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
                    <span className="text-[13px] font-medium text-[#191f28]">
                      {l.userName}
                    </span>
                    <span className="text-[12px] text-[#adb5bd] truncate flex-1">
                      {l.email}
                    </span>
                    <span className="text-[12px] text-[#8b95a1] shrink-0">
                      {fullDate(l.at)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-[40px] mb-3">🦷</div>
              <p className="text-[14px] text-[#8b95a1] mb-2.5">
                등록된 치과가 없습니다.
              </p>
              <Link
                href="/admin/clinics"
                className="inline-flex px-5 py-3 bg-[#0062ff] hover:bg-[#0052d6] text-white text-[14px] font-semibold rounded-[10px]"
              >
                치과 등록하기
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function FreshTile({
  label,
  rel,
  full,
}: {
  label: string
  rel: string
  full: string
}) {
  return (
    <div className="bg-[#f2f2ef] border border-[#e0e0db] rounded-[12px] px-4 py-3">
      <div className="text-[11px] text-[#8b95a1] mb-1">{label}</div>
      <div
        className="text-[15px] font-bold text-[#191f28]"
        suppressHydrationWarning
      >
        {rel}
      </div>
      {full && (
        <div
          className="text-[11px] text-[#adb5bd] mt-0.5"
          suppressHydrationWarning
        >
          {full}
        </div>
      )}
    </div>
  )
}
