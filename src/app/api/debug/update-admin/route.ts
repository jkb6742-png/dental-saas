import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST() {
  try {
    const newEmail = 'thinklabmedi@gmail.com'
    const newPassword = 'dltodrkr13!'
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // 기존 관리자 계정 업데이트
    const updated = await prisma.user.update({
      where: { email: 'master@dental-insight.com' },
      data: {
        email: newEmail,
        password: hashedPassword
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        agencyId: true
      }
    })

    return NextResponse.json({
      success: true,
      message: "관리자 계정이 업데이트되었습니다!",
      credentials: {
        email: newEmail,
        password: newPassword
      },
      user: updated
    })
  } catch (error) {
    console.error("Error updating admin:", error)

    // 이메일이 이미 존재하는 경우 처리
    if (error.code === 'P2002') {
      return NextResponse.json({
        success: false,
        error: "해당 이메일이 이미 존재합니다. 기존 계정을 확인하거나 다른 이메일을 사용해주세요.",
        detail: error.message
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: "관리자 계정 업데이트 중 오류가 발생했습니다.",
      detail: error.message
    }, { status: 500 })
  }
}