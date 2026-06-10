"use client"

import dynamic from 'next/dynamic'

// Dynamic import로 hydration 에러 방지
const UploadsPageClient = dynamic(() => import('./UploadsPageClient'), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 bg-blue-600 rounded animate-pulse" />
          <div>
            <h3 className="text-lg font-semibold">파일 업로드 관리</h3>
            <p className="text-sm text-gray-600">월별 필수 파일 업로드 현황</p>
          </div>
        </div>
      </div>
      <div className="text-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        <div className="mt-2 text-sm text-gray-600">로딩 중...</div>
      </div>
    </div>
  )
})

interface Props {
  clinicId: string
}

export default function UploadsPageClientWrapper({ clinicId }: Props) {
  return <UploadsPageClient clinicId={clinicId} />
}