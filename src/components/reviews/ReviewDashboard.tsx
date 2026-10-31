"use client"

import { useState, useEffect } from "react"
import { Star, MessageCircle, TrendingUp, RefreshCw, Edit } from "lucide-react"
import {
  ComposedChart, Bar, Line, LabelList,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts"
import KpiCard from "@/components/ui/KpiCard"
import SectionCard from "@/components/ui/SectionCard"
import ReviewManualInput from "./ReviewManualInput"

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

interface MonthlyTarget {
  source: "NAVER" | "GOOGLE"
  targetReviews: number | null
  achievementRate: number | null
}

interface ReviewDashboardProps {
  clinicId: string
  year: number
  month: number
}

export default function ReviewDashboard({ clinicId, year, month }: ReviewDashboardProps) {
  const [summaries, setSummaries] = useState<ReviewSummary[]>([])
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([])
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTarget[]>([])
  const [monthlyChart, setMonthlyChart] = useState<Array<{ label: string; 네이버: number; 구글: number }>>([])
  const [chartSource, setChartSource] = useState<"NAVER" | "GOOGLE">("NAVER")
  const [loading, setLoading] = useState(true)
  const [crawling, setCrawling] = useState<string | null>(null)
  const [showManualInput, setShowManualInput] = useState<"NAVER" | "GOOGLE" | null>(null)

  const fetchReviewData = async () => {
    try {
      // 요약 데이터 가져오기
      const summaryResponse = await fetch(`/api/reviews/summary?clinicId=${clinicId}&year=${year}&month=${month}`)
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json()
        setSummaries(summaryData.currentMonth || [])
        setRecentReviews(summaryData.recentReviews || [])
      }

      // 월별 데이터를 플랫폼별로 조회 (source 없이 부르면 응답에 source가 없어 구분 불가)
      const [naverMRes, googleMRes] = await Promise.all([
        fetch(`/api/reviews/monthly?clinicId=${clinicId}&year=${year}&source=NAVER`),
        fetch(`/api/reviews/monthly?clinicId=${clinicId}&year=${year}&source=GOOGLE`),
      ])
      const naverM: any[] = naverMRes.ok ? await naverMRes.json() : []
      const googleM: any[] = googleMRes.ok ? await googleMRes.json() : []

      // 이번달 목표/달성률
      const nT = naverM.find((m) => m.month === month)
      const gT = googleM.find((m) => m.month === month)
      setMonthlyTargets([
        { source: "NAVER", targetReviews: nT?.targetReviews ?? null, achievementRate: nT?.achievementRate ?? null },
        { source: "GOOGLE", targetReviews: gT?.targetReviews ?? null, achievementRate: gT?.achievementRate ?? null },
      ])

      // 월별 신규 리뷰 추이 차트 데이터 (월 기준 병합)
      const byMonth = new Map<number, { month: number; 네이버: number; 구글: number }>()
      for (const m of naverM) byMonth.set(m.month, { month: m.month, 네이버: m.newReviews || 0, 구글: 0 })
      for (const m of googleM) {
        const e = byMonth.get(m.month) || { month: m.month, 네이버: 0, 구글: 0 }
        e.구글 = m.newReviews || 0
        byMonth.set(m.month, e)
      }
      setMonthlyChart(
        Array.from(byMonth.values())
          .sort((a, b) => a.month - b.month)
          .map((e) => ({ label: `${e.month}월`, 네이버: e.네이버, 구글: e.구글 }))
      )
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

  const handleManualSave = async (stats: any) => {
    try {
      const response = await fetch("/api/reviews/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          source: stats.source,
          year,
          month,
          totalReviews: stats.totalReviews,
          newReviews: stats.monthlyReviews,
          avgRating: stats.averageRating,
          feedbackComments: stats.feedbackComments
        }),
      })

      if (response.ok) {
        alert(`${stats.source === 'NAVER' ? '네이버' : '구글'} 리뷰가 저장되었습니다.`)
        setShowManualInput(null)
        await fetchReviewData()
      } else {
        const error = await response.json()
        alert(`저장 실패: ${error.error}`)
      }
    } catch (error) {
      alert("저장 중 오류가 발생했습니다.")
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
  const naverTarget = monthlyTargets.find(t => t.source === "NAVER")
  const googleTarget = monthlyTargets.find(t => t.source === "GOOGLE")

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

      {/* 월별 신규 리뷰 추이 (네이버/구글 토글) */}
      <SectionCard title="월별 신규 리뷰 추이" description={`${year}년 ${chartSource === "NAVER" ? "네이버" : "구글"} 신규 리뷰`}>
        {/* 플랫폼 토글 */}
        <div className="flex items-center gap-1 mb-4 w-fit p-1 bg-[#f2f4f6] rounded-[10px]">
          {(["NAVER", "GOOGLE"] as const).map((src) => (
            <button
              key={src}
              onClick={() => setChartSource(src)}
              className={`px-3.5 py-1.5 rounded-[8px] text-[13px] font-semibold transition-colors ${
                chartSource === src
                  ? "bg-white text-[#191f28] shadow-sm"
                  : "text-[#8b95a1] hover:text-[#4e5968]"
              }`}
            >
              {src === "NAVER" ? "네이버" : "구글"}
            </button>
          ))}
        </div>

        {monthlyChart.some((d) => (chartSource === "NAVER" ? d.네이버 : d.구글) > 0) ? (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthlyChart} margin={{ top: 22, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} tickMargin={10} padding={{ left: 12, right: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} width={32} tickMargin={8} />
              <Tooltip
                formatter={(v: any) => [`${v}개`, "신규 리뷰"]}
                contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px 0 rgb(0 0 0 / 0.10)", fontSize: 13 }}
              />
              <Bar
                dataKey={chartSource === "NAVER" ? "네이버" : "구글"}
                name="신규 리뷰"
                fill={chartSource === "NAVER" ? "#d4f2e4" : "#d4e4fd"}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Line
                type="monotone"
                dataKey={chartSource === "NAVER" ? "네이버" : "구글"}
                name="추이"
                stroke={chartSource === "NAVER" ? "#05c072" : "#3182f6"}
                strokeWidth={2.5}
                dot={{ r: 3, fill: chartSource === "NAVER" ? "#05c072" : "#3182f6" }}
                activeDot={{ r: 5 }}
                tooltipType="none"
              >
                <LabelList
                  dataKey={chartSource === "NAVER" ? "네이버" : "구글"}
                  position="top"
                  formatter={(v: any) => (typeof v === "number" && v > 0 ? v : "")}
                  offset={10}
                  style={{ fontSize: 11, fontWeight: 700, fill: chartSource === "NAVER" ? "#05c072" : "#3182f6" }}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-10 text-[13px] text-[#adb5bd]">
            {chartSource === "NAVER" ? "네이버" : "구글"} 신규 리뷰 데이터가 없습니다. 아래에서 입력하면 표시됩니다.
          </div>
        )}
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
              <button
                onClick={() => setShowManualInput("NAVER")}
                className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium flex items-center space-x-1"
              >
                <Edit className="w-4 h-4" />
                <span>입력</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-green-700">
                  {naverSummary?.totalReviews || 0}
                </div>
                <div className="text-sm text-green-600">전체 리뷰</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-700">
                  {naverSummary?.newReviews || 0}
                </div>
                <div className="text-sm text-green-600">이번달 신규</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-700">
                  {naverTarget?.targetReviews || "—"}
                </div>
                <div className="text-sm text-green-600">이번달 목표</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-700">
                  {naverTarget?.achievementRate ? `${naverTarget.achievementRate.toFixed(0)}%` : "—"}
                </div>
                <div className="text-sm text-green-600">달성률</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="w-full bg-green-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(naverTarget?.achievementRate ?? 0, 100)}%` }}
                />
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
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowManualInput("GOOGLE")}
                  className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium flex items-center space-x-1"
                >
                  <Edit className="w-4 h-4" />
                  <span>입력</span>
                </button>
                <button
                  onClick={() => handleCrawl("GOOGLE")}
                  disabled={crawling === "GOOGLE"}
                  className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center space-x-1"
                >
                  <RefreshCw className={`w-4 h-4 ${crawling === "GOOGLE" ? "animate-spin" : ""}`} />
                  <span>{crawling === "GOOGLE" ? "수집중..." : "자동수집"}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-blue-700">
                  {googleSummary?.totalReviews || 0}
                </div>
                <div className="text-sm text-blue-600">전체 리뷰</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-blue-700">
                  {googleSummary?.newReviews || 0}
                </div>
                <div className="text-sm text-blue-600">이번달 신규</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-blue-700">
                  {googleTarget?.targetReviews || "—"}
                </div>
                <div className="text-sm text-blue-600">이번달 목표</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-blue-700">
                  {googleTarget?.achievementRate ? `${googleTarget.achievementRate.toFixed(0)}%` : "—"}
                </div>
                <div className="text-sm text-blue-600">달성률</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(googleTarget?.achievementRate ?? 0, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 주요 피드백 */}
      {false && (
        <SectionCard title="주요 피드백" description="개선이 필요한 부분">
          <div className="space-y-3">
            {summaries.map((summary) => {
              return null
            })}
          </div>
        </SectionCard>
      )}

      {/* 수동 입력 모달 */}
      {showManualInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {showManualInput === 'NAVER' ? '네이버' : '구글'} 리뷰 수동 입력
              </h2>
              <button
                onClick={() => setShowManualInput(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <ReviewManualInput
                clinicId={clinicId}
                source={showManualInput}
                onSave={handleManualSave}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}