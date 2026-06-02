"use client"

import { useState, useEffect } from "react"
import { Star, MessageCircle, TrendingUp, RefreshCw } from "lucide-react"
import KpiCard from "@/components/ui/KpiCard"
import SectionCard from "@/components/ui/SectionCard"

interface ReviewSummary {
  id: string
  source: "NAVER" | "GOOGLE"
  year: number
  month: number
  totalReviews: number
  newReviews: number
  avgRating: number | null
  positiveCount: number
  negativeCount: number
  replyRate: number | null
}

interface RecentReview {
  id: string
  source: "NAVER" | "GOOGLE"
  authorName: string | null
  rating: number | null
  content: string | null
  reviewDate: string | null
  isPositive: boolean | null
}

interface ReviewDashboardProps {
  clinicId: string
  year: number
  month: number
}

export default function ReviewDashboard({ clinicId, year, month }: ReviewDashboardProps) {
  const [summaries, setSummaries] = useState<ReviewSummary[]>([])
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([])
  const [loading, setLoading] = useState(true)
  const [crawling, setCrawling] = useState<string | null>(null)

  const fetchReviewData = async () => {
    try {
      const response = await fetch(`/api/reviews/summary?clinicId=${clinicId}&year=${year}&month=${month}`)
      if (response.ok) {
        const data = await response.json()
        setSummaries(data.currentMonth || [])
        setRecentReviews(data.recentReviews || [])
      }
    } catch (error) {
      console.error("Failed to fetch review data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCrawl = async (source: "GOOGLE") => {
    setCrawling(source)
    try {
      const response = await fetch("/api/reviews/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, source }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(`${source} 리뷰 수집 완료!\n새로운 리뷰: ${data.newReviewsCount}개`)
        await fetchReviewData() // 데이터 새로고침
      } else {
        const error = await response.json()
        alert(`리뷰 수집 실패: ${error.error}`)
      }
    } catch (error) {
      alert("리뷰 수집 중 오류가 발생했습니다.")
    } finally {
      setCrawling(null)
    }
  }

  useEffect(() => {
    fetchReviewData()
  }, [clinicId, year, month])

  if (loading) {
    return <div className="text-center py-8">리뷰 데이터를 불러오는 중...</div>
  }

  const naverSummary = summaries.find(s => s.source === "NAVER")
  const googleSummary = summaries.find(s => s.source === "GOOGLE")

  const totalReviews = (naverSummary?.totalReviews || 0) + (googleSummary?.totalReviews || 0)
  const totalNewReviews = (naverSummary?.newReviews || 0) + (googleSummary?.newReviews || 0)

  const avgRating = summaries.length > 0
    ? summaries.reduce((sum, s) => sum + (s.avgRating || 0), 0) / summaries.filter(s => s.avgRating).length
    : null

  return (
    <div className="space-y-6">
      {/* 리뷰 현황 요약 */}
      <SectionCard
        title="리뷰 현황"
        description={`${year}년 ${month}월 온라인 리뷰 현황`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            label="전체 리뷰"
            value={totalReviews}
            unit="개"
            icon={<MessageCircle className="w-4 h-4" />}
            color="blue"
          />
          <KpiCard
            label="이번달 신규"
            value={totalNewReviews}
            unit="개"
            icon={<TrendingUp className="w-4 h-4" />}
            color="green"
          />
          <KpiCard
            label="평균 평점"
            value={avgRating ? avgRating.toFixed(1) : "—"}
            unit="점"
            icon={<Star className="w-4 h-4" />}
            color="yellow"
          />
        </div>
      </SectionCard>

      {/* 플랫폼별 상세 현황 */}
      <SectionCard title="플랫폼별 상세" description="네이버, 구글 리뷰 현황">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 네이버 리뷰 */}
          <div className="bg-green-50 rounded-xl p-6 border border-green-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  N
                </div>
                <h3 className="text-lg font-semibold text-green-800">네이버 리뷰</h3>
              </div>
              <a
                href={`/dashboard/${clinicId}/reviews?tab=settings`}
                className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium flex items-center space-x-1"
              >
                <span>📝</span>
                <span>입력</span>
              </a>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-green-700">
                  {naverSummary?.totalReviews || 0}
                </div>
                <div className="text-sm text-green-600">전체 리뷰</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-700">
                  {naverSummary?.avgRating?.toFixed(1) || "—"}
                </div>
                <div className="text-sm text-green-600">평균 평점</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-700">
                  {naverSummary?.newReviews || 0}
                </div>
                <div className="text-sm text-green-600">이번달 신규</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-700">
                  {naverSummary?.replyRate?.toFixed(0) || "0"}%
                </div>
                <div className="text-sm text-green-600">답글 응답률</div>
              </div>
            </div>
          </div>

          {/* 구글 리뷰 */}
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  G
                </div>
                <h3 className="text-lg font-semibold text-blue-800">구글 리뷰</h3>
              </div>
              <button
                onClick={() => handleCrawl("GOOGLE")}
                disabled={crawling === "GOOGLE"}
                className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center space-x-1"
              >
                <RefreshCw className={`w-4 h-4 ${crawling === "GOOGLE" ? "animate-spin" : ""}`} />
                <span>{crawling === "GOOGLE" ? "수집중..." : "수집"}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-blue-700">
                  {googleSummary?.totalReviews || 0}
                </div>
                <div className="text-sm text-blue-600">전체 리뷰</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-700">
                  {googleSummary?.avgRating?.toFixed(1) || "—"}
                </div>
                <div className="text-sm text-blue-600">평균 평점</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-blue-700">
                  {googleSummary?.newReviews || 0}
                </div>
                <div className="text-sm text-blue-600">이번달 신규</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-blue-700">
                  {googleSummary?.replyRate?.toFixed(0) || "0"}%
                </div>
                <div className="text-sm text-blue-600">답글 응답률</div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 주요 피드백 */}
      {summaries.some(s => s.topKeywords && (s.topKeywords as any).feedback) && (
        <SectionCard title="주요 피드백" description="개선이 필요한 부분">
          <div className="space-y-3">
            {summaries.map((summary) => {
              const feedback = summary.topKeywords && (summary.topKeywords as any).feedback
              if (!feedback || !Array.isArray(feedback)) return null

              return (
                <div key={summary.source} className="border rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      summary.source === "NAVER"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {summary.source}
                    </span>
                    <span className="text-sm text-gray-600">피드백 {feedback.length}건</span>
                  </div>
                  <div className="space-y-2">
                    {feedback.map((item: string, index: number) => (
                      <div key={index} className="flex items-start space-x-2">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm text-gray-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {/* 최근 리뷰 */}
      {recentReviews.length > 0 && (
        <SectionCard title="최근 리뷰" description="최근 작성된 리뷰">
          <div className="space-y-4">
            {recentReviews.map((review) => (
              <div
                key={review.id}
                className="bg-gray-50 rounded-lg p-4 border border-gray-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      review.source === "NAVER"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {review.source}
                    </span>
                    <span className="font-medium text-gray-900">
                      {review.authorName || "익명"}
                    </span>
                    {review.rating && (
                      <div className="flex items-center">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < review.rating! ? "text-yellow-400 fill-current" : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {review.reviewDate ? new Date(review.reviewDate).toLocaleDateString() : ""}
                  </span>
                </div>
                {review.content && (
                  <p className="text-sm text-gray-700 line-clamp-3">
                    {review.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}