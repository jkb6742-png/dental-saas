// 간단한 데이터 상태 확인
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function simpleCheck() {
  try {
    console.log('📊 핵심 데이터만 확인...\n')

    // 가장 중요한 테이블들만 확인
    const recordCount = await prisma.receptionRecord.count()
    const fileCount = await prisma.fileUpload.count()

    console.log(`🏥 접수기록: ${recordCount}개`)
    console.log(`📁 파일업로드: ${fileCount}개`)

    // 중복 확인 (2026년 5월만)
    if (recordCount > 0) {
      const may2026Count = await prisma.receptionRecord.count({
        where: {
          year: 2026,
          month: 5
        }
      })

      console.log(`📅 2026년 5월 데이터: ${may2026Count}개`)

      // 같은 환자가 같은 날짜에 여러 건 있는지 확인
      const duplicates = await prisma.receptionRecord.groupBy({
        by: ['chartNumber', 'patientName', 'receptionTime'],
        where: {
          year: 2026,
          month: 5
        },
        _count: {
          id: true
        },
        having: {
          id: {
            _count: {
              gt: 1
            }
          }
        }
      })

      if (duplicates.length > 0) {
        console.log(`🚨 5월 중복 데이터: ${duplicates.length}개 그룹`)
        console.log('상위 3개:')
        duplicates.slice(0, 3).forEach((dup, idx) => {
          const date = dup.receptionTime ? dup.receptionTime.toLocaleDateString() : '날짜없음'
          console.log(`   ${idx + 1}. ${dup.patientName} (${dup.chartNumber}) ${date} - ${dup._count.id}건`)
        })
      } else {
        console.log('✅ 5월 데이터 중복 없음')
      }
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

simpleCheck()