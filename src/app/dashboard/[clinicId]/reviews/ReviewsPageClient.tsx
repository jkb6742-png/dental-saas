"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import MonthlyReviewManager from "@/components/reviews/MonthlyReviewManager"
import ReviewDashboard from "@/components/reviews/ReviewDashboard"
import YearMonthFilter from "@/components/ui/YearMonthFilter"

interface ReviewsPageClientProps {
  clinicId: string
  userRole: string
  initialYear: number
  initialMonth: number
}

export default function ReviewsPageClient({
  clinicId,
  userRole,
  initialYear,
  initialMonth
}: ReviewsPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)

  const handleYearChange = (newYear: number) => {
    setYear(newYear)
    updateURL(newYear, month)
  }

  const handleMonthChange = (newMonth: number) => {
    setMonth(newMonth)
    updateURL(year, newMonth)
  }

  const updateURL = (year: number, month: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('year', year.toString())
    params.set('month', month.toString())
    router.push(`/dashboard/${clinicId}/reviews?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      {/* 기간 선택 */}
      <YearMonthFilter
        initialYear={year}
        initialMonth={month}
        onYearChange={handleYearChange}
        onMonthChange={handleMonthChange}
      />

      {/* 요약 대시보드 */}
      <Suspense fallback={<div className="text-center py-8">리뷰 데이터를 불러오는 중...</div>}>
        <ReviewDashboard
          clinicId={clinicId}
          year={year}
          month={month}
        />
      </Suspense>

      {/* 월별 관리 */}
      <Suspense fallback={<div className="text-center py-8">설정을 불러오는 중...</div>}>
        <MonthlyReviewManager clinicId={clinicId} userRole={userRole} />
      </Suspense>
    </div>
  )
}