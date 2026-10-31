import { auth } from "@/auth"
import { redirect } from "next/navigation"
import ExcelUploadClient from "./ExcelUploadClient"

// 엑셀 업로드는 마스터 전용
export default async function ExcelUploadPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if ((session.user as any).role !== "MASTER") redirect("/dashboard")

  return <ExcelUploadClient />
}
