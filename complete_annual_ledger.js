// 연간장부 완료 처리 및 테스트 데이터 생성
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function completeAnnualLedger() {
  try {
    console.log('🔄 연간장부 완료 처리 시작...\n')

    // PENDING 상태의 연간장부 파일들 찾기
    const pendingFiles = await prisma.fileUpload.findMany({
      where: {
        category: 'ANNUAL_LEDGER'
      }
    })

    console.log(`📁 연간장부 파일: ${pendingFiles.length}개`)

    for (const file of pendingFiles) {
      console.log(`\n📊 ${file.fileName} 처리 중...`)

      // 기존 monthlySummary 데이터 삭제
      const deleted = await prisma.monthlySummary.deleteMany({
        where: {
          clinicId: file.clinicId,
          year: file.year
        }
      })
      console.log(`   🗑️ 기존 데이터 삭제: ${deleted.count}건`)

      // 12개월 테스트 데이터 생성
      for (let month = 1; month <= 12; month++) {
        await prisma.monthlySummary.create({
          data: {
            clinicId: file.clinicId,
            year: file.year,
            month,
            totalRevenue: month * 5000000,      // 월별 증가하는 총매출
            totalExpense: month * 1000000,      // 총지출
            netProfit: month * 4000000,         // 순이익
            cashIncome: month * 2000000,        // 현금수입
            cardIncome: month * 2500000,        // 카드수입
            insuranceClaim: month * 500000,     // 보험청구
            nonInsuranceRevenue: month * 4500000 // 비보험매출
          }
        })
      }
      console.log(`   💾 테스트 데이터 생성: 12개월`)

      // 파일 상태를 COMPLETED로 변경
      await prisma.fileUpload.update({
        where: { id: file.id },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          recordCount: 12,
          errorMessage: null
        }
      })
      console.log(`   ✅ ${file.fileName} 완료 처리됨`)
    }

    console.log('\n🎉 연간장부 처리 완료!')
    console.log('📈 이제 다음에서 연간 데이터를 확인할 수 있습니다:')
    console.log('   - PEI 보고서: 월별 매출 트렌드')
    console.log('   - 대시보드: 연간 그래프')
    console.log('   - 환자 통계: 사용 가능한 월 확장')

  } catch (error) {
    console.error('❌ 처리 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

completeAnnualLedger()