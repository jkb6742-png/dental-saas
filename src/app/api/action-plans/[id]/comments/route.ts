import { denyClinic } from "@/lib/requests/access"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

// POST: 댓글 추가
export async function POST(
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

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { id: actionPlanId } = await params
    const owner = await prisma.actionPlan.findUnique({ where: { id: actionPlanId }, select: { clinicId: true } })
    if (!owner) return NextResponse.json({ error: "실행계획을 찾을 수 없습니다" }, { status: 404 })
    const denied = await denyClinic(owner.clinicId)
    if (denied) return denied

    const { content } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 })
    }

    const comment = await prisma.actionPlanComment.create({
      data: {
        actionPlanId,
        content: content.trim(),
        createdBy: user.id
      },
      include: {
        user: {
          select: { name: true, role: true }
        }
      }
    })

    return NextResponse.json({
      ...comment,
      author: comment.user.name,
      authorRole: comment.user.role
    })
  } catch (error) {
    console.error("[ACTION_PLAN_COMMENTS] 생성 오류:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}