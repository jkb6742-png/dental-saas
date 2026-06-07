const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function analyzeData() {
  try {
    console.log('=== ReceptionRecord 데이터 분석 ===')

    // 첫 10개 레코드의 모든 필드 확인
    const sampleRecords = await prisma.receptionRecord.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('최근 10개 레코드 분석:')
    sampleRecords.forEach((record, index) => {
      console.log(`\n${index + 1}. 레코드 ID: ${record.id}`)
      console.log(`   접수시간: ${record.receptionTime}`)
      console.log(`   대기시간: ${record.waitingTime} (타입: ${typeof record.waitingTime})`)
      console.log(`   환자유형: ${record.patientType}`)
      console.log(`   환자명: ${record.patientName}`)
      console.log(`   차트번호: ${record.chartNumber}`)
      console.log(`   상태: ${record.status}`)
      console.log(`   담당의사: ${record.doctor}`)
      console.log(`   총진료비: ${record.totalRevenue}`)
    })

    // 대기시간 통계
    console.log('\n=== 대기시간 데이터 통계 ===')

    const waitingStats = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total_records,
        COUNT(waiting_time) as has_waiting_time,
        MIN(waiting_time) as min_waiting,
        MAX(waiting_time) as max_waiting,
        AVG(waiting_time) as avg_waiting
      FROM "ReceptionRecord"
      WHERE year = 2026
    `

    console.log('통계:', waitingStats[0])

    // 환자 유형별 통계
    const typeStats = await prisma.receptionRecord.groupBy({
      by: ['patientType'],
      _count: {
        id: true
      },
      where: {
        year: 2026
      }
    })

    console.log('\n=== 환자유형별 통계 ===')
    typeStats.forEach(stat => {
      console.log(`${stat.patientType || '미분류'}: ${stat._count.id}명`)
    })

  } catch (error) {
    console.error('분석 중 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

analyzeData()