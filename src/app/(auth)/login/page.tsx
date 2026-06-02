"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Button from "@/components/ui/Button"
import { Building2 } from "lucide-react"

export default function LoginPage() {
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
      const res = await signIn("credentials", { email, password, redirect: false })
      setLoading(false)

      if (res?.ok) {
        router.push("/dashboard")
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
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-2xl mb-4">
            <span className="text-[24px] font-bold text-white">T</span>
          </div>
          <h1 className="text-[28px] font-bold text-[#191f28] mb-1">THINKLAB</h1>
          <h2 className="text-[20px] font-medium text-[#4e5968] mb-2">dental insight</h2>
          <p className="text-[14px] text-[#8b95a1]">치과 경영지표 분석 플랫폼</p>
        </div>

        <div className="bg-white rounded-2xl p-7 shadow-[0_1px_3px_0_rgb(0_0_0/0.06)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[#4e5968] mb-1.5">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#e5e8eb] text-[14px] text-[#191f28] placeholder:text-[#b0b8c1] focus:outline-none focus:border-[#3182f6] focus:ring-2 focus:ring-[#ebf3fe] transition-all"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#4e5968] mb-1.5">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#e5e8eb] text-[14px] text-[#191f28] placeholder:text-[#b0b8c1] focus:outline-none focus:border-[#3182f6] focus:ring-2 focus:ring-[#ebf3fe] transition-all"
              />
            </div>

            {successMessage && (
              <p className="text-[13px] text-[#059669] bg-[#f0fdf4] px-3 py-2.5 rounded-xl border border-[#bbf7d0]">
                {successMessage}
              </p>
            )}

            {error && (
              <p className="text-[13px] text-[#f04452] bg-[#fff0f1] px-3 py-2.5 rounded-xl">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full mt-2">
              로그인
            </Button>
          </form>

          <p className="text-center text-[13px] text-[#8b95a1] mt-5">
            계정이 없으신가요?{" "}
            <Link href="/signup" className="text-[#3182f6] font-semibold hover:underline">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
