// 간단한 업로드 디버깅
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function simpleUploadDebug() {
  try {
    console.log('🔍 업로드 상태 간단 확인...\n')

    // 1. 최근 파일 업로드 확인 (올바른 필드명 사용)
    console.log('📁 최근 업로드 파일:')
    const uploads = await prisma.fileUpload.findMany({
      orderBy: {
        uploadedAt: 'desc'  // createdAt -> uploadedAt
      },
      take: 5,
      select: {
        fileName: true,
        category: true,
        status: true,
        errorMessage: true,
        recordCount: true,
        uploadedAt: true  // uploadedAt 사용
      }
    })

    if (uploads.length === 0) {
      console.log('   업로드된 파일이 없습니다.')
    } else {
      uploads.forEach((upload, idx) => {
        const time = upload.uploadedAt.toLocaleString('ko-KR')
        const status = upload.status === 'COMPLETED' ? '✅' :
                     upload.status === 'PROCESSING' ? '⏳' :
                     upload.status === 'FAILED' ? '❌' :
                     upload.status === 'PENDING' ? '📝' : '⚠️'

        console.log(`   ${idx + 1}. ${upload.fileName}`)
        console.log(`      카테고리: ${upload.category}`)
        console.log(`      상태: ${status} ${upload.status}`)
        console.log(`      처리 건수: ${upload.recordCount || 0}건`)
        console.log(`      시간: ${time}`)
        if (upload.errorMessage) {
          console.log(`      ❌ 에러: ${upload.errorMessage}`)
        }
        console.log()
      })
    }

    // 2. 연간장부 관련 데이터 확인
    console.log('📊 MonthlySummary 데이터:')
    const summaryCount = await prisma.monthlySummary.count()
    console.log(`   총 ${summaryCount}건\n`)

    // 3. 파일명 패턴 테스트
    console.log('🧪 연간장부 파일명 패턴 테스트:')
    const testFiles = [
      '2026년연간장부.xlsx',
      '연간장부.xlsx',
      '2025년연간장부.xlsx'
    ]

    testFiles.forEach(filename => {
      const detected = filename.toLowerCase().includes('연간장부')
      console.log(`   ${detected ? '✅' : '❌'} ${filename}`)
    })

    console.log('\n💡 연간장부 업로드 체크리스트:')
    console.log('   1. 파일명에 "연간장부" 포함되어야 함')
    console.log('   2. 업로드 후 "처리" 버튼 클릭 필요')
    console.log('   3. 처리 상태가 COMPLETED가 되어야 함')
    console.log('   4. 에러 메시지가 없어야 함')

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

simpleUploadDebug()