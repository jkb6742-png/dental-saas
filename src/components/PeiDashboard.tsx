"use client"

import { useState } from "react"
import PeiHtmlUpload from "@/components/PeiHtmlUpload"
import PeiHtmlManager from "@/components/PeiHtmlManager"

interface PeiDashboardProps {
  clinicId: string
}

export default function PeiDashboard({ clinicId }: PeiDashboardProps) {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleReportUploaded = () => {
    // PEI 리포트 업로드 후 목록 새로고침
    setRefreshKey(prev => prev + 1)
  }

  const handleReportDeleted = () => {
    // PEI 리포트 삭제 후 목록 새로고침
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="space-y-6">
      {/* PEI HTML 리포트 업로드 */}
      <PeiHtmlUpload
        clinicId={clinicId}
        onUploadSuccess={handleReportUploaded}
      />

      {/* PEI 리포트 관리 (미리보기 & 다운로드) */}
      <PeiHtmlManager
        key={refreshKey}
        clinicId={clinicId}
        onUploadSuccess={() => setRefreshKey(prev => prev + 1)}
      />
    </div>
  )
}