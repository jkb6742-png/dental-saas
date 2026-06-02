"use client"

import { useState } from "react"
import SectionCard from "@/components/ui/SectionCard"
import ReportGenerator from "@/components/ReportGenerator"
import { FileText } from "lucide-react"

interface Report {
  id: string
  year: number
  month: number
  content: string | null
  pdfUrl: string | null
  generatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface ReportsClientProps {
  clinicId: string
  initialReports: Report[]
}

export default function ReportsClient({ clinicId, initialReports }: ReportsClientProps) {
  const [reports, setReports] = useState<Report[]>(initialReports)

  const handleReportGenerated = async () => {
    // 리포트가 생성된 후 목록을 다시 불러옵니다
    try {
      const response = await fetch(`/api/reports?clinicId=${clinicId}`)
      if (response.ok) {
        const updatedReports = await response.json()
        setReports(updatedReports)
      }
    } catch (error) {
      console.error("Failed to refresh reports:", error)
      // 페이지를 새로고침합니다
      window.location.reload()
    }
  }

  return (
    <div className="space-y-6">
      {/* 리포트 생성 섹션 */}
      <ReportGenerator clinicId={clinicId} onReportGenerated={handleReportGenerated} />

      {/* 기존 리포트 목록 */}
      <SectionCard title="월간 분석 리포트" description="AI가 자동 생성하는 경영 인사이트">
        {reports.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 bg-[#f2f4f6] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-[#b0b8c1]" />
            </div>
            <p className="text-[15px] font-semibold text-[#191f28]">아직 리포트가 없습니다</p>
            <p className="text-[13px] text-[#8b95a1] mt-1">위에서 새로운 리포트를 생성해보세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4 rounded-xl bg-[#f9fafb] hover:bg-[#f2f4f6] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#ebf3fe] rounded-xl flex items-center justify-center">
                    <FileText className="w-4 h-4 text-[#3182f6]" />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-[#191f28]">{r.year}년 {r.month}월 경영 리포트</div>
                    <div className="text-[12px] text-[#8b95a1]">
                      {r.generatedAt ? new Date(r.generatedAt).toLocaleDateString("ko-KR") + " 생성" : "생성 중"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.content && (
                    <ReportViewButton reportId={r.id} content={r.content} year={r.year} month={r.month} />
                  )}
                  {r.pdfUrl && (
                    <a
                      href={r.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-[#3182f6] font-medium hover:underline px-3 py-1 bg-[#ebf3fe] rounded-lg"
                    >
                      PDF 다운로드
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

interface ReportViewButtonProps {
  reportId: string
  content: string
  year: number
  month: number
}

function ReportViewButton({ reportId, content, year, month }: ReportViewButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="text-[13px] text-[#3182f6] font-medium hover:underline px-3 py-1 bg-[#ebf3fe] rounded-lg"
      >
        리포트 보기
      </button>

      {/* 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[#e5e8eb]">
              <h2 className="text-[18px] font-semibold text-[#191f28]">
                {year}년 {month}월 경영 리포트
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-[#8b95a1] hover:text-[#191f28] hover:bg-[#f2f4f6] rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-[#191f28]">
                  {content}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}