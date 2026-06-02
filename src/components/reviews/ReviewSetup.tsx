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

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h5 className="font-medium text-yellow-800 mb-2">설정 안내</h5>
        <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
          <li><strong>구글 리뷰:</strong> Google Places API 키가 필요합니다. (.env 파일에 GOOGLE_PLACES_API_KEY 설정)</li>
          <li><strong>네이버 리뷰:</strong> 현재는 수동 입력만 지원됩니다. 자동 크롤링은 추후 업데이트 예정입니다.</li>
          <li>리뷰 수집은 하루 1-2회 정도 실행하는 것을 권장합니다.</li>
          <li>리뷰 데이터는 월별로 요약되어 대시보드에 표시됩니다.</li>
        </ul>
      </div>
    </div>
  )
}