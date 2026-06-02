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

    const { userId, role } = await req.json()

    if (!userId || !role) {
      return NextResponse.json({ error: "필수 정보가 누락되었습니다" }, { status: 400 })
    }

    if (!['MASTER', 'ADMIN', 'ANALYST', 'VIEWER'].includes(role)) {
      return NextResponse.json({ error: "유효하지 않은 역할입니다" }, { status: 400 })
    }

    // 현재 사용자 정보 조회
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { agency: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 })
    }

    // 마스터 역할 변경에 대한 추가 검증
    if (role === 'MASTER') {
      // 자기 자신의 역할은 변경할 수 없음
      if (userId === (session.user as any).id) {
        return NextResponse.json({ error: "자신의 역할은 변경할 수 없습니다" }, { status: 400 })
      }

      // 승인된 계정만 마스터로 변경 가능
      if (currentUser.status !== 'APPROVED') {
        return NextResponse.json({ error: "승인된 계정만 마스터로 변경할 수 있습니다" }, { status: 400 })
      }
    }

    const oldRole = currentUser.role

    // 사용자 역할 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: role },
      include: { agency: true }
    })

    // 보안 로그 기록
    await prisma.securityLog.create({
      data: {
        userId: (session.user as any).id,
        event: 'USER_ROLE_CHANGED',
        agencyId: updatedUser.agencyId,
        details: {
          targetUserId: userId,
          targetUserEmail: updatedUser.email,
          oldRole: oldRole,
          newRole: role,
          changedBy: (session.user as any).email,
        },
        severity: role === 'MASTER' ? 'HIGH' : 'MEDIUM',
      }
    })

    const roleNames = {
      'MASTER': '마스터',
      'ADMIN': '관리자',
      'ANALYST': '분석가',
      'VIEWER': '뷰어'
    }

    return NextResponse.json({
      success: true,
      message: `사용자 역할이 ${roleNames[role as keyof typeof roleNames]}로 변경되었습니다`
    })

  } catch (error) {
    console.error('사용자 역할 업데이트 오류:', error)
    return NextResponse.json({ error: "역할 업데이트 중 오류가 발생했습니다" }, { status: 500 })
  }
}