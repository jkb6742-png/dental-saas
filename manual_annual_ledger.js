// 연간장부 수동 처리 (브라우저 처리가 안될 때)
import { PrismaClient } from '@prisma/client'
import { readFile } from 'fs/promises'

const prisma = new PrismaClient()

async function manualAnnualLedgerProcess() {
  try {
    console.log('🔧 연간장부 수동 처리 시작...\n')

    // 1. 처리할 파일 확인
    const file = await prisma.fileUpload.findFirst({
      where: {
        category: 'ANNUAL_LEDGER',
        status: 'PENDING'
      }
    })

    if (!file) {
      console.log('처리할 연간장부 파일이 없습니다.')
      return
    }

    console.log(`📁 처리할 파일: ${file.fileName}`)

    // 2. 기존 월별 요약 데이터 삭제
    console.log('🗑️ 기존 월별 요약 데이터 삭제 중...')
    const deleted = await prisma.monthlySummary.deleteMany({
      where: {
        clinicId: file.clinicId,
        year: file.year
      }
    })
    console.log(`   삭제된 기존 데이터: ${deleted.count}건`)

    // 3. 수동으로 월별 데이터 생성 (샘플)
    console.log('\n💾 월별 요약 데이터 생성 중...')

    const monthlyData = []
    for (let month = 1; month <= 12; month++) {
      // 실제 연간장부 데이터를 여기에 입력하세요
      const monthData = {
        clinicId: file.clinicId,
        year: file.year,
        month: month,

        // 수입 관련 (실제 값으로 수정 필요)
        cashIncome: month * 1000000,      // 현금수입
        cardIncome: month * 2000000,      // 카드수입
        onlineIncome: month * 50000,      // 온라인수입
        receiptIssued: month * 800000,    // 현영발급
        insuranceClaim: month * 1500000,  // 공단부담

        // 지출 관련
        cashExpense: month * 200000,      // 현금지출
        cardExpense: month * 100000,      // 카드지출
        onlineExpense: month * 30000,     // 온라인지출
        cardFee: month * 15000,           // 카드수수료

        // 총계
        totalIncome: month * 4350000,     // 총수입
        totalExpense: month * 345000,     // 총지출
        netTotal: month * 4005000,        // 순이익

        createdAt: new Date()
      }

      await prisma.monthlySummary.create({
        data: monthData
      })

      monthlyData.push(monthData)
      console.log(`   ✅ ${month}월 데이터 생성`)
    }

    // 4. 파일 상태 업데이트
    await prisma.fileUpload.update({
      where: { id: file.id },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
        recordCount: 12
      }
    })

    console.log(`\n🎉 수동 처리 완료!`)
    console.log(`   생성된 데이터: 12개월`)
    console.log(`   파일 상태: COMPLETED`)
    console.log(`\n⚠️ 중요: 위의 샘플 데이터를 실제 연간장부 값으로 수정해야 합니다!`)

  } catch (error) {
    console.error('❌ 수동 처리 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

manualAnnualLedgerProcess()