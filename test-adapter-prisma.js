require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function testConnection() {
  try {
    console.log('🔍 PostgreSQL 어댑터로 데이터베이스 연결 테스트...');

    // PostgreSQL Pool 생성
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // Prisma PostgreSQL 어댑터 생성
    const adapter = new PrismaPg(pool);

    // PrismaClient 생성 (어댑터 사용)
    const prisma = new PrismaClient({ adapter });

    // 연결 테스트
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
        take: 10,
        orderBy: { uploadedAt: 'desc' },
        select: {
          fileName: true,
          category: true,
          status: true,
          year: true,
          month: true,
          recordCount: true,
          errorMessage: true
        }
      });

      console.log('📊 최근 업로드된 파일들:');
      recentFiles.forEach((file, index) => {
        const date = `${file.year}년 ${file.month ? file.month + '월' : '연간'}`;
        const records = file.recordCount ? ` (${file.recordCount}개 레코드)` : '';
        const error = file.errorMessage ? ` ❌ ${file.errorMessage}` : '';
        console.log(`  ${index + 1}. ${file.fileName} (${file.category}) - ${file.status} - ${date}${records}${error}`);
      });
    }

    // 환자 통계 관련 데이터 확인
    console.log('\n🏥 환자 통계 데이터:');

    const ageDistCount = await prisma.ageDist.count();
    console.log(`  - 연령별분포: ${ageDistCount}개`);

    const regionDistCount = await prisma.regionDist.count();
    console.log(`  - 지역별분포: ${regionDistCount}개`);

    const receptionCount = await prisma.receptionRecord.count();
    console.log(`  - 접수기록: ${receptionCount}개`);

    // 업로드 로그 확인
    const logCount = await prisma.uploadLog.count();
    console.log(`  - 업로드 로그: ${logCount}개`);

    if (logCount > 0) {
      const recentLogs = await prisma.uploadLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          action: true,
          fileName: true,
          status: true,
          message: true,
          createdAt: true
        }
      });

      console.log('\n📋 최근 업로드 로그:');
      recentLogs.forEach((log, index) => {
        const message = log.message ? ` - ${log.message}` : '';
        console.log(`  ${index + 1}. ${log.action} | ${log.fileName} | ${log.status}${message}`);
      });
    }

    await prisma.$disconnect();
    await pool.end();

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.error('상세 오류:', error);
  }
}

testConnection();