"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  FileText,
  Eye,
  Download,
  Search,
  Filter,
  Calendar,
  X,
  AlertCircle,
  Loader2
} from "lucide-react"

interface HtmlReport {
  id: string
  clinicId: string
  clinicName: string
  year: number
  month: number
  generatedAt: Date
  fileName: string
}

interface ReportHtmlManagerProps {
  clinicId: string
  onUploadSuccess?: () => void
}

export default function ReportHtmlManager({ clinicId, onUploadSuccess }: ReportHtmlManagerProps) {
  const { data: session } = useSession()

  // 상태
  const [reports, setReports] = useState<HtmlReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 미리보기 모달 상태
  const [previewReport, setPreviewReport] = useState<{
    id: string
    clinicName: string
    year: number
    month: number
    content: string
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // 필터 상태
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedYear, setSelectedYear] = useState<number | ''>('')
  const [selectedMonth, setSelectedMonth] = useState<number | ''>('')

  // 보고서 목록 불러오기
  const fetchReports = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/reports/list?clinicId=${clinicId}`)
      const data = await response.json()

      if (response.ok && data.success) {
        // HTML 보고서만 필터링 (content가 있는 것들)
        const htmlReports = data.reports.filter((report: any) => report.generatedAt)
        setReports(htmlReports)
      } else {
        throw new Error(data.error || '보고서를 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('보고서 목록 조회 실패:', error)
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 보고서 미리보기
  const handlePreview = async (reportId: string) => {
    try {
      setPreviewLoading(true)

      const response = await fetch(`/api/reports/html/${reportId}`)
      const data = await response.json()

      if (response.ok && data.success) {
        setPreviewReport({
          id: data.report.id,
          clinicName: data.report.clinicName,
          year: data.report.year,
          month: data.report.month,
          content: data.report.content
        })
      } else {
        throw new Error(data.error || '미리보기를 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('미리보기 실패:', error)
      alert(error instanceof Error ? error.message : '미리보기를 불러오는데 실패했습니다.')
    } finally {
      setPreviewLoading(false)
    }
  }

  // 보고서 다운로드
  const handleDownload = async (reportId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/reports/download/${reportId}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '다운로드에 실패했습니다.')
      }

      // 파일 다운로드
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('다운로드 실패:', error)
      alert(error instanceof Error ? error.message : '다운로드에 실패했습니다.')
    }
  }

  // 필터링된 보고서 목록
  const filteredReports = reports.filter(report => {
    const matchesSearch = report.fileName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesYear = selectedYear === '' || report.year === selectedYear
    const matchesMonth = selectedMonth === '' || report.month === selectedMonth

    return matchesSearch && matchesYear && matchesMonth
  })

  // 연도 옵션 생성
  const availableYears = [...new Set(reports.map(r => r.year))].sort((a, b) => b - a)

  useEffect(() => {
    fetchReports()
  }, [clinicId])

  useEffect(() => {
    if (onUploadSuccess) {
      fetchReports()
    }
  }, [onUploadSuccess])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#e5e8eb] p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#3182f6] animate-spin" />
          <span className="ml-3 text-[15px] text-[#8b95a1]">보고서 목록을 불러오는 중...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-[#e5e8eb] p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-[#ff6b6b] mx-auto mb-4" />
          <p className="text-[15px] font-semibold text-[#191f28]">{error}</p>
          <button
            onClick={fetchReports}
            className="mt-3 text-[13px] text-[#3182f6] hover:underline"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#e5e8eb] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-[#ebf3fe] rounded-xl flex items-center justify-center">
            <FileText className="w-4 h-4 text-[#3182f6]" />
          </div>
          <div>
            <h3 className="text-[16px] font-semibold text-[#191f28]">업로드된 HTML 보고서</h3>
            <p className="text-[13px] text-[#8b95a1]">업로드된 경영보고서를 확인하고 다운로드할 수 있습니다</p>
          </div>
        </div>

        {/* 검색 및 필터 - 모바일 개선 */}
        <div className="space-y-4 mb-6">
          {/* 검색 */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8b95a1]" />
            <input
              type="text"
              placeholder="보고서 제목으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-[#e5e8eb] rounded-lg text-[14px] focus:outline-none focus:border-[#3182f6]"
            />
          </div>

          {/* 필터 - 모바일에서 세로로 배치 */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Calendar className="w-4 h-4 text-[#8b95a1] flex-shrink-0" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="flex-1 px-3 py-2.5 border border-[#e5e8eb] rounded-lg text-[14px] focus:outline-none focus:border-[#3182f6]"
              >
                <option value="">모든 연도</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-1">
              <Filter className="w-4 h-4 text-[#8b95a1] flex-shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="flex-1 px-3 py-2.5 border border-[#e5e8eb] rounded-lg text-[14px] focus:outline-none focus:border-[#3182f6]"
              >
                <option value="">모든 월</option>
                {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
            </div>
          </div>

          {/* 필터 초기화 */}
          {(searchTerm || selectedYear || selectedMonth) && (
            <button
              onClick={() => {
                setSearchTerm('')
                setSelectedYear('')
                setSelectedMonth('')
              }}
              className="text-[13px] text-[#8b95a1] hover:text-[#3182f6] flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              필터 초기화
            </button>
          )}
        </div>

        {/* 보고서 목록 */}
        {filteredReports.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 bg-[#f2f4f6] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-[#b0b8c1]" />
            </div>
            {reports.length === 0 ? (
              <>
                <p className="text-[15px] font-semibold text-[#191f28]">업로드된 HTML 보고서가 없습니다</p>
                <p className="text-[13px] text-[#8b95a1] mt-1">위에서 새로운 보고서를 업로드해보세요</p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-[#191f28]">검색 조건에 맞는 보고서가 없습니다</p>
                <p className="text-[13px] text-[#8b95a1] mt-1">다른 검색어나 필터를 사용해보세요</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="p-4 rounded-xl bg-[#f9fafb] hover:bg-[#f2f4f6] transition-colors"
              >
                {/* 모바일에서 세로 배치, 데스크탑에서 가로 배치 */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#fff3cd] rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-[#f59e0b]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold text-[#191f28] truncate">
                        {report.year}년 {report.month}월 경영보고서
                      </div>
                      <div className="text-[12px] text-[#8b95a1]">
                        {new Date(report.generatedAt).toLocaleDateString("ko-KR")} 업로드
                      </div>
                    </div>
                  </div>

                  {/* 버튼들 - 모바일에서 전체 너비, 데스크탑에서 우측 정렬 */}
                  <div className="flex items-center gap-2 sm:flex-shrink-0">
                    {/* 미리보기 버튼 */}
                    <button
                      onClick={() => handlePreview(report.id)}
                      disabled={previewLoading}
                      className="flex items-center justify-center gap-1 px-3 py-2 text-[13px] text-[#3182f6] font-medium hover:underline bg-[#ebf3fe] rounded-lg disabled:opacity-50 flex-1 sm:flex-none min-h-[36px]"
                    >
                      {previewLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                      <span className="hidden sm:inline">미리보기</span>
                      <span className="sm:hidden">보기</span>
                    </button>

                    {/* 다운로드 버튼 */}
                    <button
                      onClick={() => handleDownload(report.id, report.fileName)}
                      className="flex items-center justify-center gap-1 px-3 py-2 text-[13px] text-[#10b981] font-medium hover:underline bg-[#ecfdf5] rounded-lg flex-1 sm:flex-none min-h-[36px]"
                    >
                      <Download className="w-3 h-3" />
                      <span className="hidden sm:inline">다운로드</span>
                      <span className="sm:hidden">저장</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 미리보기 모달 - 모바일 개선 */}
      {previewReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* 헤더 - 모바일에서 더 컴팩트하게 */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#e5e8eb] flex-shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] sm:text-[18px] font-semibold text-[#191f28] truncate">
                  📄 {previewReport.year}년 {previewReport.month}월 경영보고서
                </h2>
                <p className="text-[12px] sm:text-[13px] text-[#8b95a1] truncate">
                  {previewReport.clinicName}
                </p>
              </div>
              <button
                onClick={() => setPreviewReport(null)}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[#8b95a1] hover:text-[#191f28] hover:bg-[#f2f4f6] rounded-lg transition-colors flex-shrink-0 ml-3"
              >
                ✕
              </button>
            </div>

            {/* 미리보기 콘텐츠 */}
            <div className="flex-1 overflow-auto">
              <iframe
                srcDoc={previewReport.content}
                className="w-full h-full border-none"
                title="보고서 미리보기"
                sandbox="allow-same-origin allow-scripts"
                style={{ minHeight: '60vh' }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}