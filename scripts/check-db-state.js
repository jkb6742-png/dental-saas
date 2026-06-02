// 데이터베이스 상태 확인 스크립트
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()

  try {
    console.log('📊 데이터베이스 상태 확인\n')

    // 대행사 목록
    const agencies = await prisma.agency.findMany({
      include: {
        users: {
          select: { id: true, email: true, role: true, status: true }
        },
        clinics: {
          select: { id: true, name: true, code: true }
        }
      }
    })

    console.log(`🏢 대행사 수: ${agencies.length}`)
    agencies.forEach(agency => {
      console.log(`\n대행사: ${agency.name} (${agency.id})`)
      console.log(`  사용자 수: ${agency.users.length}`)
      console.log(`  치과 수: ${agency.clinics.length}`)

      agency.users.forEach(user => {
        console.log(`    👤 ${user.email} - ${user.role} (${user.status})`)
      })

      agency.clinics.forEach(clinic => {
        console.log(`    🏥 ${clinic.name} (${clinic.code})`)
      })
    })

    // 초대 코드 확인
    const inviteCodes = await prisma.inviteCode.findMany({
      select: { id: true, code: true, isActive: true, agencyId: true }
    })

    console.log(`\n🎫 초대 코드 수: ${inviteCodes.length}`)
    inviteCodes.forEach(code => {
      console.log(`  ${code.code} - ${code.isActive ? '활성' : '비활성'} (${code.agencyId})`)
    })

  } catch (error) {
    console.error('오류:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()