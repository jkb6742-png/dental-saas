// 모든 업로드 관련 데이터 초기화
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetEverything() {
  try {
    console.log('🔥 모든 업로드 관련 데이터 완전 초기화...\n')

    // 1. 모든 업로드 파일 삭제
    const deletedFiles = await prisma.fileUpload.deleteMany({})
    console.log(`📁 FileUpload 삭제: ${deletedFiles.count}개`)

    // 2. 업로드 로그 삭제
    const deletedLogs = await prisma.uploadLog.deleteMany({})
    console.log(`📝 UploadLog 삭제: ${deletedLogs.count}개`)

    // 3. 모든 데이터 테이블도 초기화
    const deletedSummary = await prisma.monthlySummary.deleteMany({})
    console.log(`📊 MonthlySummary 삭제: ${deletedSummary.count}건`)

    const deletedRecords = await prisma.receptionRecord.deleteMany({})
    console.log(`🏥 ReceptionRecord 삭제: ${deletedRecords.count}건`)

    const deletedDaily = await prisma.dailyLedger.deleteMany({})
    console.log(`📅 DailyLedger 삭제: ${deletedDaily.count}건`)

    console.log('\n🎉 완전 초기화 완료!')
    console.log('✨ 이제 깨끗한 상태에서 다시 시작할 수 있습니다!')
    console.log('📋 할 일:')
    console.log('   1. 브라우저 새로고침 (F5)')
    console.log('   2. 업로드 페이지에서 파일 다시 업로드')
    console.log('   3. 정상 작동 확인')

  } catch (error) {
    console.error('❌ 초기화 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

resetEverything()