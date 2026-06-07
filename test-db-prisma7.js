require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

// Prisma 7 방식으로 클라이언트 초기화
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function testConnection() {
  try {
    console.log('🔍 데이터베이스 연결 테스트 (Prisma 7 방식)...');

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
          uploadedAt: true,
          year: true,
          month: true
        }
      });

      console.log('\n📊 최근 업로드된 파일들:');
      recentFiles.forEach((file, index) => {
        const date = `${file.year}년 ${file.month ? file.month + '월' : '연간'}`;
        console.log(`  ${index + 1}. ${file.fileName} (${file.category}) - ${file.status} - ${date}`);
      });
    }

    // 환자 통계 관련 데이터 확인
    console.log('\n🏥 환자 통계 데이터:');

    const ageDistCount = await prisma.ageDist.count();
    console.log(`  - 연령별분포: ${ageDistCount}개`);

    const regionDistCount = await prisma.regionDist.count();
    console.log(`  - 지역별분포: ${regionDistCount}개`);

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.error('스택 트레이스:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();