const { PrismaClient } = require('@prisma/client')

async function debugMayData() {
  const prisma = new PrismaClient()

  try {
    // 5월 MonthlySummary 데이터 확인
    console.log('=== 5월 MonthlySummary 데이터 ===')
    const mayData = await prisma.monthlySummary.findFirst({
      where: {
        year: 2026,
        month: 5
      }
    })

    if (mayData) {
      console.log(`신환: ${mayData.newPatients}`)
      console.log(`총환자: ${mayData.totalPatients}`)
      console.log(`신환 매출: ${mayData.newPatientRevenue}`)
      console.log(`총 매출: ${mayData.totalRevenue}`)
    } else {
      console.log('5월 MonthlySummary 데이터 없음')
    }

    // 5월 ReceptionRecord에서 실제 신환 수 계산
    console.log('\n=== 5월 ReceptionRecord에서 실제 계산 ===')
    const receptionRecords = await prisma.receptionRecord.findMany({
      where: {
        receptionTime: {
          gte: new Date(2026, 4, 1), // 5월 1일
          lt: new Date(2026, 5, 1)   // 6월 1일
        },
        totalRevenue: { gt: 0 }
      }
    })

    console.log(`총 방문 기록: ${receptionRecords.length}`)

    const newPatientRecords = receptionRecords.filter(r => r.patientType === '신환')
    console.log(`신환 방문 기록: ${newPatientRecords.length}`)

    // 고유한 신환 수
    const uniqueNewPatients = [...new Set(newPatientRecords.map(r => r.patientName))].length
    console.log(`고유한 신환 수: ${uniqueNewPatients}`)

    // 고유한 총 환자 수
    const uniqueTotalPatients = [...new Set(receptionRecords.map(r => r.patientName))].length
    console.log(`고유한 총 환자 수: ${uniqueTotalPatients}`)

  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugMayData()