const { PrismaClient } = require('@prisma/client')

async function fixMaySummary() {
  const prisma = new PrismaClient()

  try {
    // 5월 ReceptionRecord에서 올바른 값 계산
    const receptionRecords = await prisma.receptionRecord.findMany({
      where: {
        receptionTime: {
          gte: new Date(2026, 4, 1), // 5월 1일
          lt: new Date(2026, 5, 1)   // 6월 1일
        },
        totalRevenue: { gt: 0 }
      }
    })

    const newPatientRecords = receptionRecords.filter(r => r.patientType === '신환')
    const newPatientRevenue = newPatientRecords.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)
    const totalRevenue = receptionRecords.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)

    // 고유한 환자 수 계산
    const uniqueNewPatients = [...new Set(newPatientRecords.map(r => r.patientName))].length
    const uniqueTotalPatients = [...new Set(receptionRecords.map(r => r.patientName))].length

    console.log('=== 계산된 올바른 값 ===')
    console.log(`신환: ${uniqueNewPatients}명`)
    console.log(`총환자: ${uniqueTotalPatients}명`)
    console.log(`신환 매출: ${newPatientRevenue}원`)
    console.log(`총 매출: ${totalRevenue}원`)

    // MonthlySummary 업데이트
    const updated = await prisma.monthlySummary.updateMany({
      where: {
        year: 2026,
        month: 5
      },
      data: {
        newPatients: uniqueNewPatients,
        totalPatients: uniqueTotalPatients,
        newPatientRevenue: newPatientRevenue,
        totalRevenue: totalRevenue
      }
    })

    console.log(`\n✅ ${updated.count}개의 MonthlySummary 레코드가 수정되었습니다.`)

  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixMaySummary()