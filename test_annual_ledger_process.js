// 연간장부 처리 테스트
import { PrismaClient } from '@prisma/client'
import { readFile } from 'fs/promises'
import { parseExcel } from './src/lib/excel/parser.js'

const prisma = new PrismaClient()

async function testAnnualLedgerProcess() {
  try {
    console.log('🧪 연간장부 처리 테스트 시작...\n')

    // 1. PENDING 상태의 연간장부 파일 찾기
    const pendingFiles = await prisma.fileUpload.findMany({
      where: {
        category: 'ANNUAL_LEDGER',
        status: 'PENDING'
      }
    })

    console.log(`📁 PENDING 상태 연간장부 파일: ${pendingFiles.length}개`)

    if (pendingFiles.length === 0) {
      console.log('처리할 파일이 없습니다.')
      return
    }

    // 2. 첫 번째 파일로 테스트
    const testFile = pendingFiles[0]
    console.log(`🎯 테스트 파일: ${testFile.fileName}`)
    console.log(`   파일 경로: ${testFile.filePath}`)
    console.log(`   카테고리: ${testFile.category}`)

    // 3. 파일 존재 여부 확인
    let buffer
    try {
      buffer = await readFile(testFile.filePath)
      console.log(`✅ 파일 읽기 성공 (${buffer.length} bytes)`)
    } catch (error) {
      console.error(`❌ 파일 읽기 실패:`, error.message)
      return
    }

    // 4. 파일 파싱 테스트
    try {
      console.log('\n📊 파일 파싱 테스트...')
      const { type, rows } = parseExcel(buffer, testFile.fileName)

      console.log(`   감지된 타입: ${type}`)
      console.log(`   파싱된 행 수: ${rows.length}`)

      if (rows.length > 0) {
        console.log('   첫 번째 행 샘플:')
        console.log('  ', JSON.stringify(rows[0], null, 2))
      }
    } catch (error) {
      console.error(`❌ 파싱 실패:`, error.message)
      return
    }

    // 5. 실제 처리 시뮬레이션
    console.log('\n🔄 실제 처리 시뮬레이션...')

    // API 호출 시뮬레이션
    try {
      const response = await fetch(`http://localhost:3001/api/uploads/${testFile.id}/process`, {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ 처리 성공:', result)
      } else {
        const error = await response.text()
        console.error('❌ 처리 실패:', error)
      }
    } catch (error) {
      console.error('❌ API 호출 실패:', error.message)
    }

  } catch (error) {
    console.error('❌ 테스트 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAnnualLedgerProcess()