import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    console.log("👥 모든 사용자 조회...")

    const users = await prisma.user.findMany({
      include: {
        agency: true,
        inviteCode: true
      },
      orderBy: { createdAt: 'desc' }
    })

    const result = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      agencyName: user.agency?.name,
      hasInviteCode: !!user.inviteCodeId,
      inviteCode: user.inviteCode?.code,
      createdAt: user.createdAt
    }))

    console.log(`📊 총 ${users.length}명의 사용자`)
    result.forEach(user => {
      console.log(`- ${user.name} (${user.email}) | 권한: ${user.role} | 초대코드: ${user.hasInviteCode ? user.inviteCode : '없음'}`)
    })

    return NextResponse.json({
      success: true,
      users: result,
      total: users.length
    })

  } catch (error) {
    console.error("❌ 사용자 조회 오류:", error)
    return NextResponse.json(
      { error: "사용자 조회 중 오류가 발생했습니다" },
      { status: 500 }
    )
  }
}