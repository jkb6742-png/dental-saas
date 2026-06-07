require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function fixTimeData() {
  try {
    console.log('🔧 시간 데이터 수정 작업 시작...\n');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const clinicId = 'cmpyssy9c055qmwugjrq9dmvh';

    console.log('1️⃣ 현재 잘못된 접수 데이터 확인...');
    const badRecordsCount = await prisma.receptionRecord.count({
      where: { clinicId }
    });
    console.log(`❌ 삭제할 잘못된 레코드: ${badRecordsCount}개`);

    console.log('\n2️⃣ 잘못된 접수 데이터 삭제...');
    const deleteResult = await prisma.receptionRecord.deleteMany({
      where: { clinicId }
    });
    console.log(`✅ 삭제 완료: ${deleteResult.count}개 레코드`);

    console.log('\n3️⃣ 전체접수수납목록 파일 상태 확인...');
    const comprehensiveFiles = await prisma.fileUpload.findMany({
      where: {
        clinicId,
        category: 'COMPREHENSIVE_PATIENTS',
        status: 'COMPLETED'
      },
      orderBy: { uploadedAt: 'desc' }
    });

    if (comprehensiveFiles.length === 0) {
      console.log('❌ 처리할 수 있는 전체접수수납목록 파일이 없습니다.');
      console.log('💡 새로운 전체접수수납목록.xlsx 파일을 업로드해주세요.');
      return;
    }

    const latestFile = comprehensiveFiles[0];
    console.log(`📄 최신 파일: ${latestFile.fileName} (ID: ${latestFile.id})`);
    console.log(`📂 파일 경로: ${latestFile.filePath}`);

    // 파일이 실제로 존재하는지 확인
    const fs = require('fs');
    if (!fs.existsSync(latestFile.filePath)) {
      console.log('❌ 파일이 실제 경로에 존재하지 않습니다.');
      console.log('💡 전체접수수납목록.xlsx 파일을 다시 업로드해주세요.');
      return;
    }

    console.log('\n4️⃣ 파일 상태를 PENDING으로 변경...');
    await prisma.fileUpload.update({
      where: { id: latestFile.id },
      data: {
        status: 'PENDING',
        errorMessage: null,
        recordCount: null,
        processedAt: null
      }
    });

    console.log('✅ 파일 상태 업데이트 완료');
    console.log('\n🚀 이제 웹 인터페이스에서 해당 파일의 "처리" 버튼을 클릭하여');
    console.log('   수정된 시간 파싱 로직으로 데이터를 다시 처리하세요!');

    await prisma.$disconnect();
    await pool.end();

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

fixTimeData();