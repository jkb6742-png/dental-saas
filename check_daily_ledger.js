const { PrismaClient } = require('@prisma/client')

async function checkDailyLedger() {
  const prisma = new PrismaClient()

  try {
    console.log('=== 실제 월간장부 데이터 (DailyLedger) 확인 ===')

    // 5월 월간장부 데이터 확인
    const may2026Data = await prisma.dailyLedger.findMany({
      where: {
        year: 2026,
        month: 5
      },
      orderBy: {
        date: 'asc'
      }
    })

    console.log(`5월 DailyLedger 레코드: ${may2026Data.length}개`)

    if (may2026Data.length > 0) {
      // 5월 총합 계산
      const totals = may2026Data.reduce((acc, day) => ({
        cashIncome: acc.cashIncome + (day.cashIncome || 0),
        cardIncome: acc.cardIncome + (day.cardIncome || 0),
        onlineIncome: acc.onlineIncome + (day.onlineIncome || 0),
        insuranceClaim: acc.insuranceClaim + (day.insuranceClaim || 0),
        cashExpense: acc.cashExpense + (day.cashExpense || 0),
        cardExpense: acc.cardExpense + (day.cardExpense || 0),
        totalIncome: acc.totalIncome + (day.totalIncome || 0),
        totalExpense: acc.totalExpense + (day.totalExpense || 0),
        netTotal: acc.netTotal + (day.netTotal || 0)
      }), {
        cashIncome: 0,
        cardIncome: 0,
        onlineIncome: 0,
        insuranceClaim: 0,
        cashExpense: 0,
        cardExpense: 0,
        totalIncome: 0,
        totalExpense: 0,
        netTotal: 0
      })

      console.log('\n=== 5월 실제 월간장부 집계 ===')
      console.log(`현금수입: ${totals.cashIncome.toLocaleString()}원`)
      console.log(`카드수입: ${totals.cardIncome.toLocaleString()}원`)
      console.log(`온라인수입: ${totals.onlineIncome.toLocaleString()}원`)
      console.log(`보험청구: ${totals.insuranceClaim.toLocaleString()}원`)
      console.log(`현금지출: ${totals.cashExpense.toLocaleString()}원`)
      console.log(`카드지출: ${totals.cardExpense.toLocaleString()}원`)
      console.log(`총수입: ${totals.totalIncome.toLocaleString()}원`)
      console.log(`총지출: ${totals.totalExpense.toLocaleString()}원`)
      console.log(`순이익: ${totals.netTotal.toLocaleString()}원`)

      // 첫 5개 일별 데이터 샘플
      console.log('\n=== 첫 5개 일별 데이터 샘플 ===')
      may2026Data.slice(0, 5).forEach(day => {
        console.log(`${day.date.toISOString().split('T')[0]}: 총수입 ${(day.totalIncome || 0).toLocaleString()}원, 순이익 ${(day.netTotal || 0).toLocaleString()}원`)
      })

      // MonthlySummary와 비교
      console.log('\n=== MonthlySummary와 비교 ===')
      console.log(`DailyLedger 총수입: ${totals.totalIncome.toLocaleString()}원`)
      console.log(`MonthlySummary 매출: 160,546,590원`)
      console.log(`차이: ${(160546590 - totals.totalIncome).toLocaleString()}원`)
    } else {
      console.log('5월 DailyLedger 데이터가 없습니다.')
    }

  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDailyLedger()