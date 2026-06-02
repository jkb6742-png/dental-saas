import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    // 마스터 계정만 접근 가능
    if (!session || (session.user as any).role !== 'MASTER') {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
    }

    const { userId, status } = await req.json()

    if (!userId || !status) {
      return NextResponse.json({ error: "필수 정보가 누락되었습니다" }, { status: 400 })
    }

    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: "유효하지 않은 상태입니다" }, { status: 400 })
    }

    // 사용자 상태 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: status,
        approvedBy: status === 'APPROVED' ? (session.user as any).id : null,
        approvedAt: status === 'APPROVED' ? new Date() : null,
      },
      include: {
        agency: true,
      }
    })

    // 보안 로그 기록
    await prisma.securityLog.create({
      data: {
        userId: (session.user as any).id,
        event: 'USER_STATUS_CHANGED',
        agencyId: updatedUser.agencyId,
        details: {
          targetUserId: userId,
          targetUserEmail: updatedUser.email,
          oldStatus: updatedUser.status,
          newStatus: status,
          changedBy: (session.user as any).email,
        },
        severity: 'MEDIUM',
      }
    })

    return NextResponse.json({
      success: true,
      message: `사용자 상태가 ${status === 'APPROVED' ? '승인' : status === 'REJECTED' ? '거부' : '대기'}로 변경되었습니다`
    })

  } catch (error) {
    console.error('사용자 상태 업데이트 오류:', error)
    return NextResponse.json({ error: "상태 업데이트 중 오류가 발생했습니다" }, { status: 500 })
  }
}