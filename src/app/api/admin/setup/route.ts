import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 관리자 계정 설정 시작...')

    // 보안을 위해 특정 키 확인 (개발 환경에서만)
    const { setupKey } = await req.json()
    if (setupKey !== 'dental-admin-setup-2025') {
      return NextResponse.json({ error: "잘못된 설정 키입니다" }, { status: 403 })
    }

    // 기존 Master Agency 확인
    let masterAgency = await prisma.agency.findUnique({
      where: { slug: 'master-agency' }
    })

    if (!masterAgency) {
      console.log('📄 Master Agency 생성...')
      masterAgency = await prisma.agency.create({
        data: {
          name: 'Master Agency',
          slug: 'master-agency',
          plan: 'ENTERPRISE'
        }
      })
    }

    // 기존 관리자 계정 확인
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'thinklabmedi@gmail.com' }
    })

    if (existingAdmin) {
      console.log('✅ 관리자 계정이 이미 존재합니다')
      return NextResponse.json({
        success: true,
        message: "관리자 계정이 이미 존재합니다",
        admin: {
          email: existingAdmin.email,
          role: existingAdmin.role,
          status: existingAdmin.status
        }
      })
    }

    // 비밀번호 해시
    console.log('🔐 비밀번호 해시 생성...')
    const hashedPassword = await bcrypt.hash('dltodrkr13!', 12)

    // 관리자 계정 생성
    console.log('👤 관리자 계정 생성...')
    const admin = await prisma.user.create({
      data: {
        email: 'thinklabmedi@gmail.com',
        password: hashedPassword,
        name: 'Master Admin',
        role: 'MASTER',
        status: 'APPROVED',
        agencyId: masterAgency.id,
        approvedAt: new Date()
      }
    })

    // 기본 치과 생성
    console.log('🦷 기본 치과 생성...')
    const clinic = await prisma.clinic.create({
      data: {
        name: '디어스치과',
        code: 'DEARS001',
        agencyId: masterAgency.id
      }
    })

    console.log('✅ 설정 완료!')

    return NextResponse.json({
      success: true,
      message: "관리자 계정 및 기본 치과가 성공적으로 생성되었습니다",
      admin: {
        email: admin.email,
        role: admin.role,
        status: admin.status
      },
      clinic: {
        name: clinic.name,
        code: clinic.code
      }
    })

  } catch (error) {
    console.error('❌ 관리자 설정 실패:', error)
    return NextResponse.json({
      error: "관리자 계정 생성 중 오류가 발생했습니다",
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    }, { status: 500 })
  }
}