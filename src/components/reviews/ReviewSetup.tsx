"use client"

import { useState, useEffect } from "react"
import { Settings, Save, Plus, MessageCircle, Calendar, Star } from "lucide-react"

interface ReviewConfig {
  id: string
  source: "GOOGLE"
  placeName: string | null
  placeId: string | null
  isActive: boolean
  lastSyncAt: string | null
}

interface ReviewSetupProps {
  clinicId: string
  onConfigSaved?: () => void
}

export default function ReviewSetup({ clinicId, onConfigSaved }: ReviewSetupProps) {
  const [configs, setConfigs] = useState<ReviewConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // 구글 설정 상태
  const [googleConfig, setGoogleConfig] = useState({
    placeName: "",
    placeId: "",
  })

  // 네이버 수동 입력 상태
  const [naverInput, setNaverInput] = useState({
    totalReviews: "",
    monthlyReviews: "",
    averageRating: "",
    feedback: "",
  })

  const fetchConfigs = async () => {
    try {
      const response = await fetch(`/api/reviews/config?clinicId=${clinicId}`)
      if (response.ok) {
        const data = await response.json()
        setConfigs(data.filter((c: any) => c.source === "GOOGLE"))

        const google = data.find((c: any) => c.source === "GOOGLE")
        if (google) {
          setGoogleConfig({
            placeName: google.placeName || "",
            placeId: google.placeId || "",
          })
        }
      }
    } catch (error) {
      console.error("Failed to fetch configs:", error)
    } finally {
      setLoading(false)
    }
  }

  const saveGoogleConfig = async () => {
    setSaving("GOOGLE")
    try {
      if (!googleConfig.placeName.trim()) {
        alert("업체명을 입력해주세요")
        return
      }

      if (!googleConfig.placeId.trim()) {
        alert("Google Place ID를 입력해주세요")
        return
      }

      const requestData = {
        clinicId,
        source: "GOOGLE",
        placeName: googleConfig.placeName.trim(),
        placeId: googleConfig.placeId.trim(),
      }

      const response = await fetch("/api/reviews/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message || "구글 리뷰 설정이 저장되었습니다.")
        await fetchConfigs()
        onConfigSaved?.()
      } else {
        const error = await response.json()
        alert(`설정 저장 실패: ${error.error}`)
      }
    } catch (error) {
      alert("설정 저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(null)
    }
  }

  const saveNaverInput = async () => {
    setSaving("NAVER")
    try {
      if (!naverInput.totalReviews) {
        alert("총 리뷰 수를 입력해주세요")
        return
      }

      const requestData = {
        clinicId,
        source: "NAVER",
        totalReviews: parseInt(naverInput.totalReviews) || 0,
        monthlyReviews: parseInt(naverInput.monthlyReviews) || 0,
        averageRating: parseFloat(naverInput.averageRating) || null,
        feedbackComments: naverInput.feedback ? [naverInput.feedback] : [],
      }

      const response = await fetch("/api/reviews/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message || "네이버 리뷰 현황이 저장되었습니다.")
        setNaverInput({ totalReviews: "", monthlyReviews: "", averageRating: "", feedback: "" })
        onConfigSaved?.()
      } else {
        const error = await response.json()
        alert(`저장 실패: ${error.error}`)
      }
    } catch (error) {
      alert("저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(null)
    }
  }

  useEffect(() => {
    fetchConfigs()
  }, [clinicId])

  if (loading) {
    return <div className="text-center py-8">설정을 불러오는 중...</div>
  }

  const googleLastSync = configs.find(c => c.source === "GOOGLE")?.lastSyncAt

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Settings className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold">리뷰 관리</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 네이버 - 수동 입력 */}
        <div className="bg-green-50 rounded-xl border border-green-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              N
            </div>
            <div>
              <h4 className="text-lg font-semibold text-green-800">네이버 리뷰</h4>
              <p className="text-sm text-green-600">수동 입력 방식</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center text-sm font-medium text-green-700 mb-2">
                  <MessageCircle className="w-4 h-4 mr-1" />
                  총 리뷰 수
                </label>
                <input
                  type="number"
                  value={naverInput.totalReviews}
                  onChange={(e) => setNaverInput(prev => ({ ...prev, totalReviews: e.target.value }))}
                  placeholder="전체"
                  className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-green-700 mb-2">
                  <Calendar className="w-4 h-4 mr-1" />
                  이번달 신규
                </label>
                <input
                  type="number"
                  value={naverInput.monthlyReviews}
                  onChange={(e) => setNaverInput(prev => ({ ...prev, monthlyReviews: e.target.value }))}
                  placeholder="신규"
                  className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-green-700 mb-2">
                <Star className="w-4 h-4 mr-1" />
                평균 평점
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={naverInput.averageRating}
                onChange={(e) => setNaverInput(prev => ({ ...prev, averageRating: e.target.value }))}
                placeholder="4.5"
                className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-green-700 mb-2">
                💬 주요 피드백 (선택사항)
              </label>
              <textarea
                value={naverInput.feedback}
                onChange={(e) => setNaverInput(prev => ({ ...prev, feedback: e.target.value }))}
                placeholder="개선이 필요한 부분이나 중요한 피드백..."
                rows={3}
                className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            <button
              onClick={saveNaverInput}
              disabled={saving === "NAVER" || !naverInput.totalReviews}
              className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>{saving === "NAVER" ? "저장 중..." : "현황 저장"}</span>
            </button>
          </div>

          <div className="mt-4 p-3 bg-green-100 rounded-lg">
            <h5 className="text-sm font-medium text-green-800 mb-1">📋 입력 방법</h5>
            <ul className="text-xs text-green-700 space-y-1">
              <li>• 네이버 지도에서 치과 검색</li>
              <li>• 리뷰 탭에서 총 개수 확인</li>
              <li>• 월 1회 업데이트 권장</li>
            </ul>
          </div>
        </div>

        {/* 구글 - 자동 수집 */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              G
            </div>
            <div>
              <h4 className="text-lg font-semibold text-blue-800">구글 리뷰</h4>
              <p className="text-sm text-blue-600">자동 수집 방식</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-2">
                업체명
              </label>
              <input
                type="text"
                value={googleConfig.placeName}
                onChange={(e) => setGoogleConfig(prev => ({ ...prev, placeName: e.target.value }))}
                placeholder="구글 비즈니스에 등록된 치과 이름"
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-700 mb-2">
                Google Place ID
              </label>
              <input
                type="text"
                value={googleConfig.placeId}
                onChange={(e) => setGoogleConfig(prev => ({ ...prev, placeId: e.target.value }))}
                placeholder="ChIJ..."
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-blue-600 mt-1">
                <a
                  href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Place ID 찾는 방법 →
                </a>
              </p>
            </div>

            <button
              onClick={saveGoogleConfig}
              disabled={saving === "GOOGLE" || !googleConfig.placeName || !googleConfig.placeId}
              className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving === "GOOGLE" ? "저장 중..." : "설정 저장"}</span>
            </button>

            {googleLastSync && (
              <p className="text-xs text-blue-600">
                마지막 동기화: {new Date(googleLastSync).toLocaleString()}
              </p>
            )}
          </div>

          <div className="mt-4 p-3 bg-blue-100 rounded-lg">
            <h5 className="text-sm font-medium text-blue-800 mb-1">🔧 설정 필요</h5>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• .env 파일에 GOOGLE_PLACES_API_KEY 추가</li>
              <li>• 한 번 설정하면 자동 수집 가능</li>
              <li>• API 할당량 주의</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}