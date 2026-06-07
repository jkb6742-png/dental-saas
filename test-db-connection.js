require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔍 데이터베이스 연결 테스트...');

    // 간단한 연결 테스트
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ 데이터베이스 연결 성공!');

    // 클리닉 수 확인
    const clinicCount = await prisma.clinic.count();
    console.log(`📍 클리닉 수: ${clinicCount}개`);

    // 업로드된 파일 수 확인
    const fileCount = await prisma.fileUpload.count();
    console.log(`📄 업로드된 파일 수: ${fileCount}개`);

    if (fileCount > 0) {
      const recentFiles = await prisma.fileUpload.findMany({
        take: 5,
        orderBy: { uploadedAt: 'desc' },
        select: {
          fileName: true,
          category: true,
          status: true,
          uploadedAt: true
        }
      });

      console.log('\n📊 최근 업로드된 파일들:');
      recentFiles.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.fileName} (${file.category}) - ${file.status}`);
      });
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();