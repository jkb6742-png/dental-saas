"use client"

import { useState, useEffect } from "react"
import MonthlyReviewManager from "./MonthlyReviewManager"
import ReviewDashboardReadOnly from "./ReviewDashboardReadOnly"

interface ReviewSetupProps {
  clinicId: string
  userRole: string
  onConfigSaved?: () => void
}

export default function ReviewSetup({ clinicId, userRole, onConfigSaved }: ReviewSetupProps) {
  // 마스터 계정이면 관리 화면, 아니면 조회 화면
  if (userRole === 'MASTER') {
    return <MonthlyReviewManager clinicId={clinicId} userRole={userRole} />
  }

  return <ReviewDashboardReadOnly clinicId={clinicId} />
}