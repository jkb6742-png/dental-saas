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

    const { codeId, isActive } = await req.json()

    if (!codeId || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: "필수 정보가 누락되었습니다" }, { status: 400 })
    }

    // 코드 존재 확인
    const inviteCode = await prisma.inviteCode.findUnique({
      where: { id: codeId },
      include: {
        clinic: {
          include: {
            agency: true
          }
        }
      }
    })

    if (!inviteCode) {
      return NextResponse.json({ error: "초대 코드를 찾을 수 없습니다" }, { status: 404 })
    }

    // 상태 업데이트
    const updatedCode = await prisma.inviteCode.update({
      where: { id: codeId },
      data: { isActive }
    })

    // 보안 로그 기록
    await prisma.securityLog.create({
      data: {
        userId: (session.user as any).id,
        event: isActive ? 'INVITE_CODE_ACTIVATED' : 'INVITE_CODE_DEACTIVATED',
        agencyId: inviteCode.clinic.agencyId,
        details: {
          codeId: codeId,
          code: inviteCode.code,
          agencyName: inviteCode.clinic.agency.name,
          isActive: isActive,
          changedBy: (session.user as any).email,
        },
        severity: 'LOW',
      }
    })

    return NextResponse.json({
      success: true,
      message: `초대 코드가 ${isActive ? '활성화' : '비활성화'}되었습니다`
    })

  } catch (error) {
    console.error('초대 코드 상태 변경 오류:', error)
    return NextResponse.json({ error: "상태 변경 중 오류가 발생했습니다" }, { status: 500 })
  }
}