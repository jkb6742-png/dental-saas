const { PrismaClient } = require('@prisma/client')

async function checkMonthlySummary() {
  const prisma = new PrismaClient()

  try {
    console.log('=== MonthlySummary 테이블 전체 조회 ===')

    const allData = await prisma.monthlySummary.findMany({
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    })

    console.log(`총 ${allData.length}개 레코드`)

    allData.forEach(data => {
      console.log(`${data.year}년 ${data.month}월 - 매출: ${(data.totalRevenue || 0).toLocaleString()}원`)
    })

    // 2026년 5월 데이터 상세 확인
    const may2026 = await prisma.monthlySummary.findFirst({
      where: {
        year: 2026,
        month: 5
      }
    })

    if (may2026) {
      console.log('\n=== 2026년 5월 상세 데이터 ===')
      console.log('totalRevenue:', (may2026.totalRevenue || 0).toLocaleString())
      console.log('totalExpense:', (may2026.totalExpense || 0)?.toLocaleString() || 'null')
      console.log('netProfit:', (may2026.netProfit || 0)?.toLocaleString() || 'null')
      console.log('cashIncome:', (may2026.cashIncome || 0)?.toLocaleString() || 'null')
      console.log('cardIncome:', (may2026.cardIncome || 0)?.toLocaleString() || 'null')
      console.log('insuranceClaim:', (may2026.insuranceClaim || 0)?.toLocaleString() || 'null')
      console.log('nonInsuranceRevenue:', (may2026.nonInsuranceRevenue || 0)?.toLocaleString() || 'null')
      console.log('newPatients:', may2026.newPatients)
      console.log('totalPatients:', may2026.totalPatients)
    } else {
      console.log('\n2026년 5월 데이터 없음')
    }

    // 실제 월간장부에서 온 데이터인지, 테스트 데이터인지 확인
    console.log('\n=== 데이터 패턴 분석 ===')
    const patternData = await prisma.monthlySummary.findMany({
      where: {
        year: 2026
      },
      orderBy: {
        month: 'asc'
      }
    })

    console.log('2026년 월별 매출 패턴:')
    patternData.forEach(data => {
      const expectedTestValue = data.month * 5000000 // 테스트 데이터 패턴
      const isTestData = data.totalRevenue === expectedTestValue
      console.log(`${data.month}월: ${(data.totalRevenue || 0).toLocaleString()}원 ${isTestData ? '(테스트 데이터)' : '(실제 데이터?)'}`)
    })

  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkMonthlySummary()