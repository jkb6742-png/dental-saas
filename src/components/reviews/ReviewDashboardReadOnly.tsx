"use client"

import { useState, useEffect } from "react"
import { Calendar, Target, TrendingUp, MessageCircle } from "lucide-react"

interface MonthlyReview {
  id: string
  year: number
  month: number
  totalReviews: number
  newReviews: number
  targetReviews: number | null
  achievementRate: number | null
}

interface ReviewDashboardReadOnlyProps {
  clinicId: string
}

export default function ReviewDashboardReadOnly({ clinicId }: ReviewDashboardReadOnlyProps) {
  const [reviews, setReviews] = useState<MonthlyReview[]>([])
  const [loading, setLoading] = useState(true)

  const currentDate = new Date()
  const currentMonth = reviews.find(r =>
    r.year === currentDate.getFullYear() &&
    r.month === currentDate.getMonth() + 1
  )

  const fetchReviews = async () => {
    try {
      const response = await fetch(`/api/reviews/monthly?clinicId=${clinicId}`)
      if (response.ok) {
        const data = await response.json()
        setReviews(data)
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
  }, [clinicId])

  if (loading) {
    return <div className="text-center py-8">데이터를 불러오는 중...</div>
  }

  const thisYearReviews = reviews.filter(r => r.year === currentDate.getFullYear())
  const totalNewThisYear = thisYearReviews.reduce((sum, r) => sum + r.newReviews, 0)
  const achievedMonths = thisYearReviews.filter(r => r.achievementRate && r.achievementRate >= 100).length
  const avgAchievementRate = thisYearReviews.length > 0
    ? thisYearReviews.reduce((sum, r) => sum + (r.achievementRate || 0), 0) / thisYearReviews.length
    : 0

  return (
    <div className="space-y-6">
      {/* 현재 월 요약 */}
      <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl border border-green-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <MessageCircle className="w-6 h-6 text-green-600" />
          <div>
            <h3 className="text-lg font-semibold text-green-800">
              {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월 네이버 리뷰 현황
            </h3>
            <p className="text-sm text-green-600">이번 달 목표 달성 현황</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-800">
              {currentMonth?.totalReviews || 0}
            </div>
            <div className="text-sm text-gray-600">총 리뷰 수</div>
          </div>

          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {currentMonth?.newReviews || 0}
            </div>
            <div className="text-sm text-gray-600">이번 달 신규</div>
          </div>

          <div className="bg-white rounded-lg p-4 text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Target className="w-5 h-5 text-yellow-500" />
              <div className="text-2xl font-bold text-yellow-600">
                {currentMonth?.targetReviews || "—"}
              </div>
            </div>
            <div className="text-sm text-gray-600">목표 리뷰</div>
          </div>

          <div className="bg-white rounded-lg p-4 text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <TrendingUp className={`w-5 h-5 ${
                (currentMonth?.achievementRate || 0) >= 100 ? 'text-green-500' : 'text-orange-500'
              }`} />
              <div className={`text-2xl font-bold ${
                (currentMonth?.achievementRate || 0) >= 100 ? 'text-green-600' : 'text-orange-600'
              }`}>
                {currentMonth?.achievementRate ? `${currentMonth.achievementRate.toFixed(0)}%` : "—"}
              </div>
            </div>
            <div className="text-sm text-gray-600">달성률</div>
          </div>
        </div>

        {/* 목표 달성 상태 메시지 */}
        {currentMonth?.targetReviews && currentMonth?.achievementRate !== null && (
          <div className="mt-4 p-3 rounded-lg text-center">
            {currentMonth.achievementRate >= 100 ? (
              <div className="text-green-700 bg-green-100 rounded-lg p-2">
                🎉 이번 달 목표를 달성했습니다!
              </div>
            ) : (
              <div className="text-orange-700 bg-orange-100 rounded-lg p-2">
                💪 목표 달성까지 {currentMonth.targetReviews - currentMonth.newReviews}개 남았습니다
              </div>
            )}
          </div>
        )}
      </div>

      {/* 연간 성과 요약 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">{currentDate.getFullYear()}년 연간 성과</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-xl font-bold text-blue-700">{totalNewThisYear}</div>
            <div className="text-sm text-blue-600">올해 총 신규 리뷰</div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-xl font-bold text-green-700">{achievedMonths}</div>
            <div className="text-sm text-green-600">목표 달성 월</div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <div className="text-xl font-bold text-yellow-700">{avgAchievementRate.toFixed(0)}%</div>
            <div className="text-sm text-yellow-600">평균 달성률</div>
          </div>
        </div>
      </div>

      {/* 최근 6개월 트렌드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">최근 6개월 트렌드</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-700">월</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">총 리뷰</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">신규</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">목표</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">달성률</th>
              </tr>
            </thead>
            <tbody>
              {reviews.slice(0, 6).map((review) => (
                <tr key={review.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium">
                    {review.year}.{String(review.month).padStart(2, '0')}
                  </td>
                  <td className="text-center py-2 px-3">{review.totalReviews}</td>
                  <td className="text-center py-2 px-3">{review.newReviews}</td>
                  <td className="text-center py-2 px-3">{review.targetReviews || "—"}</td>
                  <td className="text-center py-2 px-3">
                    {review.achievementRate !== null ? (
                      <span className={`font-medium ${
                        review.achievementRate >= 100 ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {review.achievementRate.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {reviews.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              아직 등록된 리뷰 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}