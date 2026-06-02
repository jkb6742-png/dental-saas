export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import UsersManagementClient from "./UsersManagementClient"

export default async function UsersManagementPage() {
  const session = await auth()

  // 마스터 계정만 접근 가능
  if (!session || (session.user as any).role !== 'MASTER') {
    redirect('/dashboard')
  }

  // 모든 사용자 조회 (대기, 승인, 거부 포함)
  const users = await prisma.user.findMany({
    include: {
      agency: true,
      inviteCode: true,
    },
    orderBy: [
      { status: "asc" }, // PENDING이 먼저 오도록
      { createdAt: "desc" }
    ]
  })

  // 통계 정보
  const stats = {
    total: users.length,
    pending: users.filter(u => u.status === "PENDING").length,
    approved: users.filter(u => u.status === "APPROVED").length,
    rejected: users.filter(u => u.status === "REJECTED").length,
    master: users.filter(u => u.role === "MASTER").length,
  }

  return (
    <UsersManagementClient
      initialUsers={users}
      stats={stats}
    />
  )
}