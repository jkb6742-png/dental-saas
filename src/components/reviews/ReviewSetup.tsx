"use client"

import { useState, useEffect } from "react"
import { Settings, Save, Search } from "lucide-react"

interface ReviewConfig {
  id: string
  source: "NAVER" | "GOOGLE"
  placeName: string | null
  placeId: string | null
  placeUrl: string | null
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

  // 폼 상태
  const [naverConfig, setNaverConfig] = useState({
    placeName: "",
    placeUrl: "",
  })

  const [googleConfig, setGoogleConfig] = useState({
    placeName: "",
    placeId: "",
  })

  const fetchConfigs = async () => {
    try {
      const response = await fetch(`/api/reviews/config?clinicId=${clinicId}`)
      if (response.ok) {
        const data = await response.json()
        setConfigs(data)

        // 기존 설정이 있으면 폼에 설정
        const naver = data.find((c: ReviewConfig) => c.source === "NAVER")
        if (naver) {
          setNaverConfig({
            placeName: naver.placeName || "",
            placeUrl: naver.placeUrl || "",
          })
        }

        const google = data.find((c: ReviewConfig) => c.source === "GOOGLE")
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

  const saveConfig = async (source: "NAVER" | "GOOGLE") => {
    setSaving(source)
    try {
      const config = source === "NAVER" ? naverConfig : googleConfig

      // 프론트엔드에서 먼저 검증
      if (!config.placeName.trim()) {
        alert("업체명을 입력해주세요")
        return
      }

      if (source === "NAVER") {
        if (!config.placeUrl.trim()) {
          alert("네이버 플레이스 URL을 입력해주세요")
          return
        }
        if (!config.placeUrl.includes('map.naver.com')) {
          alert("올바른 네이버 지도 URL 형식이 아닙니다\n예: https://map.naver.com/p/...")
          return
        }
      }

      if (source === "GOOGLE") {
        if (!(config as any).placeId?.trim()) {
          alert("Google Place ID를 입력해주세요")
          return
        }
      }

      const requestData = {
        clinicId,
        source,
        placeName: config.placeName.trim(),
        ...(source === "NAVER" ? { placeUrl: config.placeUrl.trim() } : { placeId: (config as any).placeId.trim() }),
      }

      console.log(`📤 ${source} 설정 저장 요청:`, requestData)

      const response = await fetch("/api/reviews/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message || `${source} 리뷰 설정이 저장되었습니다.`)
        await fetchConfigs()
        onConfigSaved?.()
      } else {
        const error = await response.json()
        console.error(`${source} 설정 저장 에러:`, error)
        alert(`설정 저장 실패: ${error.error}`)
      }
    } catch (error) {
      console.error(`❌ ${source} 설정 저장 에러:`, error)
      alert(`설정 저장 중 오류가 발생했습니다.\n네트워크 연결과 로그인 상태를 확인해주세요.`)
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

  const naverLastSync = configs.find(c => c.source === "NAVER")?.lastSyncAt
  const googleLastSync = configs.find(c => c.source === "GOOGLE")?.lastSyncAt

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Settings className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold">리뷰 수집 설정</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 네이버 리뷰 설정 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              N
            </div>
            <h4 className="text-lg font-semibold">네이버 리뷰 설정</h4>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                업체명
              </label>
              <input
                type="text"
                value={naverConfig.placeName}
                onChange={(e) => setNaverConfig(prev => ({ ...prev, placeName: e.target.value }))}
                placeholder="네이버에 등록된 치과 이름"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                네이버 플레이스 URL
              </label>
              <input
                type="url"
                value={naverConfig.placeUrl}
                onChange={(e) => setNaverConfig(prev => ({ ...prev, placeUrl: e.target.value }))}
                placeholder="https://map.naver.com/p/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                네이버 지도에서 치과 검색 후 URL을 복사해주세요
              </p>
            </div>

            <button
              onClick={() => saveConfig("NAVER")}
              disabled={saving === "NAVER" || !naverConfig.placeName || !naverConfig.placeUrl}
              className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving === "NAVER" ? "저장 중..." : "설정 저장"}</span>
            </button>

            {naverLastSync && (
              <p className="text-sm text-gray-500">
                마지막 동기화: {new Date(naverLastSync).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* 구글 리뷰 설정 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              G
            </div>
            <h4 className="text-lg font-semibold">구글 리뷰 설정</h4>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                업체명
              </label>
              <input
                type="text"
                value={googleConfig.placeName}
                onChange={(e) => setGoogleConfig(prev => ({ ...prev, placeName: e.target.value }))}
                placeholder="구글 비즈니스에 등록된 치과 이름"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Place ID
              </label>
              <input
                type="text"
                value={googleConfig.placeId}
                onChange={(e) => setGoogleConfig(prev => ({ ...prev, placeId: e.target.value }))}
                placeholder="ChIJ..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                <a
                  href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  Place ID 찾는 방법
                </a>을 참고하세요
              </p>
            </div>

            <button
              onClick={() => saveConfig("GOOGLE")}
              disabled={saving === "GOOGLE" || !googleConfig.placeName || !googleConfig.placeId}
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving === "GOOGLE" ? "저장 중..." : "설정 저장"}</span>
            </button>

            {googleLastSync && (
              <p className="text-sm text-gray-500">
                마지막 동기화: {new Date(googleLastSync).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 간편 수동 입력 섹션 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-4">💡 간편 리뷰 현황 입력</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 네이버 간편 입력 */}
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-6 h-6 bg-green-500 rounded text-white text-xs flex items-center justify-center font-bold">N</div>
              <span className="font-medium">네이버 플레이스</span>
            </div>

            <div className="space-y-3">
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="총 리뷰 수"
                  className="flex-1 px-2 py-1 text-sm border rounded"
                />
                <input
                  type="number"
                  placeholder="이번달"
                  className="w-20 px-2 py-1 text-sm border rounded"
                />
              </div>
              <input
                type="text"
                placeholder="주요 피드백 (선택사항)"
                className="w-full px-2 py-1 text-sm border rounded"
              />
              <button className="w-full py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600">
                저장
              </button>
            </div>
          </div>

          {/* 구글 간편 입력 */}
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-6 h-6 bg-blue-500 rounded text-white text-xs flex items-center justify-center font-bold">G</div>
              <span className="font-medium">구글 리뷰</span>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Place ID (자동 수집용)"
                className="w-full px-2 py-1 text-sm border rounded"
              />
              <button className="w-full py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                자동 수집
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-blue-700">
          <p><strong>📋 사용법:</strong></p>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li><strong>네이버:</strong> 직접 네이버 지도에서 확인 후 수동 입력 (월 1회)</li>
            <li><strong>구글:</strong> Place ID 입력 후 자동 수집 가능</li>
            <li>주요 피드백: 개선이 필요한 부분만 간단히 메모</li>
          </ul>
        </div>
      </div>
    </div>
  )
}