import { auth } from "@/auth"
import { redirect } from "next/navigation"
import UploadClient from "./UploadClient"

export default async function UploadPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const session = await auth()
  const { clinicId } = await params

  // 마스터 계정만 접근 가능
  if ((session?.user as any)?.role !== "MASTER") {
    redirect(`/dashboard/${clinicId}`)
  }

  return <UploadClient clinicId={clinicId} />
}
