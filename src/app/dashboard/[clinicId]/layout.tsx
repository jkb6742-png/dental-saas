export const dynamic = "force-dynamic"

import { auth, accessibleClinicIds } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Sidebar from "@/components/layout/Sidebar"
import Header from "@/components/layout/Header"
import { Suspense } from "react"

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ clinicId: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { clinicId } = await params

  const userRole = (session.user as any).role
  const isMaster = userRole === 'MASTER'

  // 실시간 사용자 정보 조회 (세션 정보가 아닌 DB에서 직접)
  const currentUser = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: {
      role: true,
      agencyId: true,
      clinicId: true,
      inviteCode: { select: { clinicId: true } },
      employee: { select: { leftOn: true, clinicAccess: { select: { clinicId: true } } } },
    }
  })
  if (!currentUser) redirect("/login")

  // 비마스터: 직원은 배정 치과, 원장은 소속 치과에만 접근. 그 외 clinicId는 차단.
  if (!isMaster) {
    const allowed = accessibleClinicIds(currentUser) ?? []
    if (allowed.length === 0) redirect(currentUser.role === "STAFF" ? "/work" : "/dashboard")
    if (!allowed.includes(clinicId)) redirect(`/dashboard/${allowed[0]}`)
  }

  // 마스터는 모든 치과 접근 가능, 비마스터는 위에서 자신의 치과로 이미 제한됨
  const clinic = await prisma.clinic.findFirst({
    where: isMaster
      ? { id: clinicId }
      : { id: clinicId, agencyId: currentUser?.agencyId },
    select: {
      id: true,
      name: true,
      agency: {
        select: { name: true }
      }
    }
  })

  if (!clinic) redirect("/dashboard")

  return (
    <div className="flex h-screen overflow-hidden bg-[#f2f2ef]">
      <Suspense fallback={<div className="w-[76px] shrink-0 h-screen bg-[#e9e9e5] border-r border-[#d1d1cc]" />}>
        <Sidebar clinicId={clinic.id} userRole={userRole} />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          userName={isMaster ? "마스터 관리자" : (session.user?.name ?? "")}
          pageTitle={clinic.name}
          canSwitchClinic={isMaster}
        />
        <main className="flex-1 overflow-y-auto px-4 py-3">
          <div className="mx-auto w-full max-w-[1180px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
