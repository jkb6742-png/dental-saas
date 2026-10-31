// 로컬 개발용 시드: 에이전시 + 마스터 계정 + 샘플 치과 1개
// 실행: node scripts/seed-local-master.js
// 주의: 로컬 dev DB(.env DATABASE_URL=localhost:5436) 전용. NAS/운영 DB에 실행 금지.
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@test.com'
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123'

async function main() {
  const url = process.env.DATABASE_URL || ''
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    throw new Error(`안전장치: DATABASE_URL 이 로컬이 아닙니다 → ${url}. 로컬 dev DB에서만 실행하세요.`)
  }
  console.log('🌱 시드 시작:', url.replace(/:[^:@/]+@/, ':***@'))

  // 1) 에이전시 - 기존(복원된 NAS 데이터)이 있으면 재사용, 없으면 생성
  let agency = await prisma.agency.findFirst({ where: { slug: 'local-dev-agency' } })
    || await prisma.agency.findFirst()
  if (!agency) {
    agency = await prisma.agency.create({
      data: { name: 'Local Dev Agency', slug: 'local-dev-agency', plan: 'ENTERPRISE' },
    })
    console.log('✅ 에이전시 생성:', agency.name)
  } else {
    console.log('ℹ️ 기존 에이전시 사용:', agency.name)
  }

  // 2) 마스터 계정
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12)
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { password: hashed, role: 'MASTER', status: 'APPROVED', agencyId: agency.id },
    create: {
      email: ADMIN_EMAIL,
      password: hashed,
      name: 'Local Master',
      role: 'MASTER',
      status: 'APPROVED',
      agencyId: agency.id,
      approvedAt: new Date(),
    },
  })
  console.log('✅ 마스터 계정:', user.email)

  // 3) 치과 - 이미 있으면(복원된 NAS 데이터) 그대로 사용, 하나도 없을 때만 샘플 생성
  let clinic = await prisma.clinic.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!clinic) {
    clinic = await prisma.clinic.create({
      data: { name: '테스트 치과', code: 'DEV001', agencyId: agency.id },
    })
    console.log('✅ 샘플 치과 생성:', clinic.name, `(id=${clinic.id})`)
  } else {
    const total = await prisma.clinic.count()
    console.log(`ℹ️ 기존 치과 ${total}개 유지 (샘플 생성 안 함). 대표 치과:`, clinic.name, `(id=${clinic.id})`)
  }

  console.log('\n🎉 완료!')
  console.log(`   로그인: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  console.log(`   치과 대시보드: http://localhost:3200/dashboard/${clinic.id}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ 시드 실패:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
