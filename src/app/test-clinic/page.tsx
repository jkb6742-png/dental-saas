"use client"

import { useState } from "react"

export default function TestClinicPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("테스트치과")

  const checkSession = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/debug/session")
      const data = await res.json()
      setResult({ type: "session", data })
    } catch (error) {
      setResult({ type: "error", error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const createClinic = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      setResult({
        type: "clinic",
        data,
        success: res.ok,
        status: res.status
      })
    } catch (error) {
      setResult({ type: "error", error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">치과 생성 테스트</h1>

        <div className="space-y-4 mb-8">
          <button
            onClick={checkSession}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "확인 중..." : "세션 정보 확인"}
          </button>

          <div className="flex gap-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="치과 이름"
              className="flex-1 px-4 py-3 border rounded-lg"
            />
            <button
              onClick={createClinic}
              disabled={loading || !name.trim()}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "생성 중..." : "치과 생성"}
            </button>
          </div>
        </div>

        {result && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">
              결과: {result.type}
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