"use client"

import { useState, useEffect, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import AuthShell, { AuthLabel, authInput } from "../AuthShell"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // 회원가입 완료 메시지 처리
  useEffect(() => {
    const registered = searchParams.get('registered')
    const status = searchParams.get('status')
    const message = searchParams.get('message')

    if (registered && message) {
      setSuccessMessage(message)

      // URL에서 파라미터 제거
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await signIn("credentials", { email: email.trim(), password, redirect: false })
      setLoading(false)

      if (res?.ok) {
        // 로그인 전에 보던 주소(예: 휴대폰 재택 인증 QR)로 돌아간다. 같은 사이트 경로만 허용.
        const next = searchParams.get("next")
        router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard")
      } else if (res?.error) {
        // 계정 상태별 에러 처리
        switch (res.error) {
          case "ACCOUNT_PENDING":
            setError("계정이 승인 대기 중입니다. 관리자의 승인을 기다려주세요.")
            break
          case "ACCOUNT_REJECTED":
            setError("계정이 거부되었습니다. 관리자에게 문의하세요.")
            break
          case "ACCOUNT_NOT_APPROVED":
            setError("승인되지 않은 계정입니다. 관리자에게 문의하세요.")
            break
          default:
            setError("이메일 또는 비밀번호를 확인해주세요")
        }
      } else {
        setError("이메일 또는 비밀번호를 확인해주세요")
      }
    } catch (err) {
      setLoading(false)
      setError("로그인 중 오류가 발생했습니다")
    }
  }

  return (
    <AuthShell
      eyebrow="01 / Sign in"
      title="로그인"
      note="THINKLAB 직원과 고객 치과만 쓰는 화면입니다. 회원가입은 받지 않으며, 계정은 관리자가 만들어 드립니다."
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <AuthLabel htmlFor="login-id" en="ID / Email" ko="아이디 또는 이메일" />
          {/* 치과 계정은 이메일 대신 아이디(whitedream52 등)로도 만든다 — type="email" 이면 브라우저가 막는다 */}
          <input
            id="login-id"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="아이디 또는 name@company.com"
            required
            className={authInput}
          />
        </div>
        <div>
          <AuthLabel htmlFor="login-pw" en="Password" ko="비밀번호" />
          <input
            id="login-pw"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={authInput}
          />
        </div>

        {successMessage && <p className="text-[13px] text-[#1a7f37] bg-[#e7f6ec] px-3 py-2.5 rounded-[4px]">{successMessage}</p>}
        {error && (
          <p role="alert" className="text-[13px] text-[#d92d20] bg-[#fdebec] px-3 py-2.5 rounded-[4px]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full h-[46px] rounded-[4px] bg-[#0062ff] text-white text-[14px] font-semibold hover:bg-[#0052d6] disabled:opacity-40 transition-colors"
        >
          {loading ? "로그인 중…" : "로그인"}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-[#e0e0db] text-[13px]">
        <span className="text-[#888]">계정이 없으신가요?</span> <span className="font-semibold text-[#0a0a0a]">관리자에게 문의하세요.</span>
      </div>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <AuthShell eyebrow="01 / Sign in" title="로그인">
        <p className="text-[13px] text-[#888]">불러오는 중…</p>
      </AuthShell>
    }>
      <LoginForm />
    </Suspense>
  )
}
