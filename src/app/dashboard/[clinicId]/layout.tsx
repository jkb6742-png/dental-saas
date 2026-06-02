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
    select: { agencyId: true }
  })

  console.log('🔍 [LAYOUT] 세션 agencyId:', (session.user as any).agencyId)
  console.log('🔍 [LAYOUT] DB agencyId:', currentUser?.agencyId)

  // 마스터는 모든 치과 접근 가능, 일반 사용자는 자신의 에이전시 치과만 접근
  const clinic = await prisma.clinic.findFirst({
    where: isMaster
      ? { id: clinicId } // 마스터는 모든 치과 접근 가능
      : {
          id: clinicId,
          agencyId: currentUser?.agencyId, // 실시간 DB agencyId 사용
        },
    include: {
      agency: {
        select: { name: true }
      }
    }
  })

  // 접근 권한이 없는 치과면 사용자의 첫 번째 치과로 리다이렉트
  if (!clinic && !isMaster) {
    console.log('🔍 [LAYOUT] 접근 권한 없음, 사용자 치과로 리다이렉트')
    const userClinic = await prisma.clinic.findFirst({
      where: { agencyId: currentUser?.agencyId },
      orderBy: { createdAt: "asc" }
    })

    if (userClinic) {
      console.log('🔍 [LAYOUT] 리다이렉트 대상:', userClinic.name)
      redirect(`/dashboard/${userClinic.id}`)
    }
  }

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
