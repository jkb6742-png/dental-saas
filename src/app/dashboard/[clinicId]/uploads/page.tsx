import { Metadata } from "next"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import ClientWrapper from './ClientWrapper'

export const metadata: Metadata = {
  title: "파일 업로드 관리",
  description: "월별 진행적 업로드 시스템"
}

interface Props {
  params: Promise<{ clinicId: string }>
}

export default async function UploadsPage({ params }: Props) {
  const session = await auth()
  const { clinicId } = await params

  // 마스터 계정만 접근 가능
  if ((session?.user as any)?.role !== "MASTER") {
    redirect(`/dashboard/${clinicId}`)
  }

  return (
    <div className="p-6">
      {/* 월별 진행적 업로드 시스템 안내 */}
      <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <h2 className="text-lg font-semibold text-green-900 mb-2">
          📅 월별 진행적 업로드 시스템
        </h2>
        <p className="text-sm text-green-800">
          <strong>매월 전체 파일 업로드:</strong> 중복 데이터는 자동으로 필터링되고 •
          <strong className="text-blue-700"> 새로운 데이터만 추가:</strong> 점진적으로 누적됩니다
        </p>
      </div>

      <ClientWrapper clinicId={clinicId} />
    </div>
  )
}