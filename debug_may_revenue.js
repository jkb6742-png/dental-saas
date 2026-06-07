const { PrismaClient } = require('@prisma/client')

async function debugMayRevenue() {
  const prisma = new PrismaClient()

  try {
    // 5월 접수 기록 상세 분석
    const receptionRecords = await prisma.receptionRecord.findMany({
      where: {
        year: 2026,
        month: 5
      },
      select: {
        patientName: true,
        patientType: true,
        chartNumber: true,
        totalRevenue: true,
        receptionTime: true
      },
      orderBy: {
        totalRevenue: 'desc'
      }
    })

    console.log(`=== 5월 접수 기록 분석 ===`)
    console.log(`총 접수 기록: ${receptionRecords.length}건`)

    // 매출 합계
    const totalRevenue = receptionRecords.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)
    console.log(`총 매출: ${totalRevenue.toLocaleString()}원`)

    // 매출 분포 확인
    const revenueRanges = {
      '0원': receptionRecords.filter(r => (r.totalRevenue || 0) === 0).length,
      '1~10만원': receptionRecords.filter(r => (r.totalRevenue || 0) > 0 && (r.totalRevenue || 0) <= 100000).length,
      '10~50만원': receptionRecords.filter(r => (r.totalRevenue || 0) > 100000 && (r.totalRevenue || 0) <= 500000).length,
      '50~100만원': receptionRecords.filter(r => (r.totalRevenue || 0) > 500000 && (r.totalRevenue || 0) <= 1000000).length,
      '100만원 이상': receptionRecords.filter(r => (r.totalRevenue || 0) > 1000000).length,
    }

    console.log(`\n매출 분포:`)
    Object.entries(revenueRanges).forEach(([range, count]) => {
      console.log(`${range}: ${count}건`)
    })

    // 가장 큰 매출 10건
    console.log(`\n가장 큰 매출 10건:`)
    receptionRecords.slice(0, 10).forEach((r, i) => {
      console.log(`${i+1}. ${r.patientName} (${r.patientType}) - ${(r.totalRevenue || 0).toLocaleString()}원`)
    })

    // 평균 매출
    const validRevenue = receptionRecords.filter(r => (r.totalRevenue || 0) > 0)
    const avgRevenue = validRevenue.length > 0 ? totalRevenue / validRevenue.length : 0
    console.log(`\n평균 매출: ${Math.round(avgRevenue).toLocaleString()}원 (${validRevenue.length}건 기준)`)

    // 신환/구환별 매출
    const newPatients = receptionRecords.filter(record => {
      const type = String(record.patientType || '').trim().toLowerCase()
      return type.includes('신환') || type === 'new' || type === '신'
    })

    const returningPatients = receptionRecords.filter(record => {
      const type = String(record.patientType || '').trim().toLowerCase()
      return type.includes('구환') || type === 'returning' || type === '구' ||
             type.includes('재진') || type === 'return'
    })

    const newPatientRevenue = newPatients.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)
    const returningPatientRevenue = returningPatients.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)

    console.log(`\n신환 매출: ${newPatientRevenue.toLocaleString()}원 (${newPatients.length}건)`)
    console.log(`구환 매출: ${returningPatientRevenue.toLocaleString()}원 (${returningPatients.length}건)`)
    console.log(`합계: ${(newPatientRevenue + returningPatientRevenue).toLocaleString()}원`)

  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugMayRevenue()