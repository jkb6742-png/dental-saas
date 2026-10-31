// =============================================================================
// API Integrations Management UI - GPT API 설정 관리 화면
// =============================================================================

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import ApiIntegrationsClient from "./ApiIntegrationsClient"

export default async function ApiIntegrationsPage() {
  const session = await auth()

  // MASTER 권한 확인
  if ((session?.user as any)?.role !== "MASTER") {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-semibold text-gray-900">API 통합 설정</h1>
            <p className="mt-1 text-sm text-gray-600">
              GPT API 설정을 관리합니다. 파일 분석 시 컬럼 매핑 보조에 사용됩니다.
            </p>
          </div>

          <ApiIntegrationsClient />
        </div>
      </div>
    </div>
  )
}