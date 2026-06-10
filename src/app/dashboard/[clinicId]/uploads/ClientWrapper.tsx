"use client"

import dynamic from 'next/dynamic'

// 클라이언트 컴포넌트에서 dynamic import 사용
const SafeUploadsClient = dynamic(() => import('./SafeUploadsClient'), {
  ssr: false,
  loading: () => (
    <div className="text-center py-8">
      <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
      <div className="mt-2 text-sm text-gray-600">로딩 중...</div>
    </div>
  )
})

interface Props {
  clinicId: string
}

export default function ClientWrapper({ clinicId }: Props) {
  return <SafeUploadsClient clinicId={clinicId} />
}