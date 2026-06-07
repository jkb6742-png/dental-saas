// 업로드 문제 디버깅 스크립트
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugUploadIssue() {
  try {
    console.log('🔍 업로드 문제 디버깅 시작...\n')

    // 1. 최근 파일 업로드 기록 확인
    console.log('📁 최근 파일 업로드 기록:')
    const recentUploads = await prisma.fileUpload.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 10,
      select: {
        id: true,
        filename: true,
        category: true,
        status: true,
        errorMessage: true,
        recordCount: true,
        createdAt: true
      }
    })

    if (recentUploads.length === 0) {
      console.log('   📝 업로드 기록이 없습니다.')
    } else {
      recentUploads.forEach((upload, idx) => {
        const time = upload.createdAt.toLocaleString('ko-KR')
        const status = upload.status === 'COMPLETED' ? '✅' :
                     upload.status === 'PROCESSING' ? '⏳' :
                     upload.status === 'FAILED' ? '❌' : '⚠️'

        console.log(`   ${idx + 1}. ${upload.filename}`)
        console.log(`      카테고리: ${upload.category}`)
        console.log(`      상태: ${status} ${upload.status}`)
        console.log(`      처리 건수: ${upload.recordCount || 0}건`)
        console.log(`      시간: ${time}`)
        if (upload.errorMessage) {
          console.log(`      에러: ${upload.errorMessage}`)
        }
        console.log()
      })
    }

    // 2. 현재 monthlySummary 데이터 확인
    console.log('📊 현재 monthlySummary 데이터:')
    const summaryCount = await prisma.monthlySummary.count()
    console.log(`   총 ${summaryCount}건`)

    if (summaryCount > 0) {
      const summaryData = await prisma.monthlySummary.findMany({
        orderBy: [
          { year: 'desc' },
          { month: 'desc' }
        ],
        take: 5,
        select: {
          year: true,
          month: true,
          totalIncome: true,
          netTotal: true,
          createdAt: true
        }
      })

      summaryData.forEach((data, idx) => {
        console.log(`   ${idx + 1}. ${data.year}년 ${data.month}월 - 총수입: ${data.totalIncome?.toLocaleString() || 0}원, 순이익: ${data.netTotal?.toLocaleString() || 0}원`)
      })
    }

    // 3. 연간장부 패턴 테스트
    console.log('\n🧪 파일명 패턴 테스트:')
    const testFilenames = [
      '2026년연간장부.xlsx',
      '2025년연간장부.xlsx',
      '연간장부.xlsx',
      '2026연간장부.xlsx',
      '연간장부2026.xlsx'
    ]

    testFilenames.forEach(filename => {
      const isDetected = filename.toLowerCase().includes('연간장부')
      console.log(`   ${isDetected ? '✅' : '❌'} ${filename}`)
    })

    // 4. 업로드 로그 확인
    console.log('\n📝 업로드 처리 로그:')
    const logs = await prisma.uploadLog.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      select: {
        filename: true,
        fileType: true,
        status: true,
        errorMessage: true,
        recordCount: true,
        createdAt: true
      }
    })

    if (logs.length === 0) {
      console.log('   처리 로그가 없습니다.')
    } else {
      logs.forEach((log, idx) => {
        const time = log.createdAt.toLocaleString('ko-KR')
        console.log(`   ${idx + 1}. ${log.filename} (${log.fileType}) - ${log.status} - ${log.recordCount || 0}건 - ${time}`)
        if (log.errorMessage) {
          console.log(`      에러: ${log.errorMessage}`)
        }
      })
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugUploadIssue()