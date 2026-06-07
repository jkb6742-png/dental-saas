const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkClinicId() {
  try {
    console.log('=== 실제 사용 중인 클리닉ID 확인 ===')

    // 최신 데이터가 있는 클리닉ID들 확인
    const clinicIds = await prisma.receptionRecord.groupBy({
      by: ['clinicId'],
      _count: {
        id: true
      },
      where: {
        year: 2026
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    })

    console.log('클리닉별 레코드 수:')
    clinicIds.forEach((clinic, index) => {
      console.log(`${index + 1}. ${clinic.clinicId}: ${clinic._count.id}개`)
    })

    // 각 클리닉별 5월 데이터 확인
    console.log('\n=== 클리닉별 5월 대기시간 데이터 ===')
    for (const clinic of clinicIds.slice(0, 3)) { // 상위 3개만
      const mayData = await prisma.receptionRecord.count({
        where: {
          clinicId: clinic.clinicId,
          year: 2026,
          month: 5,
          waitingTime: {
            not: null,
            gt: 0
          }
        }
      })

      console.log(`${clinic.clinicId}: 5월 대기시간 데이터 ${mayData}개`)
    }

    // 가장 많은 데이터를 가진 클리닉으로 API 테스트
    const mainClinicId = clinicIds[0].clinicId
    console.log(`\n주 클리닉ID: ${mainClinicId}`)
    console.log('이 ID로 API 테스트하세요!')

  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkClinicId()