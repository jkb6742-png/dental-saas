// 잘못된 카테고리 즉시 수정
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixWrongCategory() {
  try {
    console.log('🔧 잘못된 카테고리 즉시 수정...\n')

    // "연간장부"가 포함된 파일인데 MONTHLY_LEDGER로 잘못 분류된 것들 찾기
    const wrongFiles = await prisma.fileUpload.findMany({
      where: {
        AND: [
          { category: 'MONTHLY_LEDGER' },
          {
            OR: [
              { fileName: { contains: '연간장부' } },
              { fileName: { contains: '2026연간장부' } },
              { fileName: { contains: '연간' } }
            ]
          }
        ]
      }
    })

    console.log(`📁 수정할 파일: ${wrongFiles.length}개`)

    for (const file of wrongFiles) {
      console.log(`🔄 ${file.fileName} 수정 중...`)

      await prisma.fileUpload.update({
        where: { id: file.id },
        data: {
          category: 'ANNUAL_LEDGER',
          status: 'PENDING'  // 다시 처리할 수 있도록
        }
      })

      console.log(`   ✅ ${file.fileName} → ANNUAL_LEDGER (PENDING)`)
    }

    console.log('\n🎉 카테고리 수정 완료!')
    console.log('📋 이제 할 일:')
    console.log('   1. 브라우저 새로고침')
    console.log('   2. 업로드 페이지에서 "처리" 버튼 클릭')
    console.log('   3. 정상 처리 확인')

  } catch (error) {
    console.error('❌ 수정 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixWrongCategory()