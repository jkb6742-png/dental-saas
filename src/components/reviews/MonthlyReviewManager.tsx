"use client"

import { useState, useEffect } from "react"
import { Calendar, Target, TrendingUp, Edit2, Save, X, Settings, RefreshCw } from "lucide-react"

interface MonthlyReview {
  id: string
  source: "NAVER" | "GOOGLE"
  year: number
  month: number
  totalReviews: number
  newReviews: number
  targetReviews: number | null
  achievementRate: number | null
}

interface GoogleConfig {
  id: string | null
  placeName: string
  placeId: string
  isActive: boolean
  lastSyncAt: string | null
}

interface MonthlyReviewManagerProps {
  clinicId: string
  userRole: string
}

export default function MonthlyReviewManager({ clinicId, userRole }: MonthlyReviewManagerProps) {
  const [naverReviews, setNaverReviews] = useState<MonthlyReview[]>([])
  const [googleReviews, setGoogleReviews] = useState<MonthlyReview[]>([])
  const [googleConfig, setGoogleConfig] = useState<GoogleConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"NAVER" | "GOOGLE">("NAVER")
  const [editingMonth, setEditingMonth] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    totalReviews: "",
    newReviews: "",
    targetReviews: "",
  })
  const [configForm, setConfigForm] = useState({
    placeName: "",
    placeId: "",
  })
  const [saving, setSaving] = useState<string | null>(null)

  const isMaster = userRole === 'MASTER'
  const currentDate = new Date()
  const currentReviews = activeTab === "NAVER" ? naverReviews : googleReviews

  // 최근 12개월 데이터 생성
  const generateMonths = () => {
    const months = []
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      months.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        key: `${date.getFullYear()}-${date.getMonth() + 1}`
      })
    }
    return months
  }

  const months = generateMonths()

  const fetchAllData = async () => {
    try {
      // 네이버 리뷰 데이터
      const naverResponse = await fetch(`/api/reviews/monthly?clinicId=${clinicId}&source=NAVER`)
      if (naverResponse.ok) {
        const naverData = await naverResponse.json()
        setNaverReviews(naverData)
      }

      // 구글 리뷰 데이터
      const googleResponse = await fetch(`/api/reviews/monthly?clinicId=${clinicId}&source=GOOGLE`)
      if (googleResponse.ok) {
        const googleData = await googleResponse.json()
        setGoogleReviews(googleData)
      }

      // 구글 설정
      const configResponse = await fetch(`/api/reviews/config?clinicId=${clinicId}`)
      if (configResponse.ok) {
        const configData = await configResponse.json()
        const googleCfg = configData.find((c: any) => c.source === "GOOGLE")
        setGoogleConfig(googleCfg || null)
        if (googleCfg) {
          setConfigForm({
            placeName: googleCfg.placeName || "",
            placeId: googleCfg.placeId || "",
          })
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const getReviewData = (year: number, month: number) => {
    return currentReviews.find(r => r.year === year && r.month === month)
  }

  const calculateTotalReviews = (year: number, month: number) => {
    // 2025년 기준으로 0개에서 시작
    // 2026년 1월부터 신규 리뷰를 누적
    const baseYear = 2025
    let total = 0

    for (let y = 2026; y <= year; y++) {
      const endMonth = y === year ? month : 12
      const startMonth = y === 2026 ? 1 : 1

      for (let m = startMonth; m <= endMonth; m++) {
        const monthData = currentReviews.find(r => r.year === y && r.month === m)
        total += monthData?.newReviews || 0
      }
    }

    return total
  }

  const startEditing = (year: number, month: number) => {
    if (!isMaster) return

    const monthKey = `${year}-${month}`
    const data = getReviewData(year, month)

    setEditingMonth(monthKey)
    setEditForm({
      totalReviews: data?.totalReviews?.toString() || "",
      newReviews: data?.newReviews?.toString() || "",
      targetReviews: data?.targetReviews?.toString() || "",
    })
  }

  const cancelEditing = () => {
    setEditingMonth(null)
    setEditForm({ totalReviews: "", newReviews: "", targetReviews: "" })
  }

  const saveReview = async (year: number, month: number) => {
    try {
      const newReviews = parseInt(editForm.newReviews) || 0
      const targetReviews = parseInt(editForm.targetReviews) || null

      // 전체 리뷰 수는 2025년 기준 0개에서 2026년 1월부터 누적 계산
      const totalReviews = calculateTotalReviews(year, month) - (getReviewData(year, month)?.newReviews || 0) + newReviews

      const achievementRate = targetReviews && targetReviews > 0
        ? (newReviews / targetReviews) * 100
        : null

      const requestData = {
        clinicId,
        source: activeTab,
        year,
        month,
        totalReviews,
        newReviews,
        targetReviews,
        achievementRate
      }

      const response = await fetch("/api/reviews/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      })

      if (response.ok) {
        await fetchAllData()
        cancelEditing()
      } else {
        const error = await response.json()
        alert(`저장 실패: ${error.error}`)
      }
    } catch (error) {
      alert("저장 중 오류가 발생했습니다.")
    }
  }

  const saveGoogleConfig = async () => {
    setSaving("CONFIG")
    try {
      if (!configForm.placeName.trim()) {
        alert("업체명을 입력해주세요")
        return
      }
      if (!configForm.placeId.trim()) {
        alert("Google Place ID를 입력해주세요")
        return
      }

      const response = await fetch("/api/reviews/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          source: "GOOGLE",
          placeName: configForm.placeName.trim(),
          placeId: configForm.placeId.trim(),
        }),
      })

      if (response.ok) {
        await fetchAllData()
        alert("구글 리뷰 설정이 저장되었습니다.")
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

  const collectGoogleReviews = async () => {
    if (!googleConfig?.placeId) {
      alert("먼저 구글 설정을 완료해주세요.")
      return
    }

    setSaving("CRAWL")
    try {
      const response = await fetch("/api/reviews/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, source: "GOOGLE" }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(`구글 리뷰 수집 완료!\n새로운 리뷰: ${data.newReviewsCount}개`)
        await fetchAllData()
      } else {
        const error = await response.json()
        alert(`리뷰 수집 실패: ${error.error}`)
      }
    } catch (error) {
      alert("리뷰 수집 중 오류가 발생했습니다.")
    } finally {
      setSaving(null)
    }
  }

  const init2025Data = async () => {
    if (!confirm("2025년 기준 데이터를 0개로 초기화하시겠습니까?\n(기존 2025년 데이터가 있으면 유지됩니다)")) {
      return
    }

    setSaving("INIT")
    try {
      const response = await fetch("/api/reviews/init-2025", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(`2025년 기준 데이터 초기화 완료!\n${data.message}`)
        await fetchAllData()
      } else {
        const error = await response.json()
        alert(`초기화 실패: ${error.error}`)
      }
    } catch (error) {
      alert("초기화 중 오류가 발생했습니다.")
    } finally {
      setSaving(null)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [clinicId])

  if (loading) {
    return <div className="text-center py-8">데이터를 불러오는 중...</div>
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Calendar className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold">리뷰 월별 관리</h3>
            <p className="text-sm text-gray-600">
              {isMaster ? "데이터 입력 및 목표 설정" : "현황 조회"}
            </p>
          </div>
        </div>
        {isMaster && (
          <div className="flex items-center space-x-3">
            <button
              onClick={init2025Data}
              disabled={saving === "INIT"}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {saving === "INIT" ? "초기화 중..." : "2025년 기준 초기화"}
            </button>
            <div className="text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">
              마스터 권한
            </div>
          </div>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("NAVER")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "NAVER"
              ? "bg-white text-green-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <span className="flex items-center space-x-1">
            <span className="w-4 h-4 bg-green-500 rounded text-white text-xs flex items-center justify-center font-bold">N</span>
            <span>네이버</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab("GOOGLE")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "GOOGLE"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <span className="flex items-center space-x-1">
            <span className="w-4 h-4 bg-blue-500 rounded text-white text-xs flex items-center justify-center font-bold">G</span>
            <span>구글</span>
          </span>
        </button>
      </div>

      {/* 구글 설정 섹션 */}
      {activeTab === "GOOGLE" && isMaster && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Settings className="w-5 h-5 text-blue-600" />
              <h4 className="text-lg font-semibold text-blue-800">구글 리뷰 설정</h4>
            </div>
            {googleConfig && (
              <button
                onClick={collectGoogleReviews}
                disabled={saving === "CRAWL"}
                className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center space-x-1"
              >
                <RefreshCw className={`w-4 h-4 ${saving === "CRAWL" ? "animate-spin" : ""}`} />
                <span>{saving === "CRAWL" ? "수집중..." : "자동 수집"}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-2">업체명</label>
              <input
                type="text"
                value={configForm.placeName}
                onChange={(e) => setConfigForm(prev => ({ ...prev, placeName: e.target.value }))}
                placeholder="구글 비즈니스에 등록된 치과 이름"
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-2">Google Place ID</label>
              <input
                type="text"
                value={configForm.placeId}
                onChange={(e) => setConfigForm(prev => ({ ...prev, placeId: e.target.value }))}
                placeholder="ChIJ..."
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <p className="text-xs text-blue-600">
              <a
                href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Place ID 찾는 방법 →
              </a>
            </p>
            <button
              onClick={saveGoogleConfig}
              disabled={saving === "CONFIG" || !configForm.placeName || !configForm.placeId}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {saving === "CONFIG" ? "저장 중..." : "설정 저장"}
            </button>
          </div>

          {googleConfig?.lastSyncAt && (
            <p className="mt-2 text-xs text-blue-600">
              마지막 동기화: {new Date(googleConfig.lastSyncAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* 월별 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-2 font-medium text-gray-700">월</th>
              <th className="text-center py-3 px-2 font-medium text-gray-700">총 리뷰</th>
              <th className="text-center py-3 px-2 font-medium text-gray-700">신규 리뷰</th>
              <th className="text-center py-3 px-2 font-medium text-gray-700">목표</th>
              <th className="text-center py-3 px-2 font-medium text-gray-700">달성률</th>
              {isMaster && <th className="text-center py-3 px-2 font-medium text-gray-700">작업</th>}
            </tr>
          </thead>
          <tbody>
            {months.map(({ year, month, key }) => {
              const data = getReviewData(year, month)
              const isEditing = editingMonth === key
              const isCurrentMonth = year === currentDate.getFullYear() && month === currentDate.getMonth() + 1

              return (
                <tr key={key} className={`border-b border-gray-100 hover:bg-gray-50 ${isCurrentMonth ? 'bg-blue-50' : ''}`}>
                  <td className="py-3 px-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{year}.{String(month).padStart(2, '0')}</span>
                      {isCurrentMonth && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">현재</span>
                      )}
                    </div>
                  </td>

                  <td className="text-center py-3 px-2">
                    <span className="font-semibold">{calculateTotalReviews(year, month)}</span>
                    {isEditing && (
                      <div className="text-xs text-gray-500 mt-1">누적 계산</div>
                    )}
                  </td>

                  <td className="text-center py-3 px-2">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editForm.newReviews}
                        onChange={(e) => setEditForm(prev => ({ ...prev, newReviews: e.target.value }))}
                        className="w-16 px-2 py-1 text-center border border-gray-300 rounded text-sm"
                      />
                    ) : (
                      <span>{data?.newReviews || 0}</span>
                    )}
                  </td>

                  <td className="text-center py-3 px-2">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editForm.targetReviews}
                        onChange={(e) => setEditForm(prev => ({ ...prev, targetReviews: e.target.value }))}
                        className="w-16 px-2 py-1 text-center border border-gray-300 rounded text-sm"
                        placeholder="목표"
                      />
                    ) : (
                      <div className="flex items-center justify-center space-x-1">
                        <Target className="w-3 h-3 text-gray-400" />
                        <span>{data?.targetReviews || "—"}</span>
                      </div>
                    )}
                  </td>

                  <td className="text-center py-3 px-2">
                    {data?.achievementRate !== null && data?.achievementRate !== undefined ? (
                      <div className="flex items-center justify-center space-x-1">
                        <TrendingUp className={`w-3 h-3 ${data.achievementRate >= 100 ? 'text-green-500' : 'text-yellow-500'}`} />
                        <span className={`font-medium ${data.achievementRate >= 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                          {data.achievementRate.toFixed(0)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  {isMaster && (
                    <td className="text-center py-3 px-2">
                      {isEditing ? (
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => saveReview(year, month)}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                          >
                            <Save className="w-3 h-3" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(year, month)}
                          className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

        {/* 요약 통계 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`${activeTab === "NAVER" ? "bg-green-50" : "bg-blue-50"} rounded-lg p-3 text-center`}>
            <div className={`text-lg font-bold ${activeTab === "NAVER" ? "text-green-700" : "text-blue-700"}`}>
              {currentReviews.reduce((sum, r) => sum + r.newReviews, 0)}
            </div>
            <div className={`text-xs ${activeTab === "NAVER" ? "text-green-600" : "text-blue-600"}`}>올해 총 신규</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-green-700">
              {currentReviews.filter(r => r.achievementRate && r.achievementRate >= 100).length}
            </div>
            <div className="text-xs text-green-600">목표 달성 월</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-yellow-700">
              {currentReviews.length > 0
                ? (currentReviews.reduce((sum, r) => sum + (r.achievementRate || 0), 0) / currentReviews.length).toFixed(0)
                : 0}%
            </div>
            <div className="text-xs text-yellow-600">평균 달성률</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-700">
              {currentDate.getFullYear() === 2026
                ? calculateTotalReviews(currentDate.getFullYear(), currentDate.getMonth() + 1)
                : 0}
            </div>
            <div className="text-xs text-gray-600">현재 총 리뷰</div>
          </div>
        </div>
      </div>
    </div>
  )
}