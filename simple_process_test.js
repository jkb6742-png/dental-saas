// 간단한 연간장부 처리 테스트
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function simpleProcessTest() {
  try {
    console.log('🔄 연간장부 처리 API 테스트...\n')

    // 1. PENDING 상태의 연간장부 파일 찾기
    const pendingFiles = await prisma.fileUpload.findMany({
      where: {
        category: 'ANNUAL_LEDGER',
        status: 'PENDING'
      }
    })

    console.log(`📁 처리 대기 중인 연간장부: ${pendingFiles.length}개`)

    if (pendingFiles.length === 0) {
      console.log('처리할 파일이 없습니다.')
      return
    }

    // 2. 첫 번째 파일 처리 시도
    const testFile = pendingFiles[0]
    console.log(`🎯 처리할 파일: ${testFile.fileName}`)
    console.log(`   ID: ${testFile.id}`)
    console.log(`   카테고리: ${testFile.category}`)

    // 3. 서버가 실행 중인지 확인
    try {
      console.log('\n🌐 서버 상태 확인 중...')

      const healthCheck = await fetch('http://localhost:3001/api/upload')
      console.log(`   서버 응답: ${healthCheck.status} ${healthCheck.statusText}`)

    } catch (error) {
      console.error('❌ 서버에 연결할 수 없습니다. 개발 서버가 실행 중인지 확인하세요.')
      console.error('   명령어: npm run dev')
      return
    }

    // 4. 처리 API 호출
    console.log('\n📤 파일 처리 API 호출 중...')

    const processResponse = await fetch(`http://localhost:3001/api/uploads/${testFile.id}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    console.log(`   응답 상태: ${processResponse.status} ${processResponse.statusText}`)

    const responseText = await processResponse.text()
    console.log(`   응답 내용: ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`)

    // 5. 처리 후 상태 확인
    console.log('\n🔍 처리 후 상태 확인...')

    const updatedFile = await prisma.fileUpload.findUnique({
      where: { id: testFile.id }
    })

    if (updatedFile) {
      console.log(`   상태: ${updatedFile.status}`)
      console.log(`   처리 건수: ${updatedFile.recordCount || 0}건`)
      if (updatedFile.errorMessage) {
        console.log(`   에러 메시지: ${updatedFile.errorMessage}`)
      }
    }

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

simpleProcessTest()