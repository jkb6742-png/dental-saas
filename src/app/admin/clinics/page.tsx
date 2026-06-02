import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import ClinicManager from "./ClinicManager"

export default async function ClinicsAdminPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const agencyId = (session.user as any).agencyId
  const clinics = await prisma.clinic.findMany({
    where: { agencyId },
    orderBy: { createdAt: "asc" },
  })

  return (
    <div className="min-h-screen bg-[#f9fafb] p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-[22px] font-bold text-[#191f28] mb-6">치과 관리</h1>
        <ClinicManager agencyId={agencyId} clinics={clinics} />
      </div>
    </div>
  )
}
