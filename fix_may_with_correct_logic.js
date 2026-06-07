const { PrismaClient } = require('@prisma/client')

async function fixMayWithCorrectLogic() {
  const prisma = new PrismaClient()

  try {
    // 환자 통계 API와 동일한 방식으로 5월 데이터 계산
    const receptionRecords = await prisma.receptionRecord.findMany({
      where: {
        year: 2026,
        month: 5
      }
    })

    console.log(`총 접수기록: ${receptionRecords.length}건`)

    // 신환/구환 분류 (환자통계 API와 동일한 로직)
    const newPatients = receptionRecords.filter(record => {
      const type = String(record.patientType || '').trim().toLowerCase()
      return type.includes('신환') || type === 'new' || type === '신'
    })

    const returningPatients = receptionRecords.filter(record => {
      const type = String(record.patientType || '').trim().toLowerCase()
      return type.includes('구환') || type === 'returning' || type === '구' ||
             type.includes('재진') || type === 'return'
    })

    // chartNumber 기준으로 중복 제거 (환자통계 API와 동일)
    const uniqueNewPatients = Array.from(
      new Map(newPatients.map(p => [p.chartNumber, p])).values()
    )

    const uniqueReturningPatients = Array.from(
      new Map(returningPatients.map(p => [p.chartNumber, p])).values()
    )

    const allUniquePatients = Array.from(
      new Map(receptionRecords.map(p => [p.chartNumber, p])).values()
    )

    // 매출 계산
    const newPatientRevenue = newPatients.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)
    const returningPatientRevenue = returningPatients.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)
    const totalRevenue = newPatientRevenue + returningPatientRevenue

    console.log('=== 환자통계 API와 동일한 방식으로 계산한 결과 ===')
    console.log(`신환: ${uniqueNewPatients.length}명`)
    console.log(`구환: ${uniqueReturningPatients.length}명`)
    console.log(`총환자: ${allUniquePatients.length}명`)
    console.log(`신환 매출: ${newPatientRevenue}원`)
    console.log(`총 매출: ${totalRevenue}원`)

    // MonthlySummary 업데이트
    const updated = await prisma.monthlySummary.updateMany({
      where: {
        year: 2026,
        month: 5
      },
      data: {
        newPatients: uniqueNewPatients.length,
        totalPatients: allUniquePatients.length,
        newPatientRevenue: newPatientRevenue,
        totalRevenue: totalRevenue
      }
    })

    console.log(`\n✅ ${updated.count}개의 MonthlySummary 레코드가 올바르게 수정되었습니다.`)

  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixMayWithCorrectLogic()