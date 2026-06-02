"use client"

import { useState, useEffect } from "react"

// 🚨 JavaScript 실행 테스트
console.log("🟢 JavaScript가 실행되고 있습니다!")
if (typeof window !== "undefined") {
  console.log("🟢 브라우저 환경입니다!")
}
import { useRouter } from "next/navigation"
import Link from "next/link"
import Button from "@/components/ui/Button"
import { Building2 } from "lucide-react"

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    agencyName: "",
    name: "",
    email: "",
    password: "",
    inviteCode: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    console.log("🎯 SignupPage 컴포넌트가 마운트되었습니다!")
    console.log("🎯 초기 form 상태:", form)
  }, [])

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    console.log("🚀 회원가입 시작:", form)
    setLoading(true)
    setError("")

    try {
      console.log("📡 API 호출 중...")
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      console.log("📥 API 응답:", res.status, data)
      setLoading(false)

      if (res.ok && data.success) {
        console.log("✅ 회원가입 성공, 로그인 페이지로 이동")
        // 성공 시 상태에 따라 다른 메시지와 함께 리다이렉트
        const params = new URLSearchParams()
        params.set('registered', '1')
        params.set('status', data.status)
        params.set('message', data.message)

        router.push(`/login?${params.toString()}`)
      } else {
        console.log("❌ 회원가입 실패:", data.error)
        setError(data.error ?? "회원가입에 실패했습니다")
      }
    } catch (err) {
      console.log("💥 오류 발생:", err)
      setLoading(false)
      setError("네트워크 오류가 발생했습니다")
    }
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-2xl mb-4">
            <span className="text-[24px] font-bold text-white">T</span>
          </div>
          <h1 className="text-[20px] font-bold text-[#191f28] mb-1">THINKLAB dental insight</h1>
          <h2 className="text-[18px] font-medium text-[#4e5968] mb-2">회원가입</h2>
          <p className="text-[14px] text-[#8b95a1]">새 치과 계정을 만들어보세요</p>
        </div>

        <div className="bg-white rounded-2xl p-7 shadow-[0_1px_3px_0_rgb(0_0_0/0.06)]">
          <form
            onSubmit={(e) => {
              console.log("📝 Form submit 이벤트 발생!", e)
              handleSubmit(e)
            }}
            className="space-y-4"
          >
            {[
              { label: "치과명", key: "agencyName", placeholder: "00치과", type: "text", required: true },
              { label: "담당자 이름", key: "name", placeholder: "박덴트", type: "text", required: true },
              { label: "이메일", key: "email", placeholder: "name@company.com", type: "email", required: true },
              { label: "비밀번호", key: "password", placeholder: "8자 이상", type: "password", required: true },
            ].map(({ label, key, placeholder, type, required }) => (
              <div key={key}>
                <label className="block text-[13px] font-medium text-[#4e5968] mb-1.5">
                  {label}
                  {required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder={placeholder}
                  required={required}
                  className="w-full px-4 py-3 rounded-xl border border-[#e5e8eb] text-[14px] text-[#191f28] placeholder:text-[#b0b8c1] focus:outline-none focus:border-[#3182f6] focus:ring-2 focus:ring-[#ebf3fe] transition-all"
                />
              </div>
            ))}

            {/* 초대 코드 필드 */}
            <div>
              <label className="block text-[13px] font-medium text-[#4e5968] mb-1.5">
                초대 코드 <span className="text-[#8b95a1]">(선택사항)</span>
              </label>
              <input
                type="text"
                value={form.inviteCode}
                onChange={(e) => set("inviteCode", e.target.value.toUpperCase())}
                placeholder="8자리 초대 코드"
                maxLength={8}
                className="w-full px-4 py-3 rounded-xl border border-[#e5e8eb] text-[14px] text-[#191f28] placeholder:text-[#b0b8c1] focus:outline-none focus:border-[#3182f6] focus:ring-2 focus:ring-[#ebf3fe] transition-all uppercase tracking-wider"
              />
              <p className="text-[12px] text-[#8b95a1] mt-1">
                초대 코드가 있으면 즉시 승인됩니다. 없으면 관리자 승인이 필요합니다.
              </p>
            </div>

            {error && (
              <p className="text-[13px] text-[#f04452] bg-[#fff0f1] px-3 py-2.5 rounded-xl">{error}</p>
            )}

            <Button
              type="submit"
              size="lg"
              loading={loading}
              className="w-full mt-2"
              onClick={(e) => {
                console.log("🔥 버튼 클릭됨!", e)
                console.log("🔥 Form data:", form)
                // submit 이벤트가 제대로 발생하는지 확인
              }}
            >
              시작하기
            </Button>
          </form>

          <p className="text-center text-[13px] text-[#8b95a1] mt-5">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-[#3182f6] font-semibold hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
