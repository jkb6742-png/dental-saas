const { PrismaClient } = require('@prisma/client')

async function checkNewTables() {
  const prisma = new PrismaClient()

  try {
    console.log('🔍 새로운 6개 핵심 테이블 확인...\n')

    // 1. Revenue 테이블 확인
    const revenueCount = await prisma.revenue.count()
    console.log(`💰 Revenue: ${revenueCount}개 레코드`)

    // 2. PatientInfo 테이블 확인
    const patientInfoCount = await prisma.patientInfo.count()
    console.log(`👥 PatientInfo: ${patientInfoCount}개 레코드`)

    // 3. TreatmentData 테이블 확인
    const treatmentDataCount = await prisma.treatmentData.count()
    console.log(`🦷 TreatmentData: ${treatmentDataCount}개 레코드`)

    // 4. VisitRouteData 테이블 확인
    const visitRouteDataCount = await prisma.visitRouteData.count()
    console.log(`🛣️ VisitRouteData: ${visitRouteDataCount}개 레코드`)

    // 5. RegionData 테이블 확인
    const regionDataCount = await prisma.regionData.count()
    console.log(`📍 RegionData: ${regionDataCount}개 레코드`)

    // 6. AgeData 테이블 확인
    const ageDataCount = await prisma.ageData.count()
    console.log(`👶👴 AgeData: ${ageDataCount}개 레코드`)

    console.log('\n✅ 새 테이블 구조 확인 완료!')

    // Revenue 샘플 데이터 확인
    const revenueSample = await prisma.revenue.findMany({
      take: 3,
      orderBy: { date: 'desc' }
    })

    console.log('\n💰 Revenue 샘플:')
    revenueSample.forEach(r => {
      console.log(`  ${r.date.toISOString().split('T')[0]}: 총수입 ${r.totalIncome.toLocaleString()}원`)
    })

  } catch (error) {
    console.error('❌ 오류:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkNewTables()