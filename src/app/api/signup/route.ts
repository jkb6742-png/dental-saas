import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { UserRole, UserStatus } from "@prisma/client"

export async function POST(req: NextRequest) {
  const { agencyName, name, email, password, inviteCode } = await req.json()

  // 필수 필드 검증
  if (!agencyName || !name || !email || !password) {
    return NextResponse.json({ error: "모든 필수 항목을 입력해주세요" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다" }, { status: 400 })
  }

  // 이메일 중복 확인
  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) return NextResponse.json({ error: "이미 사용 중인 이메일입니다" }, { status: 409 })

  let userStatus: UserStatus = UserStatus.PENDING // 기본값: 승인 대기
  let userRole: UserRole = UserRole.ADMIN // 기본값: 새 에이전시 생성 시 관리자
  let inviteCodeRecord = null
  let agencyId: string

  try {
    // 초대 코드가 있는 경우 검증
    if (inviteCode && inviteCode.trim()) {
      inviteCodeRecord = await prisma.inviteCode.findUnique({
        where: { code: inviteCode.trim().toUpperCase() },
        include: {
          clinic: {
            include: { agency: true }
          }
        }
      })

      if (!inviteCodeRecord) {
        return NextResponse.json({ error: "유효하지 않은 초대 코드입니다" }, { status: 400 })
      }

      if (!inviteCodeRecord.isActive) {
        return NextResponse.json({ error: "비활성화된 초대 코드입니다" }, { status: 400 })
      }

      if (inviteCodeRecord.expiresAt && inviteCodeRecord.expiresAt < new Date()) {
        return NextResponse.json({ error: "만료된 초대 코드입니다" }, { status: 400 })
      }

      if (inviteCodeRecord.currentUses >= inviteCodeRecord.maxUses) {
        return NextResponse.json({ error: "사용 횟수를 초과한 초대 코드입니다" }, { status: 400 })
      }

      // 초대 코드가 유효하면 즉시 승인 (일반 사용자 권한)
      userStatus = UserStatus.APPROVED
      userRole = UserRole.USER // 🔧 초대코드 가입자는 일반 사용자
      agencyId = inviteCodeRecord.clinic.agencyId
    } else {
      // 초대 코드가 없으면 새 에이전시 생성 (승인 대기 상태)
      const slug = agencyName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") + "-" + Date.now()

      const agency = await prisma.agency.create({
        data: { name: agencyName, slug },
      })
      agencyId = agency.id
    }

    // 비밀번호 해시
    const hash = await bcrypt.hash(password, 12)

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email,
        password: hash,
        name,
        role: userRole,
        status: userStatus,
        agencyId,
        inviteCodeId: inviteCodeRecord?.id,
        approvedAt: userStatus === UserStatus.APPROVED ? new Date() : null,
      },
    })

    // 초대 코드 사용 처리
    if (inviteCodeRecord) {
      await prisma.inviteCode.update({
        where: { id: inviteCodeRecord.id },
        data: {
          currentUses: inviteCodeRecord.currentUses + 1,
          usedBy: user.id,
          usedAt: new Date(),
        },
      })
    }

    // 응답 메시지
    const message = userStatus === "APPROVED"
      ? "회원가입이 완료되었습니다. 로그인해주세요."
      : "회원가입 신청이 완료되었습니다. 관리자 승인을 기다려주세요."

    return NextResponse.json({
      success: true,
      message,
      status: userStatus,
      hasInviteCode: !!inviteCode
    })

  } catch (error) {
    console.error("회원가입 오류:", error)
    return NextResponse.json({ error: "회원가입 중 오류가 발생했습니다" }, { status: 500 })
  }
}
