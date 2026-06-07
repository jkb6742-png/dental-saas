const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkUploadStatus() {
  try {
    console.log('=== 업로드 파일 상태 확인 ===')

    // 최근 업로드된 파일들 확인
    const fileUploads = await prisma.fileUpload.findMany({
      where: {
        category: 'COMPREHENSIVE_PATIENTS'
      },
      orderBy: {
        uploadedAt: 'desc'
      },
      take: 5
    })

    console.log(`전체접수수납목록 파일: ${fileUploads.length}개`)
    fileUploads.forEach((file, index) => {
      console.log(`${index + 1}. ${file.fileName} - 상태: ${file.status} - 처리된 행: ${file.recordCount}`)
      if (file.errorMessage) {
        console.log(`   오류: ${file.errorMessage}`)
      }
    })

    console.log('\n=== ReceptionRecord 데이터 확인 ===')

    // 실제 저장된 ReceptionRecord 확인
    const receptionCount = await prisma.receptionRecord.count({
      where: {
        year: 2026
      }
    })

    console.log(`2026년 총 ReceptionRecord: ${receptionCount}개`)

    // 대기시간이 있는 레코드 확인
    const waitingTimeCount = await prisma.receptionRecord.count({
      where: {
        year: 2026,
        waitingTime: {
          not: null,
          gt: 0
        }
      }
    })

    console.log(`대기시간 데이터가 있는 레코드: ${waitingTimeCount}개`)

    // 샘플 레코드 확인
    const sampleRecord = await prisma.receptionRecord.findFirst({
      where: {
        year: 2026
      },
      select: {
        receptionTime: true,
        waitingTime: true,
        patientType: true,
        patientName: true,
        clinicId: true
      }
    })

    if (sampleRecord) {
      console.log('\n=== 샘플 레코드 ===')
      console.log(`클리닉ID: ${sampleRecord.clinicId}`)
      console.log(`접수시간: ${sampleRecord.receptionTime}`)
      console.log(`대기시간: ${sampleRecord.waitingTime}분`)
      console.log(`환자유형: ${sampleRecord.patientType}`)
    }

  } catch (error) {
    console.error('확인 중 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUploadStatus()