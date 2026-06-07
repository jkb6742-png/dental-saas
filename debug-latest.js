const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function debugLatest() {
  try {
    // 최신 업로드 파일 정보
    const latestFile = await prisma.fileUpload.findFirst({
      where: {
        category: 'COMPREHENSIVE_PATIENTS',
        status: 'COMPLETED'
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    })

    console.log('=== 최신 파일 정보 ===')
    console.log('ID:', latestFile.id)
    console.log('파일명:', latestFile.fileName)
    console.log('상태:', latestFile.status)
    console.log('처리된 행:', latestFile.recordCount)

    // 이 파일 업로드 시간 이후의 레코드들만 확인
    const recentRecords = await prisma.receptionRecord.findMany({
      where: {
        createdAt: {
          gte: latestFile.uploadedAt
        }
      },
      take: 10,
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('\n=== 최신 업로드 후 레코드들 ===')
    console.log(`총 ${recentRecords.length}개 최신 레코드`)

    recentRecords.forEach((record, idx) => {
      console.log(`\n${idx + 1}. ID: ${record.id.slice(-8)}`)
      console.log(`   접수시간: ${record.receptionTime}`)
      console.log(`   대기시간: ${record.waitingTime} (${typeof record.waitingTime})`)
      console.log(`   환자유형: ${record.patientType}`)
      console.log(`   환자명: ${record.patientName}`)

      // 생성 시간도 확인
      console.log(`   생성시간: ${record.createdAt}`)
    })

    // 대기시간이 있는 레코드가 있는지 확인
    const hasWaitingTime = await prisma.receptionRecord.count({
      where: {
        createdAt: {
          gte: latestFile.uploadedAt
        },
        waitingTime: {
          not: null,
          gt: 0
        }
      }
    })

    console.log(`\n=== 대기시간 통계 ===`)
    console.log(`최신 업로드 후 대기시간 있는 레코드: ${hasWaitingTime}개`)

  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugLatest()