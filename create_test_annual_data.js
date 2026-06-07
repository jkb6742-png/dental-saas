// 테스트용 연간장부 데이터 생성
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestAnnualData() {
  try {
    console.log('📊 테스트용 연간장부 데이터 생성...\n')

    const clinicId = 'cmpyssy9c055qmwugjrq9dmvh' // 실제 클리닉 ID

    // 기존 데이터 삭제
    const deleted = await prisma.monthlySummary.deleteMany({
      where: { clinicId, year: 2026 }
    })
    console.log(`🗑️ 기존 데이터 삭제: ${deleted.count}건`)

    // 12개월 테스트 데이터 생성
    console.log('💾 12개월 테스트 데이터 생성 중...')

    for (let month = 1; month <= 12; month++) {
      await prisma.monthlySummary.create({
        data: {
          clinicId,
          year: 2026,
          month,
          totalRevenue: month * 5000000,      // 총매출 (월별 증가)
          totalExpense: month * 1000000,      // 총지출
          netProfit: month * 4000000,         // 순이익
          cashIncome: month * 2000000,        // 현금수입
          cardIncome: month * 2500000,        // 카드수입
          insuranceClaim: month * 500000,     // 보험청구
          nonInsuranceRevenue: month * 4500000 // 비보험매출
        }
      })
      console.log(`   ✅ ${month}월 데이터 생성 (총매출: ${(month * 5000000).toLocaleString()}원)`)
    }

    console.log('\n🎉 테스트 데이터 생성 완료!')
    console.log('📈 이제 PEI 보고서와 대시보드에서 연간 데이터를 확인할 수 있습니다.')

  } catch (error) {
    console.error('❌ 생성 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestAnnualData()