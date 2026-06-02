export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import InviteCodesManagementClient from "./InviteCodesManagementClient"

export default async function InviteCodesManagementPage() {
  const session = await auth()

  // 마스터 계정만 접근 가능
  if (!session || (session.user as any).role !== 'MASTER') {
    redirect('/dashboard')
  }

  // 초대 코드 목록 조회
  const inviteCodes = await prisma.inviteCode.findMany({
    include: {
      clinic: {
        include: {
          agency: true
        }
      },
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
        }
      },
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        }
      }
    },
    orderBy: { createdAt: "desc" }
  })

  // 치과 목록 (코드 생성시 선택용 - 마스터 에이전시의 치과들)
  const clinics = await prisma.clinic.findMany({
    where: {
      agency: {
        name: "Master Agency"
      }
    },
    include: {
      agency: true
    },
    orderBy: { name: "asc" }
  })

  // 통계 정보
  const stats = {
    total: inviteCodes.length,
    active: inviteCodes.filter(code => code.isActive).length,
    used: inviteCodes.filter(code => code.currentUses > 0).length,
    expired: inviteCodes.filter(code =>
      code.expiresAt && code.expiresAt < new Date()
    ).length,
  }

  return (
    <InviteCodesManagementClient
      initialCodes={inviteCodes}
      clinics={clinics}
      stats={stats}
      currentUserId={(session.user as any).id}
    />
  )
}