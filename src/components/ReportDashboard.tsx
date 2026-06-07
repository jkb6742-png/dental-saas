"use client"

import { useState } from "react"
import ReportHtmlUpload from "@/components/ReportHtmlUpload"
import ReportHtmlManager from "@/components/ReportHtmlManager"
import ReportManager from "@/components/ReportManager"

interface ReportDashboardProps {
  clinicId: string
}

export default function ReportDashboard({ clinicId }: ReportDashboardProps) {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleReportUploaded = () => {
    // 보고서 업로드 후 목록 새로고침
    setRefreshKey(prev => prev + 1)
  }

  const handleReportDeleted = () => {
    // 보고서 삭제 후 목록 새로고침
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="space-y-6">
      {/* HTML 리포트 업로드 */}
      <ReportHtmlUpload
        clinicId={clinicId}
        onUploadSuccess={handleReportUploaded}
      />

      {/* HTML 보고서 관리 (미리보기 & 다운로드) */}
      <ReportHtmlManager
        key={refreshKey}
        clinicId={clinicId}
        onUploadSuccess={() => setRefreshKey(prev => prev + 1)}
      />

      {/* AI 생성 리포트 관리 */}
      <ReportManager
        key={`report-manager-${refreshKey}`}
        clinicId={clinicId}
        onReportDeleted={handleReportDeleted}
      />
    </div>
  )
}