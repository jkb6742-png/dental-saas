export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import MonthlyReviewManager from "@/components/reviews/MonthlyReviewManager"
import ReviewDashboard from "@/components/reviews/ReviewDashboard"
import YearMonthFilter from "@/components/ui/YearMonthFilter"
import { MessageCircle, Settings } from "lucide-react"
import ReviewsPageClient from "./ReviewsPageClient"

export default async function ReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string }>
  searchParams: Promise<{ year?: string; month?: string; tab?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { clinicId } = await params
  const sp = await searchParams

  // 사용자 권한 조회
  const user = await prisma.user.findUnique({
    where: { email: session.user?.email || "" },
    select: { role: true }
  })

  const userRole = user?.role || "VIEWER"

  const now = new Date()

  // 기본값을 전달로 설정 (월초에 전달 지표를 정리하므로)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const defaultYear = lastMonth.getFullYear()
  const defaultMonth = lastMonth.getMonth() + 1

  const year = sp.year ? parseInt(sp.year) : defaultYear
  const month = sp.month ? parseInt(sp.month) : defaultMonth

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="border-b border-[#e5e8eb] pb-6">
        <div className="flex items-center space-x-3 mb-2">
          <MessageCircle className="w-8 h-8 text-blue-600" />
          <h1 className="text-[28px] font-bold text-[#191f28]">온라인 리뷰 관리</h1>
        </div>
        <p className="text-[16px] text-[#6b7280]">
          네이버, 구글 리뷰를 수집하고 월별 현황을 관리합니다
        </p>
      </div>

      {/* 메인 컨텐츠 */}
      <ReviewsPageClient
        clinicId={clinicId}
        userRole={userRole}
        initialYear={year}
        initialMonth={month}
      />

      {/* 도움말 섹션 - 조회 계정에서는 숨김 */}
      {userRole !== 'VIEWER' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">리뷰 관리 가이드</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
            <div>
              <h4 className="font-medium mb-2">📝 수동 입력</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>네이버/구글 리뷰 카드의 "입력" 버튼 클릭</li>
                <li>월별 리뷰 수와 평점을 직접 입력</li>
                <li>개선사항 피드백 별도 관리</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">🔄 자동 수집</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>구글: Place ID 설정 후 "자동수집" 버튼</li>
                <li>월별 목표 설정 및 달성률 추적</li>
                <li>정기적인 데이터 업데이트</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">📊 분석 활용</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>월별 리뷰 증감 추이 분석</li>
                <li>플랫폼별 평점 비교</li>
                <li>부정 피드백 개선사항 도출</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">🎯 목표 관리</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>월별 리뷰 목표 수립</li>
                <li>달성률 모니터링</li>
                <li>지속적인 개선 계획 수립</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}