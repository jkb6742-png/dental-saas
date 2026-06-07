// 업로드 파일 강제 전체 삭제
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function forceClearAllUploads() {
  try {
    console.log('🗑️ 모든 업로드 파일 강제 삭제 시작...\n')

    // FileUpload 테이블 완전 삭제
    const deletedUploads = await prisma.fileUpload.deleteMany({})
    console.log(`📁 FileUpload 삭제: ${deletedUploads.count}개`)

    // UploadLog 삭제
    const deletedLogs = await prisma.uploadLog.deleteMany({})
    console.log(`📝 UploadLog 삭제: ${deletedLogs.count}개`)

    console.log('\n✅ 모든 업로드 기록 완전 삭제 완료!')
    console.log('🎉 이제 파일을 다시 업로드할 수 있습니다!')

  } catch (error) {
    console.error('❌ 삭제 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

forceClearAllUploads()