import { denyClinic } from "@/lib/requests/access"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

// GET: 액션플랜 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get("clinicId")

    if (!clinicId) {
      return NextResponse.json({ error: "Missing clinicId" }, { status: 400 })
    }

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
      status: plan.status === 'PENDING' ? '시작전' : plan.status === 'IN_PROGRESS' ? '진행중' : '완료',
      priority: plan.priority === 'HIGH' ? '상' : plan.priority === 'MEDIUM' ? '중' : '하',
      comments: plan.comments.map(comment => ({
        ...comment,
        author: comment.user.name,
        authorRole: comment.user.role
      }))
    }))

    return NextResponse.json(formattedPlans)
  } catch (error) {
    console.error("[ACTION_PLANS] 조회 오류:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: 새 액션플랜 생성
export async function POST(request: NextRequest) {
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

    const { clinicId, goal, description, targetDate, status, priority } = await request.json()

    if (!clinicId || !goal || !description || !targetDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const denied = await denyClinic(clinicId)
    if (denied) return denied

    // 한국어 상태를 Enum으로 변환
    const dbStatus = status === '시작전' ? 'PENDING' : status === '진행중' ? 'IN_PROGRESS' : 'COMPLETED'
    const dbPriority = priority === '상' ? 'HIGH' : priority === '중' ? 'MEDIUM' : 'LOW'

    const actionPlan = await prisma.actionPlan.create({
      data: {
        clinicId,
        goal,
        description,
        targetDate: new Date(targetDate),
        status: dbStatus,
        priority: dbPriority,
        progress: dbStatus === 'COMPLETED' ? 100 : dbStatus === 'IN_PROGRESS' ? 30 : 0,
        createdBy: user.id
      },
      include: {
        attachments: true,
        comments: {
          include: {
            user: { select: { name: true, role: true } }
          }
        }
      }
    })

    return NextResponse.json({
      ...actionPlan,
      status: actionPlan.status === 'PENDING' ? '시작전' : actionPlan.status === 'IN_PROGRESS' ? '진행중' : '완료',
      priority: actionPlan.priority === 'HIGH' ? '상' : actionPlan.priority === 'MEDIUM' ? '중' : '하'
    })
  } catch (error) {
    console.error("[ACTION_PLANS] 생성 오류:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}