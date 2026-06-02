import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST() {
  try {
    const newPassword = 'admin123'
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    const updated = await prisma.user.update({
      where: { email: 'master@dental-insight.com' },
      data: { password: hashedPassword },
      select: { email: true, name: true, role: true, status: true }
    })

    return NextResponse.json({
      success: true,
      message: "관리자 비밀번호가 재설정되었습니다!",
      credentials: {
        email: "master@dental-insight.com",
        password: "admin123"
      },
      user: updated
    })
  } catch (error) {
    console.error("Error resetting password:", error)
    return NextResponse.json({
      success: false,
      error: "비밀번호 재설정 중 오류가 발생했습니다.",
      detail: error.message
    }, { status: 500 })
  }
}