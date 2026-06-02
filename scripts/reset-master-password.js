// 관리자 비밀번호 재설정 스크립트
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function resetMasterPassword() {
  const prisma = new PrismaClient()

  try {
    const newPassword = 'admin123'
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    const updated = await prisma.user.update({
      where: { email: 'master@dental-insight.com' },
      data: { password: hashedPassword },
      select: { email: true, name: true, role: true, status: true }
    })

    console.log('✅ 관리자 비밀번호가 재설정되었습니다!')
    console.log('📧 이메일: master@dental-insight.com')
    console.log('🔑 새 비밀번호: admin123')
    console.log('👤 계정 정보:', updated)

  } catch (error) {
    console.error('❌ 오류:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

resetMasterPassword()