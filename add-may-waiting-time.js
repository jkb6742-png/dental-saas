const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// 대기시간 파싱 함수
function parseWaitingTime(value) {
  if (!value) return null

  const str = String(value).trim()
  const match = str.match(/(\d+)\s*분?/)
  if (match) {
    return parseInt(match[1])
  }

  const num = parseFloat(str)
  if (!isNaN(num)) {
    return num
  }

  return null
}

async function addMayWaitingTime() {
  try {
    console.log('=== 5월 대기시간 데이터 추가 ===')

    // 5월 레코드 중 대기시간이 null인 것들 찾기
    const mayRecords = await prisma.receptionRecord.findMany({
      where: {
        year: 2026,
        month: 5,
        waitingTime: null
      },
      take: 50, // 50개 레코드에 추가
      orderBy: {
        receptionTime: 'asc'
      }
    })

    console.log(`5월 레코드 중 ${mayRecords.length}개에 대기시간 추가`)

    // 다양한 대기시간 데이터 (실제 형태와 유사)
    const waitingTimes = [
      '15분', '23분', '8분', '31분', '12분', '27분', '6분', '19분', '34분', '11분',
      '25분', '17분', '29분', '9분', '21분', '13분', '32분', '7분', '26분', '14분',
      '18분', '35분', '10분', '22분', '16분', '28분', '5분', '20분', '33분', '12분',
      '24분', '15분', '30분', '8분', '19분', '11분', '27분', '6분', '23분', '17분',
      '31분', '14분', '26분', '9분', '21분', '13분', '29분', '7분', '25분', '16분'
    ]

    for (let i = 0; i < mayRecords.length; i++) {
      const record = mayRecords[i]
      const waitingTimeStr = waitingTimes[i % waitingTimes.length]
      const waitingTime = parseWaitingTime(waitingTimeStr)

      await prisma.receptionRecord.update({
        where: { id: record.id },
        data: { waitingTime }
      })

      if (i < 10) { // 처음 10개만 로그
        console.log(`${i + 1}. ${record.patientName}: "${waitingTimeStr}" → ${waitingTime}분 (${record.receptionTime.toLocaleDateString()})`)
      }

      if ((i + 1) % 10 === 0) {
        console.log(`... ${i + 1}개 처리 완료`)
      }
    }

    console.log('\n=== 5월 업데이트 결과 확인 ===')

    // 5월 대기시간 통계
    const mayWaitingStats = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total_records,
        COUNT(waiting_time) as has_waiting_time,
        MIN(waiting_time) as min_waiting,
        MAX(waiting_time) as max_waiting,
        AVG(waiting_time) as avg_waiting
      FROM "ReceptionRecord"
      WHERE year = 2026 AND month = 5 AND waiting_time IS NOT NULL
    `

    console.log('5월 대기시간 통계:', mayWaitingStats[0])
    console.log('\n✅ 5월 데이터 준비 완료! 환자통계 페이지에서 확인하세요.')

  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addMayWaitingTime()