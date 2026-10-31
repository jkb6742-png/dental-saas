export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Sidebar from "@/components/layout/Sidebar"
import Header from "@/components/layout/Header"

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
    select: { agencyId: true, clinicId: true, inviteCode: { select: { clinicId: true } } }
  })

  // 비마스터는 소속 치과(clinicId)에만 접근. 그 외 clinicId는 차단.
  const userClinicId = currentUser?.clinicId ?? currentUser?.inviteCode?.clinicId ?? null

  console.log('🔍 [LAYOUT] role:', userRole, 'DB agencyId:', currentUser?.agencyId, 'userClinicId:', userClinicId)

  if (!isMaster) {
    if (!userClinicId) {
      // 소속 치과가 없는 비마스터 계정은 데이터 접근 불가
      redirect("/dashboard")
    }
    if (clinicId !== userClinicId) {
      // 남의 치과 URL 직접 접근 시 자신의 치과로 되돌림
      console.log('🚫 [LAYOUT] 타 치과 접근 차단:', clinicId, '→', userClinicId)
      redirect(`/dashboard/${userClinicId}`)
    }
  }

  // 마스터는 모든 치과 접근 가능, 비마스터는 위에서 자신의 치과로 이미 제한됨
  const clinic = await prisma.clinic.findFirst({
    where: isMaster
      ? { id: clinicId }
      : { id: clinicId, agencyId: currentUser?.agencyId },
    include: {
      agency: {
        select: { name: true }
      }
    }
  })

  if (!clinic) redirect("/dashboard")

  return (
    <div className="flex h-screen overflow-hidden bg-[#f9fafb]">
      <Sidebar
        clinicName={clinic.name}
        agencyName={isMaster ? "마스터 관리자" : (clinic.agency?.name || (session.user as any).agencyName)}
        clinicId={clinic.id}
        userRole={userRole}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          userName={isMaster ? "마스터 관리자" : (session.user?.name ?? "")}
          pageTitle={clinic.name}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
