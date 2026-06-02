"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import SectionCard from "@/components/ui/SectionCard"
import Button from "@/components/ui/Button"
import ReportViewer from "./ReportViewer"
import {
  FileText,
  Download,
  Calendar,
  BarChart3,
  TrendingUp,
  Users,
  ClipboardCheck,
  Settings,
  Plus,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Eye
} from "lucide-react"

interface PEIClientProps {
  clinicId: string
}

interface SheetConfig {
  id: string
  sheetUrl: string
  sheetId: string
  sheetName: string
  isActive: boolean
  lastSyncAt: string
  createdAt: string
  createdBy: string
  clinicName: string
}

interface PEIData {
  summary: {
    totalRecords: number
    peiScore: number
    avgSatisfaction: number
    avgServiceScore: number
    avgFacilityScore: number
    avgRevisitIntention: number
  }
  metadata: {
    clinicName: string
    lastSyncAt: string
    totalRows: number
    validRecords: number
  }
}

export default function PEIClient({ clinicId }: PEIClientProps) {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role
  const isMaster = userRole === 'MASTER'

  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  // 시트 설정 관련 상태
  const [sheetConfig, setSheetConfig] = useState<SheetConfig | null>(null)
  const [hasConfig, setHasConfig] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showSetupForm, setShowSetupForm] = useState(false)

  // 폼 상태
  const [sheetUrl, setSheetUrl] = useState("")
  const [sheetName, setSheetName] = useState("Sheet1")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null)

  // 데이터 상태
  const [peiData, setPeiData] = useState<PEIData | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)

  // 보고서 목록 상태
  const [reports, setReports] = useState<any[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(false)

  // 보고서 뷰어 상태
  const [viewingReport, setViewingReport] = useState<string | null>(null)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  // 초기 로드: 시트 설정 확인
  useEffect(() => {
    loadSheetConfig()
    loadReports()
  }, [clinicId])


  const loadSheetConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/pei/sheets?clinicId=${clinicId}`)
      const data = await response.json()

      if (data.hasConfig) {
        setSheetConfig(data.config)
        setHasConfig(true)
        // 설정이 있으면 데이터도 미리 로드
        loadPEIData()
      } else {
        setHasConfig(false)
      }
    } catch (error) {
      console.error("시트 설정 로드 실패:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadPEIData = async () => {
    if (!hasConfig) return

    try {
      setIsLoadingData(true)
      const response = await fetch(`/api/pei/data?clinicId=${clinicId}`)
      const data = await response.json()

      if (data.success) {
        setPeiData(data.data)
      }
    } catch (error) {
      console.error("PEI 데이터 로드 실패:", error)
    } finally {
      setIsLoadingData(false)
    }
  }

  const loadReports = async () => {
    try {
      setIsLoadingReports(true)
      const response = await fetch(`/api/pei/reports?clinicId=${clinicId}`)
      const data = await response.json()

      if (data.success) {
        setReports(data.reports)
      } else {
        setReports([])
      }
    } catch (error) {
      console.error("보고서 목록 로드 실패:", error)
      setReports([])
    } finally {
      setIsLoadingReports(false)
    }
  }

  const handleTestConnection = async () => {
    if (!sheetUrl) {
      setConnectionStatus({ success: false, message: "시트 URL을 입력해주세요" })
      return
    }

    try {
      setIsTestingConnection(true)
      setConnectionStatus(null)

      const response = await fetch(`/api/pei/data?clinicId=${clinicId}&test=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl })
      })

      const data = await response.json()
      setConnectionStatus({
        success: data.success,
        message: data.message
      })
    } catch (error) {
      setConnectionStatus({
        success: false,
        message: "연결 테스트 중 오류가 발생했습니다"
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleSaveSheetConfig = async () => {
    if (!sheetUrl) return

    try {
      setIsSubmitting(true)
      const response = await fetch('/api/pei/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          sheetUrl,
          sheetName: sheetName || 'Sheet1'
        })
      })

      const data = await response.json()

      if (data.success) {
        setSheetConfig(data.config)
        setHasConfig(true)
        setShowSetupForm(false)
        setSheetUrl("")
        setSheetName("Sheet1")
        setConnectionStatus(null)
        // 설정 완료 후 데이터 로드
        loadPEIData()
      } else {
        setConnectionStatus({
          success: false,
          message: data.error || "설정 저장에 실패했습니다"
        })
      }
    } catch (error) {
      setConnectionStatus({
        success: false,
        message: "설정 저장 중 오류가 발생했습니다"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfig = async () => {
    if (!confirm("구글 시트 연동 설정을 삭제하시겠습니까?")) return

    try {
      const response = await fetch(`/api/pei/sheets?clinicId=${clinicId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSheetConfig(null)
        setHasConfig(false)
        setPeiData(null)
      }
    } catch (error) {
      console.error("설정 삭제 실패:", error)
    }
  }

  const handleDeleteReport = async (reportId: string, reportTitle: string) => {
    if (!confirm(`"${reportTitle}" 보고서를 삭제하시겠습니까?\n\n삭제된 보고서는 복구할 수 없습니다.`)) {
      return
    }

    try {
      const response = await fetch('/api/pei/reports', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId })
      })

      const data = await response.json()
      if (data.success) {
        // 보고서 목록 새로고침
        loadReports()
        alert("보고서가 삭제되었습니다.")
      } else {
        throw new Error(data.error || "삭제에 실패했습니다")
      }
    } catch (error: any) {
      console.error("보고서 삭제 실패:", error)
      alert(`보고서 삭제 중 오류가 발생했습니다: ${error.message}`)
    }
  }

  const handleExportHTML = async (reportId: string, reportTitle: string) => {
    try {
      // HTML 생성 API 호출
      const response = await fetch(`/api/pei/html?reportId=${reportId}`)
      if (!response.ok) {
        throw new Error("HTML 생성에 실패했습니다")
      }

      // HTML 내용을 새 창에서 열기
      const htmlContent = await response.text()
      const newWindow = window.open('', '_blank')
      if (newWindow) {
        newWindow.document.write(htmlContent)
        newWindow.document.close()
      } else {
        alert("팝업이 차단되었습니다. 팝업 차단을 해제하고 다시 시도해주세요.")
      }
    } catch (error: any) {
      console.error("HTML 출력 실패:", error)
      alert(`HTML 출력 중 오류가 발생했습니다: ${error.message}`)
    }
  }

  const handleGenerateReport = async () => {
    if (!hasConfig) {
      alert("먼저 구글 시트를 연동해주세요.")
      return
    }

    setIsGenerating(true)
    try {
      // 1단계: PEI 분석 수행
      console.log("🔍 PEI 분석 시작...")
      const analyzeResponse = await fetch('/api/pei/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          year: selectedYear,
          month: selectedMonth,
          forceAnalysis: true
        })
      })

      const analyzeData = await analyzeResponse.json()
      if (!analyzeData.success) {
        throw new Error(analyzeData.error || "분석에 실패했습니다")
      }

      console.log("✅ 분석 완료:", analyzeData.reportId)

      // 2단계: 보고서 생성
      console.log("📄 보고서 생성 시작...")
      const generateResponse = await fetch('/api/pei/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          year: selectedYear,
          month: selectedMonth,
          reportType: 'standard'
        })
      })

      const generateData = await generateResponse.json()
      if (!generateData.success) {
        throw new Error(generateData.error || "보고서 생성에 실패했습니다")
      }

      console.log("✅ 보고서 생성 완료")

      // 보고서 목록 새로고침
      loadReports()

      // 성공 알림
      alert("PEI 보고서가 성공적으로 생성되었습니다!")

    } catch (error: any) {
      console.error("보고서 생성 실패:", error)
      alert(`보고서 생성 중 오류가 발생했습니다: ${error.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  // 보고서 보기 상태
  if (viewingReport) {
    return (
      <ReportViewer
        reportId={viewingReport}
        onBack={() => setViewingReport(null)}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#3182f6]" />
        <span className="ml-2 text-[#8b95a1]">설정을 불러오는 중...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-[#191f28]">PEI 통계</h1>
          <p className="text-[14px] text-[#8b95a1] mt-1">
            환자경험평가 지표 분석 및 보고서 생성
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {!isMaster && (
            <p className="text-[12px] text-[#8b95a1]">
              💡 보고서 생성은 MASTER 권한이 필요합니다 (현재: {userRole || '권한없음'})
            </p>
          )}
          {isMaster && !hasConfig && (
            <p className="text-[12px] text-[#8b95a1]">
              💡 먼저 구글 시트를 연동해주세요
            </p>
          )}
          {isMaster && (
            <Button
              variant="primary"
              onClick={handleGenerateReport}
              loading={isGenerating}
              disabled={!hasConfig || isGenerating}
            >
              <Plus className="w-4 h-4" />
              새 보고서 생성
            </Button>
          )}
        </div>
      </div>

      {/* 설정 카드 - 마스터만 표시 */}
      {isMaster && (
        <SectionCard
          title="구글 스프레드시트 연동"
          description="PEI 데이터 수집을 위한 스프레드시트 설정"
          icon={<Settings className="w-5 h-5" />}
        >
        <div className="space-y-4">
          {hasConfig && sheetConfig ? (
            // 기존 설정 표시
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[14px] font-medium text-green-900">
                      연동 완료
                    </p>
                    <p className="text-[13px] text-green-700 mt-1">
                      {sheetConfig.clinicName} - {sheetConfig.sheetName}
                    </p>
                    <p className="text-[12px] text-green-600 mt-1">
                      마지막 동기화: {new Date(sheetConfig.lastSyncAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(sheetConfig.sheetUrl, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadPEIData}
                    loading={isLoadingData}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteConfig}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : showSetupForm ? (
            // 설정 폼
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#4e5968] mb-2">
                    구글 스프레드시트 URL *
                  </label>
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-3 py-2 rounded-lg border border-[#e5e8eb] text-[14px]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#4e5968] mb-2">
                    시트 이름 (선택사항)
                  </label>
                  <input
                    type="text"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    placeholder="Sheet1"
                    className="w-full px-3 py-2 rounded-lg border border-[#e5e8eb] text-[14px]"
                  />
                </div>

                {connectionStatus && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${
                    connectionStatus.success
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {connectionStatus.success ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    <span className="text-[13px]">{connectionStatus.message}</span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleTestConnection}
                    loading={isTestingConnection}
                    disabled={!sheetUrl}
                  >
                    <Eye className="w-4 h-4" />
                    연결 테스트
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSaveSheetConfig}
                    loading={isSubmitting}
                    disabled={!sheetUrl || !connectionStatus?.success}
                  >
                    <CheckCircle className="w-4 h-4" />
                    저장
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowSetupForm(false)
                      setSheetUrl("")
                      setConnectionStatus(null)
                    }}
                  >
                    취소
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // 설정 없음
            <div className="bg-[#f9fafb] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-medium text-[#191f28]">스프레드시트 URL</p>
                  <p className="text-[13px] text-[#8b95a1] mt-1">
                    연동된 시트가 없습니다
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowSetupForm(true)}
                >
                  <ExternalLink className="w-4 h-4" />
                  연동 설정
                </Button>
              </div>
            </div>
          )}

          {/* PEI 데이터 미리보기 */}
          {hasConfig && peiData && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 border border-green-200">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <p className="text-[20px] font-bold text-[#191f28]">
                    {peiData.summary.peiScore}
                  </p>
                  <p className="text-[12px] text-[#6b7684]">전체 PEI 점수</p>
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-semibold text-[#191f28]">
                    {peiData.summary.avgSatisfaction}
                  </p>
                  <p className="text-[12px] text-[#6b7684]">만족도</p>
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-semibold text-[#191f28]">
                    {peiData.summary.avgServiceScore}
                  </p>
                  <p className="text-[12px] text-[#6b7684]">서비스 점수</p>
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-semibold text-[#191f28]">
                    {peiData.summary.avgFacilityScore}
                  </p>
                  <p className="text-[12px] text-[#6b7684]">시설 점수</p>
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-semibold text-[#191f28]">
                    {peiData.summary.totalRecords}
                  </p>
                  <p className="text-[12px] text-[#6b7684]">총 응답수</p>
                </div>
              </div>
              <p className="text-[11px] text-[#8b95a1] mt-3 text-center">
                마지막 업데이트: {new Date(peiData.metadata.lastSyncAt).toLocaleString('ko-KR')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px] text-[#6b7684]">
            <div className="space-y-2">
              <p className="font-medium text-[#4e5968]">📋 필요한 데이터</p>
              <ul className="space-y-1">
                <li>• 환자 만족도 설문 결과</li>
                <li>• 진료 대기시간 데이터</li>
                <li>• 시설 및 서비스 평가</li>
                <li>• 재방문 의향 조사</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-[#4e5968]">🔄 자동 분석 항목</p>
              <ul className="space-y-1">
                <li>• 월별 PEI 점수 추이</li>
                <li>• 영역별 상세 분석</li>
                <li>• 개선 포인트 제안</li>
                <li>• 경쟁력 벤치마킹</li>
              </ul>
            </div>
          </div>
        </div>
      </SectionCard>
      )}

      {/* 일반 사용자 안내 */}
      {!isMaster && (
        <SectionCard
          title="PEI 보고서 조회"
          description="생성된 PEI 분석 보고서를 조회할 수 있습니다"
          icon={<FileText className="w-5 h-5" />}
        >
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <p className="text-[14px] font-medium text-blue-900">
                일반 사용자 모드
              </p>
            </div>
            <p className="text-[13px] text-blue-700">
              보고서 생성은 마스터 계정에서만 가능합니다.<br/>
              생성된 보고서는 아래 목록에서 확인하실 수 있습니다.
            </p>
          </div>
        </SectionCard>
      )}

      {/* 보고서 생성 카드 - 마스터만 표시 */}
      {isMaster && (
        <SectionCard
          title="보고서 생성"
          description="원하는 기간의 PEI 분석 보고서를 자동 생성합니다"
          icon={<FileText className="w-5 h-5" />}
        >
        <div className="space-y-4">
          {!hasConfig && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
              <div>
                <p className="text-[14px] font-medium text-yellow-900">
                  구글 시트 연동이 필요합니다
                </p>
                <p className="text-[13px] text-yellow-700 mt-1">
                  보고서를 생성하기 전에 먼저 구글 스프레드시트를 연동해주세요.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[#4e5968] mb-1">
                연도
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-[#e5e8eb] text-[14px] bg-white min-w-[100px]"
                disabled={!hasConfig}
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#4e5968] mb-1">
                월
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-[#e5e8eb] text-[14px] bg-white min-w-[80px]"
                disabled={!hasConfig}
              >
                {months.map(month => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h4 className="text-[15px] font-semibold text-[#191f28]">
                  AI 분석 보고서
                </h4>
                <p className="text-[13px] text-[#6b7684]">
                  선택하신 기간의 스프레드시트 데이터를 분석하여<br/>
                  인사이트와 개선 방안이 포함된 보고서를 생성합니다.
                </p>
                <div className="flex items-center gap-4 text-[12px] text-[#8b95a1]">
                  <span>📊 데이터 분석</span>
                  <span>🤖 GPT 인사이트</span>
                  <span>📄 HTML 출력</span>
                </div>
              </div>
              <Button
                variant="primary"
                onClick={handleGenerateReport}
                loading={isGenerating}
                disabled={!hasConfig || isGenerating}
              >
                {isGenerating ? "생성 중..." : "생성하기"}
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>
      )}

      {/* 최근 보고서 */}
      <SectionCard
        title="최근 PEI 보고서"
        description="생성된 보고서 목록"
        icon={<BarChart3 className="w-5 h-5" />}
      >
        {isLoadingReports ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[#3182f6]" />
            <span className="ml-2 text-[#8b95a1]">보고서 목록을 불러오는 중...</span>
          </div>
        ) : reports.length > 0 ? (
          <div className="space-y-4">
            {reports.map((report, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-[#f9fafb] rounded-xl">
                <div>
                  <p className="text-[14px] font-medium text-[#191f28]">
                    {report.period} PEI 보고서
                  </p>
                  <p className="text-[13px] text-[#8b95a1] mt-1">
                    PEI 점수: {report.peiScore}/5.0 • 생성일: {report.generatedAt}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewingReport(report.id)}
                    title="보고서 보기"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleExportHTML(report.id, report.title)}
                    title="HTML로 출력하기"
                  >
                    <Download className="w-4 h-4" />
                    출력
                  </Button>
                  {isMaster && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteReport(report.id, report.title)}
                      title="보고서 삭제"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <ClipboardCheck className="w-12 h-12 text-[#e5e8eb] mx-auto mb-4" />
            <p className="text-[14px] text-[#8b95a1] mb-2">
              아직 생성된 PEI 보고서가 없습니다
            </p>
            <p className="text-[13px] text-[#b0b8c1]">
              구글 스프레드시트를 연동하고 첫 번째 보고서를 생성해보세요
            </p>
          </div>
        )}
      </SectionCard>

      {/* 도움말 */}
      <div className="bg-[#f9fafb] rounded-xl p-4 text-[13px] text-[#6b7684] leading-relaxed">
        <p className="font-semibold text-[#4e5968] mb-2">💡 PEI 통계 사용 방법</p>
        <div className="space-y-1">
          <p>① <strong>구글 스프레드시트</strong>에 환자경험평가 데이터 입력</p>
          <p>② <strong>연동 설정</strong>에서 스프레드시트 URL 등록</p>
          <p>③ 원하는 <strong>기간 선택</strong> 후 보고서 생성 버튼 클릭</p>
          <p>④ AI가 데이터를 분석하여 <strong>인사이트와 개선방안</strong>이 포함된 보고서 자동 생성</p>
          <p>⑤ 생성된 <strong>HTML 보고서</strong> 출력 및 공유</p>
        </div>
      </div>
    </div>
  )
}