"use client"

import { useState, useEffect } from "react"
import { Calendar, Target, TrendingUp, Edit2, Save, X } from "lucide-react"

interface MonthlyReview {
  id: string
  year: number
  month: number
  totalReviews: number
  newReviews: number
  targetReviews: number | null
  achievementRate: number | null
}

interface MonthlyReviewManagerProps {
  clinicId: string
  userRole: string
}

export default function MonthlyReviewManager({ clinicId, userRole }: MonthlyReviewManagerProps) {
  const [reviews, setReviews] = useState<MonthlyReview[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMonth, setEditingMonth] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    totalReviews: "",
    newReviews: "",
    targetReviews: "",
  })

  const isMaster = userRole === 'MASTER'
  const currentDate = new Date()

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

  const fetchReviews = async () => {
    try {
      const response = await fetch(`/api/reviews/monthly?clinicId=${clinicId}`)
      if (response.ok) {
        const data = await response.json()
        setReviews(data)
      }
    } catch (error) {
      console.error("Failed to fetch monthly reviews:", error)
    } finally {
      setLoading(false)
    }
  }

  const getReviewData = (year: number, month: number) => {
    return reviews.find(r => r.year === year && r.month === month)
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
      const totalReviews = parseInt(editForm.totalReviews) || 0
      const newReviews = parseInt(editForm.newReviews) || 0
      const targetReviews = parseInt(editForm.targetReviews) || null

      const achievementRate = targetReviews && targetReviews > 0
        ? (newReviews / targetReviews) * 100
        : null

      const requestData = {
        clinicId,
        source: "NAVER",
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
        await fetchReviews()
        cancelEditing()
      } else {
        const error = await response.json()
        alert(`저장 실패: ${error.error}`)
      }
    } catch (error) {
      alert("저장 중 오류가 발생했습니다.")
    }
  }

  useEffect(() => {
    fetchReviews()
  }, [clinicId])

  if (loading) {
    return <div className="text-center py-8">데이터를 불러오는 중...</div>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Calendar className="w-6 h-6 text-green-600" />
          <div>
            <h3 className="text-lg font-semibold">네이버 리뷰 월별 관리</h3>
            <p className="text-sm text-gray-600">
              {isMaster ? "데이터 입력 및 목표 설정" : "현황 조회"}
            </p>
          </div>
        </div>
        {isMaster && (
          <div className="text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">
            마스터 권한
          </div>
        )}
      </div>

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
                    {isEditing ? (
                      <input
                        type="number"
                        value={editForm.totalReviews}
                        onChange={(e) => setEditForm(prev => ({ ...prev, totalReviews: e.target.value }))}
                        className="w-16 px-2 py-1 text-center border border-gray-300 rounded text-sm"
                      />
                    ) : (
                      <span className="font-semibold">{data?.totalReviews || 0}</span>
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
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-blue-700">
            {reviews.reduce((sum, r) => sum + r.newReviews, 0)}
          </div>
          <div className="text-xs text-blue-600">올해 총 신규</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-green-700">
            {reviews.filter(r => r.achievementRate && r.achievementRate >= 100).length}
          </div>
          <div className="text-xs text-green-600">목표 달성 월</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-yellow-700">
            {reviews.length > 0
              ? (reviews.reduce((sum, r) => sum + (r.achievementRate || 0), 0) / reviews.length).toFixed(0)
              : 0}%
          </div>
          <div className="text-xs text-yellow-600">평균 달성률</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-gray-700">
            {Math.max(...reviews.map(r => r.totalReviews))}
          </div>
          <div className="text-xs text-gray-600">최대 리뷰 수</div>
        </div>
      </div>
    </div>
  )
}