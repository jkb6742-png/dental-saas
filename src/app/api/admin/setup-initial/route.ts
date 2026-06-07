import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 초기 Agency 및 사용자 설정 시작...')

    // 기존 Agency 확인
    const existingAgency = await prisma.agency.findFirst()

    if (existingAgency) {
      console.log('✅ 기존 Agency 존재:', existingAgency.name)
      return NextResponse.json({
        success: true,
        message: '이미 Agency가 설정되어 있습니다.',
        agency: existingAgency
      })
    }

    // Agency 생성
    console.log('📋 Agency 생성 중...')
    const agency = await prisma.agency.create({
      data: {
        name: "THINKLB",
        slug: "thinklb",
        plan: "PRO"
      }
    })

    console.log('✅ Agency 생성 완료:', agency)

    // 마스터 사용자 생성
    console.log('👤 마스터 사용자 생성 중...')
    const masterUser = await prisma.user.create({
      data: {
        email: "admin@thinklb.com",
        password: "$2a$12$hashedPasswordExample", // 실제로는 해시된 비밀번호
        name: "관리자",
        role: "MASTER",
        status: "APPROVED",
        agencyId: agency.id
      }
    })

    console.log('✅ 마스터 사용자 생성 완료:', masterUser)

    return NextResponse.json({
      success: true,
      message: 'Agency와 마스터 사용자가 성공적으로 생성되었습니다!',
      data: {
        agency: {
          id: agency.id,
          name: agency.name,
          slug: agency.slug,
          plan: agency.plan
        },
        user: {
          id: masterUser.id,
          email: masterUser.email,
          name: masterUser.name,
          role: masterUser.role
        }
      }
    })

  } catch (error) {
    console.error('❌ 초기 설정 오류:', error)
    return NextResponse.json({
      success: false,
      error: '초기 설정 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}