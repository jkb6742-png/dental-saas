import { denyClinic } from "@/lib/requests/access"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

// PUT: 액션플랜 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const owner = await prisma.actionPlan.findUnique({ where: { id: id }, select: { clinicId: true } })
    if (!owner) return NextResponse.json({ error: "실행계획을 찾을 수 없습니다" }, { status: 404 })
    const denied = await denyClinic(owner.clinicId)
    if (denied) return denied

    const { goal, description, targetDate, status, priority } = await request.json()

    if (!goal || !description || !targetDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 한국어 상태를 Enum으로 변환
    const dbStatus = status === '시작전' ? 'PENDING' : status === '진행중' ? 'IN_PROGRESS' : 'COMPLETED'
    const dbPriority = priority === '상' ? 'HIGH' : priority === '중' ? 'MEDIUM' : 'LOW'

    const actionPlan = await prisma.actionPlan.update({
      where: { id },
      data: {
        goal,
        description,
        targetDate: new Date(targetDate),
        status: dbStatus,
        priority: dbPriority,
        progress: dbStatus === 'COMPLETED' ? 100 : dbStatus === 'IN_PROGRESS' ? 30 : 0,
        updatedAt: new Date()
      },
      include: {
        attachments: true,
        comments: {
          include: {
            user: { select: { name: true, role: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    return NextResponse.json({
      ...actionPlan,
      status: actionPlan.status === 'PENDING' ? '시작전' : actionPlan.status === 'IN_PROGRESS' ? '진행중' : '완료',
      priority: actionPlan.priority === 'HIGH' ? '상' : actionPlan.priority === 'MEDIUM' ? '중' : '하',
      comments: actionPlan.comments.map(comment => ({
        ...comment,
        author: comment.user.name,
        authorRole: comment.user.role
      }))
    })
  } catch (error) {
    console.error("[ACTION_PLANS] 수정 오류:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: 액션플랜 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    // MASTER 권한 확인
    if (!user || user.role !== 'MASTER') {
      return NextResponse.json({ error: "Master access required" }, { status: 403 })
    }

    const { id } = await params

    await prisma.actionPlan.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[ACTION_PLANS] 삭제 오류:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}