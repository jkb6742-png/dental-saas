const { PrismaClient } = require('@prisma/client')

async function checkUploadedFiles() {
  const prisma = new PrismaClient()

  try {
    console.log('=== 업로드된 파일들 확인 ===')

    // 월간장부 관련 파일들 조회
    const annualLedgerFiles = await prisma.fileUpload.findMany({
      where: {
        category: 'ANNUAL_LEDGER'
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    })

    console.log(`\n월간/연간 장부 파일: ${annualLedgerFiles.length}개`)
    annualLedgerFiles.forEach(file => {
      console.log(`- ${file.fileName} (${file.status}) - ${file.year}년 업로드: ${file.uploadedAt.toLocaleDateString()}`)
    })

    // 월간장부 파일들
    const monthlyLedgerFiles = await prisma.fileUpload.findMany({
      where: {
        category: 'MONTHLY_LEDGER'
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    })

    console.log(`\n월간장부 파일: ${monthlyLedgerFiles.length}개`)
    monthlyLedgerFiles.forEach(file => {
      console.log(`- ${file.fileName} (${file.status}) - ${file.year}년 ${file.month}월 업로드: ${file.uploadedAt.toLocaleDateString()}`)
    })

    // 전체 파일 카테고리 확인
    const allCategories = await prisma.fileUpload.groupBy({
      by: ['category'],
      _count: {
        category: true
      }
    })

    console.log(`\n전체 업로드 파일 카테고리:`)
    allCategories.forEach(cat => {
      console.log(`- ${cat.category}: ${cat._count.category}개`)
    })

    // 최근 업로드 파일들
    const recentFiles = await prisma.fileUpload.findMany({
      orderBy: {
        uploadedAt: 'desc'
      },
      take: 10
    })

    console.log(`\n최근 업로드된 파일 10개:`)
    recentFiles.forEach(file => {
      console.log(`- ${file.fileName} (${file.category}) - ${file.status} - ${file.uploadedAt.toLocaleDateString()}`)
    })

  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUploadedFiles()