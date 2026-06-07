import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    console.log('👤 개발용 사용자 생성 시작...')

    // Agency 확인
    const agency = await prisma.agency.findFirst()
    if (!agency) {
      return NextResponse.json({
        success: false,
        error: 'Agency가 먼저 생성되어야 합니다.'
      }, { status: 400 })
    }

    // 이미 존재하는 사용자 확인
    const existingUser = await prisma.user.findUnique({
      where: { email: "admin@test.com" }
    })

    if (existingUser) {
      return NextResponse.json({
        success: true,
        message: '개발용 사용자가 이미 존재합니다.',
        user: {
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role
        },
        loginInfo: {
          email: "admin@test.com",
          password: "admin123"
        }
      })
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash("admin123", 12)

    // 개발용 사용자 생성
    const devUser = await prisma.user.create({
      data: {
        email: "admin@test.com",
        password: hashedPassword,
        name: "개발자",
        role: "MASTER",
        status: "APPROVED",
        agencyId: agency.id
      }
    })

    console.log('✅ 개발용 사용자 생성 완료')

    return NextResponse.json({
      success: true,
      message: '개발용 사용자가 생성되었습니다!',
      user: {
        id: devUser.id,
        email: devUser.email,
        name: devUser.name,
        role: devUser.role
      },
      loginInfo: {
        email: "admin@test.com",
        password: "admin123",
        url: "/login"
      }
    })

  } catch (error) {
    console.error('❌ 개발용 사용자 생성 오류:', error)
    return NextResponse.json({
      success: false,
      error: '개발용 사용자 생성 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}