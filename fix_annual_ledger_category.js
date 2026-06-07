// 연간장부 카테고리 수정 스크립트
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixAnnualLedgerCategory() {
  try {
    console.log('🔧 연간장부 카테고리 수정 시작...\n')

    // 1. 잘못 분류된 연간장부 파일들 찾기
    const wrongFiles = await prisma.fileUpload.findMany({
      where: {
        AND: [
          { category: 'MONTHLY_LEDGER' },
          {
            OR: [
              { fileName: { contains: '연간장부' } },
              { fileName: { contains: '연간' } }
            ]
          }
        ]
      }
    })

    console.log(`📁 잘못 분류된 연간장부 파일들: ${wrongFiles.length}개`)

    if (wrongFiles.length === 0) {
      console.log('✅ 수정할 파일이 없습니다.')
      return
    }

    // 2. 각 파일 정보 출력
    wrongFiles.forEach((file, idx) => {
      console.log(`   ${idx + 1}. ${file.fileName} (현재: ${file.category})`)
    })

    // 3. 카테고리 수정
    console.log('\n🔄 카테고리를 ANNUAL_LEDGER로 수정 중...')

    for (const file of wrongFiles) {
      await prisma.fileUpload.update({
        where: { id: file.id },
        data: {
          category: 'ANNUAL_LEDGER',
          status: 'PENDING'  // 다시 처리할 수 있도록 상태도 변경
        }
      })
      console.log(`   ✅ ${file.fileName} → ANNUAL_LEDGER`)
    }

    console.log('\n🎯 수정 완료! 이제 다시 처리해주세요:')
    console.log('1. 업로드 페이지로 이동')
    console.log('2. 해당 파일의 "처리" 버튼 클릭')
    console.log('3. ANNUAL_LEDGER 카테고리로 올바르게 처리됨')

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixAnnualLedgerCategory()