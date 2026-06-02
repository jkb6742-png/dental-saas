"use client"

import { useState } from "react"

export default function TestAccountPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const createTestAccount = async () => {
    setLoading(true)
    try {
      const testData = {
        agencyName: "테스트 대행사",
        name: "테스트 관리자",
        email: "test@test.com",
        password: "test123",
        inviteCode: ""
      }

      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testData),
      })
      const data = await res.json()

      setResult({
        success: res.ok,
        status: res.status,
        data,
        testCredentials: {
          email: "test@test.com",
          password: "test123"
        }
      })
    } catch (error) {
      setResult({
        success: false,
        error: error.message,
        testCredentials: {
          email: "test@test.com",
          password: "test123"
        }
      })
    } finally {
      setLoading(false)
    }
  }

  const checkExistingUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/debug/users")
      const data = await res.json()
      setResult({ type: "users", data })
    } catch (error) {
      setResult({ type: "error", error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">테스트 계정 관리</h1>

        <div className="space-y-4 mb-8">
          <button
            onClick={createTestAccount}
            disabled={loading}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "생성 중..." : "테스트 계정 생성"}
          </button>

          <button
            onClick={checkExistingUsers}
            disabled={loading}
            className="ml-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "확인 중..." : "기존 사용자 확인"}
          </button>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
            <h3 className="font-semibold text-yellow-800 mb-2">테스트 계정 정보</h3>
            <div className="text-sm text-yellow-700">
              <p><strong>이메일:</strong> test@test.com</p>
              <p><strong>비밀번호:</strong> test123</p>
              <p><strong>대행사:</strong> 테스트 대행사</p>
            </div>
          </div>
        </div>

        {result && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">
              결과
              {result.success !== undefined && (
                <span className={`ml-2 px-2 py-1 text-sm rounded ${
                  result.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}>
                  {result.success ? "성공" : "실패"} ({result.status})
                </span>
              )}
            </h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>

            {result.testCredentials && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-800 font-semibold">
                  이제 <a href="/login" className="underline">로그인 페이지</a>에서 위 계정으로 로그인해보세요!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}