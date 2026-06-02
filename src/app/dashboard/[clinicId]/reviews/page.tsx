export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import ReviewSetup from "@/components/reviews/ReviewSetup"
import ReviewDashboard from "@/components/reviews/ReviewDashboard"
import { MessageCircle, Settings } from "lucide-react"

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
  const year = sp.year ? parseInt(sp.year) : now.getFullYear()
  const month = sp.month ? parseInt(sp.month) : now.getMonth() + 1
  const activeTab = sp.tab || "dashboard"

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="border-b border-[#e5e8eb] pb-6">
        <div className="flex items-center space-x-3 mb-2">
          <MessageCircle className="w-8 h-8 text-blue-600" />
          <h1 className="text-[28px] font-bold text-[#191f28]">온라인 리뷰 관리</h1>
        </div>
        <p className="text-[16px] text-[#6b7280]">
          네이버, 구글 리뷰를 자동으로 수집하고 분석합니다
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        <a
          href={`/dashboard/${clinicId}/reviews?year=${year}&month=${month}&tab=dashboard`}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "dashboard"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          리뷰 현황
        </a>
        <a
          href={`/dashboard/${clinicId}/reviews?year=${year}&month=${month}&tab=settings`}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "settings"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          설정 관리
        </a>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="min-h-[500px]">
        {activeTab === "dashboard" ? (
          <Suspense fallback={<div className="text-center py-12">리뷰 데이터를 불러오는 중...</div>}>
            <ReviewDashboard
              clinicId={clinicId}
              year={year}
              month={month}
            />
          </Suspense>
        ) : (
          <Suspense fallback={<div className="text-center py-12">설정을 불러오는 중...</div>}>
            <ReviewSetup clinicId={clinicId} userRole={userRole} />
          </Suspense>
        )}
      </div>

      {/* 도움말 섹션 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3">리뷰 관리 가이드</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
          <div>
            <h4 className="font-medium mb-2">🔧 초기 설정</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>네이버/구글 업체 정보 등록</li>
              <li>Google Places API 키 설정</li>
              <li>리뷰 수집 테스트 실행</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">📊 활용 방법</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>월별 리뷰 현황 모니터링</li>
              <li>평점 및 감정 분석 확인</li>
              <li>답글 응답률 관리</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">🔄 자동화</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>정기적인 리뷰 수집 스케줄링</li>
              <li>새 리뷰 알림 설정</li>
              <li>부정 리뷰 즉시 대응</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">💡 개선 팁</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>고객 만족도 지표 추적</li>
              <li>경쟁사 대비 분석</li>
              <li>마케팅 전략 수립</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}