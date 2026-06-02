import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()

    // 마스터 계정만 접근 가능
    if (!session || (session.user as any).role !== 'MASTER') {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
    }

    const { codeId } = await req.json()

    if (!codeId) {
      return NextResponse.json({ error: "코드 ID가 필요합니다" }, { status: 400 })
    }

    // 코드 존재 확인
    const inviteCode = await prisma.inviteCode.findUnique({
      where: { id: codeId },
      include: {
        clinic: {
          include: {
            agency: true
          }
        },
        users: true
      }
    })

    if (!inviteCode) {
      return NextResponse.json({ error: "초대 코드를 찾을 수 없습니다" }, { status: 404 })
    }

    // 사용된 코드는 삭제할 수 없음
    if (inviteCode.currentUses > 0 || inviteCode.users.length > 0) {
      return NextResponse.json({
        error: "이미 사용된 코드는 삭제할 수 없습니다. 비활성화만 가능합니다."
      }, { status: 400 })
    }

    // 코드 삭제
    await prisma.inviteCode.delete({
      where: { id: codeId }
    })

    // 보안 로그 기록
    await prisma.securityLog.create({
      data: {
        userId: (session.user as any).id,
        event: 'INVITE_CODE_DELETED',
        agencyId: inviteCode.clinic.agencyId,
        details: {
          codeId: codeId,
          code: inviteCode.code,
          agencyName: inviteCode.clinic.agency.name,
          deletedBy: (session.user as any).email,
          reason: 'Manual deletion by master user',
        },
        severity: 'MEDIUM',
      }
    })

    return NextResponse.json({
      success: true,
      message: `초대 코드 ${inviteCode.code}가 삭제되었습니다`
    })

  } catch (error) {
    console.error('초대 코드 삭제 오류:', error)
    return NextResponse.json({ error: "코드 삭제 중 오류가 발생했습니다" }, { status: 500 })
  }
}