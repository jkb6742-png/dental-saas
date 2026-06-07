const { PrismaClient } = require('@prisma/client')

async function testDatabasePage() {
  const prisma = new PrismaClient()

  try {
    console.log('🔍 데이터베이스 페이지 테스트...\n')

    const clinicId = await getFirstClinicId(prisma)

    // 새 테이블들이 제대로 인식되는지 확인
    console.log('✅ 새 테이블 접근 테스트:')

    const revenueCount = await prisma.revenue.count({ where: { clinicId } })
    console.log(`💰 Revenue: ${revenueCount}개`)

    const patientInfoCount = await prisma.patientInfo.count({ where: { clinicId } })
    console.log(`👥 PatientInfo: ${patientInfoCount}개`)

    const treatmentDataCount = await prisma.treatmentData.count({ where: { clinicId } })
    console.log(`🦷 TreatmentData: ${treatmentDataCount}개`)

    const visitRouteDataCount = await prisma.visitRouteData.count({ where: { clinicId } })
    console.log(`🛣️ VisitRouteData: ${visitRouteDataCount}개`)

    const regionDataCount = await prisma.regionData.count({ where: { clinicId } })
    console.log(`📍 RegionData: ${regionDataCount}개`)

    const ageDataCount = await prisma.ageData.count({ where: { clinicId } })
    console.log(`👶👴 AgeData: ${ageDataCount}개`)

    console.log('\n✅ 모든 새 테이블 정상 작동!')

  } catch (error) {
    console.error('❌ 오류:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

async function getFirstClinicId(prisma) {
  const clinic = await prisma.clinic.findFirst()
  return clinic?.id
}

testDatabasePage()