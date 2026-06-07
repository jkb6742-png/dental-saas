import { Metadata } from "next"
import UploadsPageClient from "./UploadsPageClient"

export const metadata: Metadata = {
  title: "파일 업로드 관리",
  description: "엑셀 데이터 파일 업로드 및 관리"
}

interface Props {
  params: Promise<{ clinicId: string }>
}

export default async function UploadsPage({ params }: Props) {
  const { clinicId } = await params
  return <UploadsPageClient clinicId={clinicId} />
}