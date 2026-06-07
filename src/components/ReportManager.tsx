"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { FileText, Trash2, AlertCircle, RefreshCcw, Download } from "lucide-react"

interface Report {
  id: string
  clinicId: string
  clinicName: string
  year: number
  month: number
  totalRevenue?: number
  workingDays?: number
  generatedAt: string
  fileName: string
  filePath: string
}

interface ReportManagerProps {
  clinicId: string
  onReportDeleted?: () => void
}

export default function ReportManager({ clinicId, onReportDeleted }: ReportManagerProps) {
  const { data: session, status } = useSession()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [showConfirm, setShowConfirm] = useState<string | null>(null)

  // 보고서 목록 조회
  const fetchReports = async () => {
    if (status !== "authenticated") return

    setLoading(true)
    try {
      const response = await fetch(`/api/reports/list?clinicId=${clinicId}`)
      const result = await response.json()

      if (response.ok) {
        setReports(result.reports)
      } else {
        if (response.status === 401) {
          setMessage("세션이 만료되었습니다. 다시 로그인해주세요.")
          setTimeout(() => {
            window.location.href = "/login"
          }, 3000)
        } else {
          setMessage(result.error || "보고서 목록을 불러오는데 실패했습니다.")
        }
      }
    } catch (error) {
      setMessage("네트워크 오류가 발생했습니다.")
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  // 보고서 삭제
  const handleDelete = async (reportId: string, filePath: string) => {
    setDeletingId(reportId)
    setMessage("")

    try {
      const response = await fetch("/api/reports/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportId,
          filePath,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setMessage("보고서가 성공적으로 삭제되었습니다!")
        setReports(prev => prev.filter(report => report.id !== reportId))
        onReportDeleted?.()
      } else {
        if (response.status === 401) {
          setMessage("세션이 만료되었습니다. 다시 로그인해주세요.")
          setTimeout(() => {
            window.location.href = "/login"
          }, 3000)
        } else {
          setMessage(result.error || "보고서 삭제에 실패했습니다.")
        }
      }
    } catch (error) {
      setMessage("네트워크 오류가 발생했습니다.")
      console.error("Error:", error)
    } finally {
      setDeletingId(null)
      setShowConfirm(null)
    }
  }

  // 컴포넌트 마운트 시 보고서 목록 조회
  useEffect(() => {
    fetchReports()
  }, [status, clinicId])

  // 인증되지 않은 경우
  if (status === "unauthenticated") {
    return (
      <div className="bg-white rounded-2xl border border-[#e5e8eb] p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-[#ff6b6b] mx-auto mb-4" />
          <p className="text-[#191f28] font-medium">로그인이 필요합니다</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e5e8eb] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#ebf3fe] rounded-xl flex items-center justify-center">
            <FileText className="w-4 h-4 text-[#3182f6]" />
          </div>
          <div>
            <h3 className="text-[16px] font-semibold text-[#191f28]">보고서 관리</h3>
            <p className="text-[13px] text-[#8b95a1]">생성된 월간 경영 보고서를 관리합니다</p>
          </div>
        </div>
        <button
          onClick={fetchReports}
          disabled={loading}
          className="bg-[#f8f9fa] hover:bg-[#e9ecef] text-[#191f28] text-[13px] font-medium rounded-lg h-9 px-3 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {loading && reports.length === 0 ? (
        <div className="text-center py-8">
          <RefreshCcw className="w-6 h-6 animate-spin text-[#8b95a1] mx-auto mb-2" />
          <p className="text-[#8b95a1] text-[14px]">보고서 목록을 불러오는 중...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-[#8b95a1] mx-auto mb-4" />
          <p className="text-[#191f28] font-medium mb-2">생성된 보고서가 없습니다</p>
          <p className="text-[#8b95a1] text-[13px]">새 리포트를 생성해보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="border border-[#e5e8eb] rounded-xl p-4 hover:bg-[#f8f9fa] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-4 h-4 text-[#3182f6]" />
                    <h4 className="text-[14px] font-medium text-[#191f28]">
                      {report.year}년 {report.month}월 보고서
                    </h4>
                    <span className="bg-[#e8f5e8] text-[#2d7a2d] text-[11px] px-2 py-1 rounded-full">
                      HTML
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-[12px] text-[#8b95a1] mb-2">
                    <div>
                      📅 생성일: {new Date(report.generatedAt).toLocaleDateString('ko-KR')}
                    </div>
                    <div>
                      💰 매출: {report.totalRevenue ? `${report.totalRevenue.toLocaleString()}원` : 'N/A'}
                    </div>
                  </div>
                  <div className="text-[11px] text-[#6c757d] font-mono">
                    📁 {report.fileName}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => setShowConfirm(report.id)}
                    disabled={deletingId === report.id}
                    className="bg-[#fff5f5] hover:bg-[#fed7d7] text-[#dc2626] text-[12px] font-medium rounded-lg h-8 px-3 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deletingId === report.id ? (
                      <RefreshCcw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    삭제
                  </button>
                </div>
              </div>

              {/* 삭제 확인 다이얼로그 */}
              {showConfirm === report.id && (
                <div className="mt-4 p-3 bg-[#fff5f5] border border-[#fed7d7] rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-[#dc2626]" />
                    <p className="text-[#dc2626] text-[13px] font-medium">
                      정말로 이 보고서를 삭제하시겠습니까?
                    </p>
                  </div>
                  <p className="text-[#8b95a1] text-[11px] mb-3">
                    삭제된 보고서는 복구할 수 없습니다. (파일과 데이터베이스에서 모두 삭제됩니다)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(report.id, report.filePath)}
                      disabled={deletingId === report.id}
                      className="bg-[#dc2626] hover:bg-[#b91c1c] text-white text-[11px] font-medium rounded-lg h-7 px-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      삭제 확인
                    </button>
                    <button
                      onClick={() => setShowConfirm(null)}
                      disabled={deletingId === report.id}
                      className="bg-[#f8f9fa] hover:bg-[#e9ecef] text-[#191f28] text-[11px] font-medium rounded-lg h-7 px-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 메시지 표시 */}
      {message && (
        <div className={`mt-4 p-3 rounded-lg text-[13px] ${
          message.includes("성공")
            ? "bg-[#e8f5e8] text-[#2d7a2d] border border-[#c3e6c3]"
            : "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]"
        }`}>
          {message}
        </div>
      )}
    </div>
  )
}