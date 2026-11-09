"use client"

import { useRef } from "react"
import Link from "next/link"
import { ArrowLeft, Printer, Download, ExternalLink, AlertCircle } from "lucide-react"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"

type Report = {
  id: string; title: string; status: string; error: string | null; model: string | null
  periodStart: string; periodEnd: string; compareStart: string; compareEnd: string; createdAt: string
}

const dot = (s: string) => s.replace(/-/g, ".")

export default function ReportViewer({ clinicId, report }: { clinicId: string; report: Report }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const src = `/api/naver-ads/reports/${report.id}?format=html`
  const print = () => frame.current?.contentWindow?.print()

  return (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href={`/dashboard/${clinicId}/naver-ads`} className="inline-flex items-center gap-1 text-[13px] text-[#8b95a1] hover:text-[#191f28] mb-2"><ArrowLeft className="w-4 h-4" /> 네이버 검색광고</Link>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-[#191f28]">{report.title}</h1>
            {report.status === "DONE" ? <Badge variant="green">완료</Badge> : report.status === "FAILED" ? <Badge variant="red">실패</Badge> : <Badge variant="yellow">생성 중</Badge>}
          </div>
          <p className="text-[13px] text-[#6b7684] mt-1">
            보고 기간 {dot(report.periodStart)}~{dot(report.periodEnd)} · 비교 {dot(report.compareStart)}~{dot(report.compareEnd)}
            {report.model && <span className="text-[#8b95a1]"> · {report.model}</span>}
          </p>
        </div>
        {report.status === "DONE" && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" size="md" onClick={print}><Printer className="w-4 h-4" /> 인쇄 · PDF 저장</Button>
            <a href={`${src}&download=1`}><Button variant="secondary" size="md"><Download className="w-4 h-4" /> HTML 다운로드</Button></a>
            <a href={src} target="_blank" rel="noreferrer"><Button variant="ghost" size="md"><ExternalLink className="w-4 h-4" /> 새 창</Button></a>
          </div>
        )}
      </div>

      {report.status === "FAILED" && (
        <div className="flex items-center gap-2 text-[13px] rounded-xl px-4 py-3 bg-[#fff0f1] text-[#f04452]"><AlertCircle className="w-4 h-4" /> 생성 실패: {report.error}</div>
      )}

      {report.status === "DONE" && (
        <div className="bg-[#E9EDF2] rounded-2xl overflow-hidden">
          <iframe ref={frame} src={src} title={report.title} className="w-full border-0" style={{ height: "calc(100vh - 200px)", minHeight: 800 }} />
        </div>
      )}
    </div>
  )
}
