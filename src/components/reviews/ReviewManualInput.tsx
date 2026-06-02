"use client"

import { useState } from "react"
import { Calendar, MessageCircle, Star, AlertTriangle } from "lucide-react"

interface ReviewStats {
  source: "NAVER" | "GOOGLE"
  totalReviews: number
  monthlyReviews: number
  averageRating: number
  feedbackComments: string[]
}

interface ReviewManualInputProps {
  clinicId: string
  onSave: (stats: ReviewStats) => void
}

export default function ReviewManualInput({ clinicId, onSave }: ReviewManualInputProps) {
  const [naverStats, setNaverStats] = useState({
    totalReviews: 0,
    monthlyReviews: 0,
    averageRating: 0,
    feedbackComments: [] as string[]
  })

  const [feedbackInput, setFeedbackInput] = useState("")

  const addFeedback = () => {
    if (feedbackInput.trim()) {
      setNaverStats(prev => ({
        ...prev,
        feedbackComments: [...prev.feedbackComments, feedbackInput.trim()]
      }))
      setFeedbackInput("")
    }
  }

  const removeFeedback = (index: number) => {
    setNaverStats(prev => ({
      ...prev,
      feedbackComments: prev.feedbackComments.filter((_, i) => i !== index)
    }))
  }

  const handleSave = () => {
    const stats: ReviewStats = {
      source: "NAVER",
      ...naverStats
    }
    onSave(stats)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
          N
        </div>
        <h3 className="text-lg font-semibold">네이버 리뷰 현황 입력</h3>
      </div>

      {/* 기본 통계 입력 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MessageCircle className="w-4 h-4 inline mr-1" />
            총 리뷰 수
          </label>
          <input
            type="number"
            value={naverStats.totalReviews}
            onChange={(e) => setNaverStats(prev => ({
              ...prev,
              totalReviews: parseInt(e.target.value) || 0
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="총 리뷰 개수"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            이번달 신규 리뷰
          </label>
          <input
            type="number"
            value={naverStats.monthlyReviews}
            onChange={(e) => setNaverStats(prev => ({
              ...prev,
              monthlyReviews: parseInt(e.target.value) || 0
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="이번달 리뷰 수"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Star className="w-4 h-4 inline mr-1" />
            평균 평점
          </label>
          <input
            type="number"
            step="0.1"
            min="1"
            max="5"
            value={naverStats.averageRating}
            onChange={(e) => setNaverStats(prev => ({
              ...prev,
              averageRating: parseFloat(e.target.value) || 0
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="평균 평점 (1-5)"
          />
        </div>
      </div>

      {/* 피드백 댓글 입력 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <AlertTriangle className="w-4 h-4 inline mr-1 text-yellow-500" />
          주요 피드백 / 개선사항 댓글
        </label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={feedbackInput}
            onChange={(e) => setFeedbackInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addFeedback()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="개선이 필요한 부분이나 중요한 피드백 입력..."
          />
          <button
            onClick={addFeedback}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            추가
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          부정적 피드백이나 개선사항 위주로 입력해주세요
        </p>
      </div>

      {/* 피드백 목록 */}
      {naverStats.feedbackComments.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">등록된 피드백</h4>
          <div className="space-y-2">
            {naverStats.feedbackComments.map((comment, index) => (
              <div key={index} className="flex items-center justify-between bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-200">
                <span className="text-sm text-gray-700">{comment}</span>
                <button
                  onClick={() => removeFeedback(index)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 저장 버튼 */}
      <button
        onClick={handleSave}
        disabled={!naverStats.totalReviews}
        className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        네이버 리뷰 현황 저장
      </button>

      {/* 사용 안내 */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <h5 className="text-sm font-medium text-blue-800 mb-2">📋 입력 방법</h5>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• 네이버 지도에서 치과를 검색하고 리뷰 탭을 확인</li>
          <li>• 총 리뷰 수와 이번달 작성된 리뷰 수를 직접 확인하여 입력</li>
          <li>• 개선이 필요한 피드백이나 부정적 댓글만 따로 기록</li>
          <li>• 월 1회 정도 업데이트하면 충분합니다</li>
        </ul>
      </div>
    </div>
  )
}