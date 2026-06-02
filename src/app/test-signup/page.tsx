"use client"

import { useState } from "react"

export default function TestSignupPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    agencyName: "테스트치과",
    name: "박덴트",
    email: "test-user@test.com",
    password: "test123",
    inviteCode: ""
  })

  const testSignup = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      const data = await res.json()

      setResult({
        success: res.ok,
        status: res.status,
        data,
        formData
      })
    } catch (error) {
      setResult({
        success: false,
        error: error.message,
        formData
      })
    } finally {
      setLoading(false)
    }
  }

  const testSignupWithInviteCode = async (inviteCode: string) => {
    setLoading(true)
    try {
      const testData = {
        ...formData,
        email: `invited-${Date.now()}@test.com`,
        inviteCode: inviteCode
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
        formData: testData
      })
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">회원가입 테스트</h1>

        <div className="space-y-4 mb-8">
          {/* 폼 데이터 수정 */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-4">테스트 데이터</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                placeholder="치과명"
                value={formData.agencyName}
                onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
                className="px-3 py-2 border rounded"
              />
              <input
                placeholder="이름"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="px-3 py-2 border rounded"
              />
              <input
                placeholder="이메일"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="px-3 py-2 border rounded"
              />
              <input
                placeholder="비밀번호"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="px-3 py-2 border rounded"
              />
            </div>
          </div>

          <button
            onClick={testSignup}
            disabled={loading}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "테스트 중..." : "일반 회원가입 테스트"}
          </button>

          <button
            onClick={() => testSignupWithInviteCode("TESTCODE")}
            disabled={loading}
            className="ml-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "테스트 중..." : "초대 코드로 회원가입 테스트"}
          </button>
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
          </div>
        )}
      </div>
    </div>
  )
}