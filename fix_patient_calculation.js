const { PrismaClient } = require('@prisma/client')

async function fixPatientCalculation() {
  const prisma = new PrismaClient()

  try {
    console.log('=== 올바른 환자 수 계산 ===')

    const receptionRecords = await prisma.receptionRecord.findMany({
      where: {
        year: 2026,
        month: 5
      },
      orderBy: [
        { chartNumber: 'asc' },
        { receptionTime: 'asc' }
      ]
    })

    console.log(`총 접수기록: ${receptionRecords.length}건`)

    // 환자별로 그룹화
    const patientGroups = new Map()

    receptionRecords.forEach(record => {
      const chartNumber = record.chartNumber
      if (!patientGroups.has(chartNumber)) {
        patientGroups.set(chartNumber, [])
      }
      patientGroups.get(chartNumber).push(record)
    })

    console.log(`전체 고유 환자: ${patientGroups.size}명`)

    let newPatientCount = 0
    let returningPatientCount = 0

    // 각 환자별로 신환/구환 판단
    patientGroups.forEach((visits, chartNumber) => {
      // 이 환자의 모든 방문 중에서 신환 타입이 있는지 확인
      const hasNewPatientVisit = visits.some(visit => {
        const type = String(visit.patientType || '').trim().toLowerCase()
        return type.includes('신환') || type === 'new' || type === '신'
      })

      if (hasNewPatientVisit) {
        newPatientCount++
      } else {
        returningPatientCount++
      }
    })

    console.log('\n=== 올바른 계산 결과 ===')
    console.log(`신환: ${newPatientCount}명`)
    console.log(`구환: ${returningPatientCount}명`)
    console.log(`합계: ${newPatientCount + returningPatientCount}명`)

    console.log('\n=== 기존 계산과 비교 ===')
    console.log('기존 방식 (중복 계산):')
    console.log('  신환: 174명, 구환: 709명, 합계: 883명')
    console.log('올바른 방식 (환자 기준):')
    console.log(`  신환: ${newPatientCount}명, 구환: ${returningPatientCount}명, 합계: ${newPatientCount + returningPatientCount}명`)

    // 샘플 환자들 확인
    console.log('\n=== 신환으로 분류된 환자 샘플 (첫 5명) ===')
    let sampleCount = 0
    for (const [chartNumber, visits] of patientGroups) {
      const hasNewPatientVisit = visits.some(visit => {
        const type = String(visit.patientType || '').trim().toLowerCase()
        return type.includes('신환') || type === 'new' || type === '신'
      })

      if (hasNewPatientVisit && sampleCount < 5) {
        console.log(`- ${visits[0].patientName} (차트: ${chartNumber}, 방문: ${visits.length}회)`)
        visits.forEach(visit => {
          console.log(`  ${visit.receptionTime.toISOString().split('T')[0]} - ${visit.patientType}`)
        })
        sampleCount++
      }
    }

  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixPatientCalculation()