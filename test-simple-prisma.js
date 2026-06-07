require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

// 기본 PrismaClient (설정은 prisma.config.ts에서 관리)
const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔍 데이터베이스 연결 테스트...');

    // 간단한 연결 테스트
    await prisma.$connect();
    console.log('✅ 데이터베이스 연결 성공!');

    // 클리닉 수 확인
    const clinicCount = await prisma.clinic.count();
    console.log(`📍 클리닉 수: ${clinicCount}개`);

    if (clinicCount > 0) {
      const clinics = await prisma.clinic.findMany({
        select: { id: true, name: true }
      });
      console.log('클리닉 목록:');
      clinics.forEach(clinic => console.log(`  - ${clinic.name} (${clinic.id})`));
    }

    // 업로드된 파일 수 확인
    const fileCount = await prisma.fileUpload.count();
    console.log(`\n📄 업로드된 파일 수: ${fileCount}개`);

    if (fileCount > 0) {
      const recentFiles = await prisma.fileUpload.findMany({
        take: 5,
        orderBy: { uploadedAt: 'desc' },
        select: {
          fileName: true,
          category: true,
          status: true,
          year: true,
          month: true
        }
      });

      console.log('📊 최근 업로드된 파일들:');
      recentFiles.forEach((file, index) => {
        const date = `${file.year}년 ${file.month ? file.month + '월' : '연간'}`;
        console.log(`  ${index + 1}. ${file.fileName} (${file.category}) - ${file.status} - ${date}`);
      });
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();