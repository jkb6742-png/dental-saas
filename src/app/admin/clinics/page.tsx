import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import ClinicManager from "./ClinicManager"

export default async function ClinicsAdminPage() {
  const session = await auth()
  if (!session) redirect("/login")
  // 치과 관리(전체 치과 목록/추가/삭제)는 마스터 전용. 비마스터는 자신의 치과로.
  if ((session.user as any).role !== "MASTER") redirect("/dashboard")

  const agencyId = (session.user as any).agencyId
  const clinics = await prisma.clinic.findMany({
    where: { agencyId },
    orderBy: { createdAt: "asc" },
  })

  return (
    <div className=" p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-[22px] font-bold text-[#191f28] mb-3">치과 관리</h1>
        <ClinicManager agencyId={agencyId} clinics={clinics} />
      </div>
    </div>
  )
}
