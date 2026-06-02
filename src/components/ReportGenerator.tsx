"use client"

import { useState } from "react"
import Button from "@/components/ui/Button"
import { FileText, Loader2, Calendar } from "lucide-react"

interface ReportGeneratorProps {
  clinicId: string
  onReportGenerated: () => void
}

export default function ReportGenerator({ clinicId, onReportGenerated }: ReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [message, setMessage] = useState("")

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i)
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}월`
  }))

  const handleGenerate = async () => {
    setIsGenerating(true)
    setMessage("")

    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clinicId,
          year: selectedYear,
          month: selectedMonth,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setMessage("리포트가 성공적으로 생성되었습니다!")
        onReportGenerated()
      } else {
        setMessage(result.error || "리포트 생성에 실패했습니다.")
      }
    } catch (error) {
      setMessage("네트워크 오류가 발생했습니다.")
      console.error("Error:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e5e8eb] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-[#ebf3fe] rounded-xl flex items-center justify-center">
          <FileText className="w-4 h-4 text-[#3182f6]" />
        </div>
        <div>
          <h3 className="text-[16px] font-semibold text-[#191f28]">새 리포트 생성</h3>
          <p className="text-[13px] text-[#8b95a1]">AI가 분석한 월간 경영 인사이트를 생성합니다</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-[#8b95a1]" />
          <div className="flex gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-[#e5e8eb] rounded-lg text-[14px] bg-white focus:border-[#3182f6] focus:outline-none"
              disabled={isGenerating}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-[#e5e8eb] rounded-lg text-[14px] bg-white focus:border-[#3182f6] focus:outline-none"
              disabled={isGenerating}
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-[#3182f6] hover:bg-[#2563eb] text-white text-[14px] font-medium rounded-xl h-11 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              리포트 생성 중...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              {selectedYear}년 {selectedMonth}월 리포트 생성
            </>
          )}
        </Button>

        {message && (
          <div className={`p-3 rounded-lg text-[13px] ${
            message.includes("성공")
              ? "bg-[#e8f5e8] text-[#2d7a2d] border border-[#c3e6c3]"
              : "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]"
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}