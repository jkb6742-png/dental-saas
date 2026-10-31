export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import ActionPlansClient from "./ActionPlansClient"

async function getActionPlans(clinicId: string) {
  try {
    const actionPlans = await prisma.actionPlan.findMany({
      where: { clinicId },
      include: {
        attachments: true,
        comments: {
          include: {
            user: {
              select: { name: true, role: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        user: {
          select: { name: true, role: true }
        }
      },
      orderBy: [
        { priority: 'asc' }, // HIGH(0) > MEDIUM(1) > LOW(2)
        { createdAt: 'desc' }
      ]
    })

    // Enum 값을 한국어로 변환
    const formattedPlans = actionPlans.map(plan => ({
      ...plan,
      status: (plan.status === 'PENDING' ? '시작전' : plan.status === 'IN_PROGRESS' ? '진행중' : '완료') as "시작전" | "진행중" | "완료",
      priority: (plan.priority === 'HIGH' ? '상' : plan.priority === 'MEDIUM' ? '중' : '하') as "상" | "중" | "하",
      attachments: plan.attachments.map(attachment => ({
        id: attachment.id,
        name: attachment.originalName,
        size: attachment.fileSize,
        type: attachment.mimeType,
        uploadedAt: attachment.uploadedAt,
        url: attachment.filePath
      })),
      comments: plan.comments.map(comment => ({
        ...comment,
        author: comment.user.name,
        authorRole: comment.user.role
      }))
    }))

    return formattedPlans
  } catch (error) {
    console.error('액션플랜 조회 오류:', error)
    return []
  }
}

export default async function ActionPlansPage({
  params,
}: {
  params: Promise<{ clinicId: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { clinicId } = await params

  // 사용자 역할 가져오기
  const userRole = (session.user as any).role

  // 실제 액션플랜 데이터 조회
  const actionPlans = await getActionPlans(clinicId)

  return (
    <ActionPlansClient
      clinicId={clinicId}
      actionPlans={actionPlans}
      userRole={userRole}
    />
  )
}