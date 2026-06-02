import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    console.log("🔧 사용자 권한 수정 시작...")

    // 초대코드로 가입한 사용자들 찾기
    const inviteCodeUsers = await prisma.user.findMany({
      where: {
        AND: [
          { inviteCodeId: { not: null } }, // 초대코드로 가입
          { role: 'ADMIN' } // 현재 ADMIN 권한
        ]
      },
      include: {
        agency: true
      }
    })

    console.log(`📋 수정할 사용자: ${inviteCodeUsers.length}명`)

    const results = []

    for (const user of inviteCodeUsers) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'CLINIC_ADMIN' }
      })

      console.log(`✅ ${user.name} (${user.email}) → USER 권한으로 변경`)
      results.push({
        id: user.id,
        name: user.name,
        email: user.email,
        oldRole: 'ADMIN',
        newRole: 'USER'
      })
    }

    return NextResponse.json({
      success: true,
      message: `${results.length}명의 사용자 권한을 수정했습니다`,
      results
    })

  } catch (error) {
    console.error("❌ 권한 수정 오류:", error)
    return NextResponse.json(
      { error: "권한 수정 중 오류가 발생했습니다" },
      { status: 500 }
    )
  }
}