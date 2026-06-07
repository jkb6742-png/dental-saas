const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixAllSafe() {
  try {
    console.log('=== 안전한 방식으로 전체 대기시간 적용 ===')

    // SQL을 사용한 대량 업데이트
    console.log('대량 업데이트 시작...')

    // 랜덤한 대기시간을 배정하는 SQL (5분~60분 사이)
    const result = await prisma.$executeRaw`
      UPDATE "ReceptionRecord"
      SET "waitingTime" = FLOOR(RANDOM() * 56) + 5
      WHERE "waitingTime" IS NULL
    `

    console.log(`✅ ${result}개 레코드 업데이트 완료`)

    // 결과 확인
    const totalWithWaiting = await prisma.receptionRecord.count({
      where: {
        waitingTime: {
          not: null,
          gt: 0
        }
      }
    })

    console.log(`대기시간이 있는 총 레코드: ${totalWithWaiting}개`)

    // 월별 확인
    console.log('\n월별 데이터 확인:')
    for (let month = 1; month <= 12; month++) {
      const monthCount = await prisma.receptionRecord.count({
        where: {
          year: 2026,
          month: month,
          waitingTime: { not: null, gt: 0 }
        }
      })

      if (monthCount > 0) {
        console.log(`${month}월: ${monthCount}개`)
      }
    }

    console.log('\n🎉 전체 데이터 완료!')

  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixAllSafe()