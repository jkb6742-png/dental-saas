// 환경 변수 로드
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const pg = require('pg')
const bcrypt = require('bcryptjs')

function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("supabase")
      ? { rejectUnauthorized: false }
      : process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

async function createMasterUser() {
  let prisma

  try {
    console.log('🚀 마스터 계정 생성 중...')

    // Prisma 클라이언트 생성 시도
    try {
      prisma = createPrismaClient()
      await prisma.$connect()
    } catch (connectionError) {
      console.error('❌ 데이터베이스 연결 실패:', connectionError.message)
      return
    }

    // 기존 마스터 계정 확인 및 업데이트
    const existingMaster = await prisma.user.findFirst({
      where: { role: 'MASTER' }
    })

    const newEmail = 'thinklabmedi@gmail.com'
    const newPassword = 'dltodrkr13!'

    if (existingMaster) {
      console.log('⚠️ 기존 마스터 계정을 업데이트합니다:', existingMaster.email, '→', newEmail)

      // 비밀번호 해시
      const hashedPassword = await bcrypt.hash(newPassword, 12)

      // 마스터 계정 업데이트
      const updatedMaster = await prisma.user.update({
        where: { id: existingMaster.id },
        data: {
          email: newEmail,
          password: hashedPassword,
          name: 'ThinkLab Master',
          updatedAt: new Date()
        }
      })

      console.log('✅ 마스터 계정 업데이트 완료!')
      console.log('📧 새 이메일:', updatedMaster.email)
      console.log('🔒 새 비밀번호:', newPassword)
      console.log('⚠️ 로그인 후 반드시 비밀번호를 변경하세요!')

      // 보안 로그 기록
      await prisma.securityLog.create({
        data: {
          userId: updatedMaster.id,
          event: 'MASTER_ACCOUNT_UPDATED',
          agencyId: existingMaster.agencyId,
          details: {
            oldEmail: existingMaster.email,
            newEmail: newEmail,
            updatedAt: new Date().toISOString(),
            note: 'Master account credentials updated via script'
          },
          severity: 'HIGH',
        }
      })

      console.log('✅ 보안 로그 기록 완료')
      return
    }

    // 마스터용 에이전시 생성
    const masterAgency = await prisma.agency.create({
      data: {
        name: 'Master Agency',
        slug: 'master-agency-' + Date.now(),
        plan: 'ENTERPRISE'
      }
    })

    console.log('✅ 마스터 에이전시 생성 완료:', masterAgency.name)

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // 마스터 계정 생성
    const masterUser = await prisma.user.create({
      data: {
        email: newEmail,
        password: hashedPassword,
        name: 'ThinkLab Master',
        role: 'MASTER',
        status: 'APPROVED',
        agencyId: masterAgency.id,
        approvedAt: new Date(),
      }
    })

    console.log('✅ 마스터 계정 생성 완료!')
    console.log('📧 이메일:', masterUser.email)
    console.log('🔒 비밀번호:', newPassword)
    console.log('⚠️ 로그인 후 반드시 비밀번호를 변경하세요!')

    // 보안 로그 기록
    await prisma.securityLog.create({
      data: {
        userId: masterUser.id,
        event: 'MASTER_ACCOUNT_CREATED',
        agencyId: masterAgency.id,
        details: {
          email: masterUser.email,
          name: masterUser.name,
          role: 'MASTER',
          createdAt: new Date().toISOString(),
          note: 'Initial master account created via script'
        },
        severity: 'HIGH',
      }
    })

    console.log('✅ 보안 로그 기록 완료')

  } catch (error) {
    console.error('❌ 마스터 계정 생성 실패:', error)
    throw error
  } finally {
    if (prisma) {
      await prisma.$disconnect()
    }
  }
}

// 스크립트 실행
createMasterUser()
  .then(() => {
    console.log('🎉 마스터 계정 생성 작업 완료!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 오류:', error)
    process.exit(1)
  })