const { PrismaClient } = require('@prisma/client')

async function debugPatientStatsReal() {
  const prisma = new PrismaClient()

  try {
    console.log('=== 환자 통계 API 실제 결과 확인 ===')

    // 환자 통계 API와 동일한 로직으로 계산
    const receptionRecords = await prisma.receptionRecord.findMany({
      where: {
        year: 2026,
        month: 5
      },
      select: {
        patientType: true,
        patientName: true,
        chartNumber: true,
        receptionTime: true,
        totalRevenue: true,
        waitingTime: true
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

    // 중복 제거 (동일 환자 여러 방문)
    const uniqueNewPatients = Array.from(
      new Map(newPatients.map(p => [p.chartNumber, p])).values()
    )

    const uniqueReturningPatients = Array.from(
      new Map(returningPatients.map(p => [p.chartNumber, p])).values()
    )

    // 전체 환자 (중복 제거)
    const allUniquePatients = Array.from(
      new Map(receptionRecords.map(p => [p.chartNumber, p])).values()
    )

    console.log('\n=== 환자 통계 결과 ===')
    console.log(`신환: ${uniqueNewPatients.length}명`)
    console.log(`구환: ${uniqueReturningPatients.length}명`)
    console.log(`신환 + 구환: ${uniqueNewPatients.length + uniqueReturningPatients.length}명`)
    console.log(`전체 고유 환자: ${allUniquePatients.length}명`)

    console.log('\n=== 차이점 분석 ===')
    const diff = allUniquePatients.length - (uniqueNewPatients.length + uniqueReturningPatients.length)
    console.log(`전체 - (신환 + 구환) = ${diff}명`)

    if (diff !== 0) {
      console.log('\n=== 분류되지 않은 환자들 확인 ===')
      const classifiedChartNumbers = new Set([
        ...uniqueNewPatients.map(p => p.chartNumber),
        ...uniqueReturningPatients.map(p => p.chartNumber)
      ])

      const unclassified = allUniquePatients.filter(p => !classifiedChartNumbers.has(p.chartNumber))

      console.log(`분류되지 않은 환자: ${unclassified.length}명`)
      unclassified.slice(0, 10).forEach(p => {
        console.log(`- ${p.patientName} (차트: ${p.chartNumber}, 타입: "${p.patientType}")`)
      })

      // 환자 타입 분포 확인
      const patientTypes = [...new Set(receptionRecords.map(r => r.patientType).filter(Boolean))]
      console.log('\n환자 타입 분포:')
      patientTypes.forEach(type => {
        const count = receptionRecords.filter(r => r.patientType === type).length
        console.log(`"${type}": ${count}건`)
      })
    }

  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugPatientStatsReal()