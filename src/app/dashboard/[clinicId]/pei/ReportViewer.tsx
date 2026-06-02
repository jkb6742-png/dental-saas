"use client"

import { useState, useEffect } from "react"
import Button from "@/components/ui/Button"
import SectionCard from "@/components/ui/SectionCard"
import {
  ArrowLeft,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  Lightbulb,
  BarChart3,
  Users,
  Star,
  Building,
  RefreshCw,
  FileText,
  Calendar,
  User,
  Loader2,
  Activity,
  MessageSquare,
  Award,
  Eye
} from "lucide-react"

interface ReportViewerProps {
  reportId: string
  onBack: () => void
}

interface ReportData {
  id: string
  title: string
  year: number
  month: number
  period: string
  summary: string
  insights: any
  recommendations: any
  peiScore: number
  categoryScores: any
  status: string
  generatedAt: string
  clinic: {
    name: string
    code: string
  }
  generatedBy: string
  analysis: any
}

export default function ReportViewer({ reportId, onBack }: ReportViewerProps) {
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadReport()
  }, [reportId])

  const loadReport = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/pei/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId })
      })

      const data = await response.json()

      if (data.success) {
        setReport(data.report)
      } else {
        setError(data.error || "보고서를 불러올 수 없습니다")
      }
    } catch (err) {
      setError("보고서 로딩 중 오류가 발생했습니다")
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case '매우 양호': return 'text-green-700 bg-green-100'
      case '양호': return 'text-blue-700 bg-blue-100'
      case '보통': return 'text-yellow-700 bg-yellow-100'
      case '개선 필요': return 'text-red-700 bg-red-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  const formatScore = (score: number) => score ? score.toFixed(2) : '0.00'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#3182f6]" />
        <span className="ml-2 text-[#8b95a1]">보고서를 불러오는 중...</span>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-[14px] text-red-600 mb-4">{error}</p>
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          목록으로 돌아가기
        </Button>
      </div>
    )
  }

  const analysisData = report.analysis || {}

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-[24px] font-bold text-[#191f28]">PEI 보고서</h1>
            <div className="flex items-center gap-4 text-[13px] text-[#8b95a1] mt-1">
              <span><Building className="w-3 h-3 inline mr-1" />{report.clinic.name}</span>
              <span><Calendar className="w-3 h-3 inline mr-1" />{report.period}</span>
              <span><User className="w-3 h-3 inline mr-1" />생성자: {report.generatedBy}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4" />
            PDF 다운로드
          </Button>
        </div>
      </div>

      {/* 1. 개요 */}
      <SectionCard
        title="1. 개요"
        description="기본 통계 및 전월 대비 현황"
        icon={<BarChart3 className="w-5 h-5" />}
      >
        <div className="space-y-4">
          {/* 기본 통계 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-[13px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-3 py-2 font-semibold">구분</th>
                  <th className="border border-gray-300 px-3 py-2 font-semibold">기간</th>
                  <th className="border border-gray-300 px-3 py-2 font-semibold">총 응답 수</th>
                  <th className="border border-gray-300 px-3 py-2 font-semibold">평균 점수 (5.0)</th>
                  <th className="border border-gray-300 px-3 py-2 font-semibold">성별 비율</th>
                  <th className="border border-gray-300 px-3 py-2 font-semibold">평균 연령대</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 font-medium bg-blue-50">Result</td>
                  <td className="border border-gray-300 px-3 py-2">{report.period}</td>
                  <td className="border border-gray-300 px-3 py-2">{analysisData.overview?.totalResponses || 0}명</td>
                  <td className="border border-gray-300 px-3 py-2">{formatScore(analysisData.overview?.averageScore || report.peiScore)}</td>
                  <td className="border border-gray-300 px-3 py-2">
                    남/{analysisData.overview?.genderRatio?.male || 0} / 여 {analysisData.overview?.genderRatio?.female || 0}
                  </td>
                  <td className="border border-gray-300 px-3 py-2">{analysisData.overview?.ageGroup || '30~40대 중심'}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 font-medium bg-yellow-50">Trend</td>
                  <td className="border border-gray-300 px-3 py-2">전월</td>
                  <td className="border border-gray-300 px-3 py-2">-</td>
                  <td className="border border-gray-300 px-3 py-2">-</td>
                  <td className="border border-gray-300 px-3 py-2">-</td>
                  <td className="border border-gray-300 px-3 py-2">-</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 font-medium bg-green-50">Comparison</td>
                  <td className="border border-gray-300 px-3 py-2">-</td>
                  <td className="border border-gray-300 px-3 py-2">
                    <span className={analysisData.overview?.monthlyComparison?.responseChange > 0 ? 'text-green-600' : 'text-red-600'}>
                      {analysisData.overview?.monthlyComparison?.responseChange > 0 ? '+' : ''}{analysisData.overview?.monthlyComparison?.responseChange || 0}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-3 py-2">
                    <span className={analysisData.overview?.monthlyComparison?.scoreChange > 0 ? 'text-green-600' : 'text-red-600'}>
                      {analysisData.overview?.monthlyComparison?.scoreChange > 0 ? '+' : ''}{analysisData.overview?.monthlyComparison?.scoreChange || 0}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-3 py-2">-</td>
                  <td className="border border-gray-300 px-3 py-2">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {/* (1-1) 평가 항목 */}
      <SectionCard
        title="(1-1) 평가 항목"
        description="영역별 상세 평가 결과"
        icon={<Award className="w-5 h-5" />}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-[13px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-3 py-2 font-semibold">구분</th>
                <th className="border border-gray-300 px-3 py-2 font-semibold">평균 점수 (5.0)</th>
                <th className="border border-gray-300 px-3 py-2 font-semibold">상태 진단</th>
                <th className="border border-gray-300 px-3 py-2 font-semibold">평가 요약</th>
              </tr>
            </thead>
            <tbody>
              {analysisData.detailedEvaluation?.map((item: any, index: number) => (
                <tr key={index}>
                  <td className="border border-gray-300 px-3 py-2 font-medium">{item.category}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{formatScore(item.score)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-1 rounded-full text-[11px] font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-3 py-2 leading-relaxed">{item.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* (1-2) 세부 요약 */}
      <SectionCard
        title="(1-2) 세부 요약"
        description="영역별 강점 및 개선 사항"
        icon={<Target className="w-5 h-5" />}
      >
        <div className="space-y-6">
          {/* 영역별 요약 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-[13px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-3 py-2 font-semibold">구분</th>
                  <th className="border border-gray-300 px-3 py-2 font-semibold">강점 요약</th>
                  <th className="border border-gray-300 px-3 py-2 font-semibold">개선 요약</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 font-medium bg-blue-50">원장 의료진</td>
                  <td className="border border-gray-300 px-3 py-2 leading-relaxed">
                    {analysisData.sectionalSummary?.medical?.strengths || '의료진 만족도 높음'}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 leading-relaxed">
                    {analysisData.sectionalSummary?.medical?.improvements || '개선사항 없음'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 font-medium bg-green-50">데스크 / 진료실</td>
                  <td className="border border-gray-300 px-3 py-2 leading-relaxed">
                    {analysisData.sectionalSummary?.staff?.strengths || '직원 응대 만족도 높음'}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 leading-relaxed">
                    {analysisData.sectionalSummary?.staff?.improvements || '개선사항 없음'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 font-medium bg-purple-50">시설 및 환경</td>
                  <td className="border border-gray-300 px-3 py-2 leading-relaxed">
                    {analysisData.sectionalSummary?.facilities?.strengths || '시설 만족도 높음'}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 leading-relaxed">
                    {analysisData.sectionalSummary?.facilities?.improvements || '개선사항 검토 필요'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 월 종합 평가 의견 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="text-[15px] font-semibold text-[#191f28] mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              월 종합 평가 의견
            </h4>
            <p className="text-[13px] text-[#4e5968] leading-relaxed">
              {analysisData.sectionalSummary?.overallEvaluation || report.summary}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* (1-3) 전월 비교 */}
      {analysisData.monthlyComparison && (
        <SectionCard
          title="(1-3) 전월 비교"
          description="전월 대비 개선 현황"
          icon={<TrendingUp className="w-5 h-5" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-[13px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-3 py-2 font-semibold">구분</th>
                  <th className="border border-gray-300 px-3 py-2 font-semibold">전월 주요 내용</th>
                  <th className="border border-gray-300 px-3 py-2 font-semibold">현월 주요 내용</th>
                  <th className="border border-gray-300 px-3 py-2 font-semibold">비고</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 font-medium">의료진</td>
                  <td className="border border-gray-300 px-3 py-2">{analysisData.monthlyComparison.medicalStaff?.previous}</td>
                  <td className="border border-gray-300 px-3 py-2">{analysisData.monthlyComparison.medicalStaff?.current}</td>
                  <td className="border border-gray-300 px-3 py-2">
                    <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${
                      analysisData.monthlyComparison.medicalStaff?.status === '개선' ? 'text-green-700 bg-green-100' : 'text-blue-700 bg-blue-100'
                    }`}>
                      {analysisData.monthlyComparison.medicalStaff?.status}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 font-medium">직원 서비스</td>
                  <td className="border border-gray-300 px-3 py-2">{analysisData.monthlyComparison.deskStaff?.previous}</td>
                  <td className="border border-gray-300 px-3 py-2">{analysisData.monthlyComparison.deskStaff?.current}</td>
                  <td className="border border-gray-300 px-3 py-2">
                    <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${
                      analysisData.monthlyComparison.deskStaff?.status === '개선' ? 'text-green-700 bg-green-100' : 'text-blue-700 bg-blue-100'
                    }`}>
                      {analysisData.monthlyComparison.deskStaff?.status}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 font-medium">시설 및 편의</td>
                  <td className="border border-gray-300 px-3 py-2">{analysisData.monthlyComparison.facilities?.previous}</td>
                  <td className="border border-gray-300 px-3 py-2">{analysisData.monthlyComparison.facilities?.current}</td>
                  <td className="border border-gray-300 px-3 py-2">
                    <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${
                      analysisData.monthlyComparison.facilities?.status === '개선' ? 'text-green-700 bg-green-100' : 'text-blue-700 bg-blue-100'
                    }`}>
                      {analysisData.monthlyComparison.facilities?.status}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* (1-4) 주요 개선 의견 */}
      {analysisData.improvementSuggestions && analysisData.improvementSuggestions.length > 0 && (
        <SectionCard
          title="(1-4) 주요 개선 의견"
          description="구체적인 개선 제안사항"
          icon={<Lightbulb className="w-5 h-5" />}
        >
          <div className="space-y-4">
            {analysisData.improvementSuggestions.map((suggestion: any, index: number) => (
              <div key={index} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="text-[14px] font-semibold text-orange-900 mb-1">{suggestion.category}</h5>
                    <p className="text-[13px] text-orange-800">{suggestion.suggestion}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* 2. 의료진별 의견 */}
      <SectionCard
        title="2. 의료진별 의견"
        description="실제 환자 피드백 분석"
        icon={<Users className="w-5 h-5" />}
      >
        <div className="space-y-6">
          {/* 의료진 1 */}
          {analysisData.staffFeedback?.doctor1 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="text-[15px] font-semibold text-[#191f28] mb-3">원장 (의료진 1)</h4>

              {analysisData.staffFeedback.doctor1.positive.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-[14px] font-medium text-green-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    긍정적 의견
                  </h5>
                  <div className="space-y-2">
                    {analysisData.staffFeedback.doctor1.positive.map((feedback: string, index: number) => (
                      <div key={index} className="bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
                        <p className="text-[13px] text-green-800">"{feedback}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysisData.staffFeedback.doctor1.negative.length > 0 ? (
                <div>
                  <h5 className="text-[14px] font-medium text-red-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    부정적 의견
                  </h5>
                  <div className="space-y-2">
                    {analysisData.staffFeedback.doctor1.negative.map((feedback: string, index: number) => (
                      <div key={index} className="bg-red-50 p-3 rounded-lg border-l-4 border-red-500">
                        <p className="text-[13px] text-red-800">"{feedback}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-[13px] text-[#8b95a1]">부정적 의견 없음</p>
                </div>
              )}
            </div>
          )}

          {/* 의료진 2 */}
          {analysisData.staffFeedback?.doctor2 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="text-[15px] font-semibold text-[#191f28] mb-3">원장 (의료진 2)</h4>

              {analysisData.staffFeedback.doctor2.positive.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-[14px] font-medium text-green-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    긍정적 의견
                  </h5>
                  <div className="space-y-2">
                    {analysisData.staffFeedback.doctor2.positive.map((feedback: string, index: number) => (
                      <div key={index} className="bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
                        <p className="text-[13px] text-green-800">"{feedback}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysisData.staffFeedback.doctor2.negative.length > 0 ? (
                <div>
                  <h5 className="text-[14px] font-medium text-red-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    부정적 의견
                  </h5>
                  <div className="space-y-2">
                    {analysisData.staffFeedback.doctor2.negative.map((feedback: string, index: number) => (
                      <div key={index} className="bg-red-50 p-3 rounded-lg border-l-4 border-red-500">
                        <p className="text-[13px] text-red-800">"{feedback}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-[13px] text-[#8b95a1]">부정적 의견 없음</p>
                </div>
              )}
            </div>
          )}

          {/* 데스크/진료실 직원 */}
          {analysisData.staffFeedback?.staff && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="text-[15px] font-semibold text-[#191f28] mb-3">데스크 / 진료실 (스탭)</h4>

              {analysisData.staffFeedback.staff.positive.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-[14px] font-medium text-green-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    긍정적 의견
                  </h5>
                  <div className="space-y-2">
                    {analysisData.staffFeedback.staff.positive.map((feedback: string, index: number) => (
                      <div key={index} className="bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
                        <p className="text-[13px] text-green-800">"{feedback}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysisData.staffFeedback.staff.negative.length > 0 ? (
                <div>
                  <h5 className="text-[14px] font-medium text-red-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    부정적 의견
                  </h5>
                  <div className="space-y-2">
                    {analysisData.staffFeedback.staff.negative.map((feedback: string, index: number) => (
                      <div key={index} className="bg-red-50 p-3 rounded-lg border-l-4 border-red-500">
                        <p className="text-[13px] text-red-800">"{feedback}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-[13px] text-[#8b95a1]">부정적 의견 없음</p>
                </div>
              )}
            </div>
          )}

          {/* 시설 및 편의 */}
          {analysisData.staffFeedback?.facilities && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="text-[15px] font-semibold text-[#191f28] mb-3">시설 및 편의 관련 의견</h4>

              {analysisData.staffFeedback.facilities.positive.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-[14px] font-medium text-green-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    긍정적 의견
                  </h5>
                  <div className="space-y-2">
                    {analysisData.staffFeedback.facilities.positive.map((feedback: string, index: number) => (
                      <div key={index} className="bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
                        <p className="text-[13px] text-green-800">"{feedback}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysisData.staffFeedback.facilities.negative.length > 0 && (
                <div>
                  <h5 className="text-[14px] font-medium text-red-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    개선 의견
                  </h5>
                  <div className="space-y-2">
                    {analysisData.staffFeedback.facilities.negative.map((feedback: string, index: number) => (
                      <div key={index} className="bg-red-50 p-3 rounded-lg border-l-4 border-red-500">
                        <p className="text-[13px] text-red-800">"{feedback}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* 생성 정보 */}
      <div className="bg-gray-50 rounded-xl p-4 text-[12px] text-[#6b7684]">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p><Calendar className="w-3 h-3 inline mr-1" />생성일시: {new Date(report.generatedAt).toLocaleString('ko-KR')}</p>
            <p><FileText className="w-3 h-3 inline mr-1" />보고서 ID: {report.id}</p>
          </div>
          <div className="text-right">
            <p><User className="w-3 h-3 inline mr-1" />생성자: {report.generatedBy}</p>
            <p><Building className="w-3 h-3 inline mr-1" />치과: {report.clinic.name}</p>
          </div>
        </div>
      </div>
    </div>
  )
}