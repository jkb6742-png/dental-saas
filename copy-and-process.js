require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function copyAndProcess() {
  try {
    console.log('🚀 실제 엑셀 파일 복사 및 처리 시작...\n');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const clinicId = 'cmpyssy9c055qmwugjrq9dmvh';

    // 1. 실제 파일 복사
    const sourceFile = 'C:\\Users\\jjang\\Desktop\\THINKLB - 중산사과나무치과\\2026\\7.신환,구환\\전체접수수납목록.xlsx';
    const uploadDir = path.join(process.cwd(), 'uploads', clinicId);
    const targetFile = path.join(uploadDir, '전체접수수납목록.xlsx');

    console.log('1️⃣ 파일 복사 중...');
    console.log(`📂 원본: ${sourceFile}`);
    console.log(`📂 대상: ${targetFile}`);

    // 디렉토리 생성
    fs.mkdirSync(uploadDir, { recursive: true });

    // 파일 복사
    fs.copyFileSync(sourceFile, targetFile);
    console.log('✅ 파일 복사 완료');

    // 2. 기존 잘못된 데이터 모두 삭제
    console.log('\n2️⃣ 기존 데이터 삭제...');
    const deleteResult = await prisma.receptionRecord.deleteMany({
      where: { clinicId }
    });
    console.log(`✅ 삭제 완료: ${deleteResult.count}개 레코드`);

    // 3. 파일 레코드 생성
    console.log('\n3️⃣ 파일 레코드 생성...');
    const fileRecord = await prisma.fileUpload.create({
      data: {
        clinicId,
        category: 'COMPREHENSIVE_PATIENTS',
        fileName: '전체접수수납목록.xlsx',
        originalName: '전체접수수납목록.xlsx',
        filePath: targetFile,
        fileSize: fs.statSync(targetFile).size,
        year: 2026,
        month: null, // 연간 데이터
        status: 'PENDING',
        checksum: `checksum-${Date.now()}`,
        recordCount: null
      }
    });

    console.log(`✅ 파일 레코드 생성 완료 (ID: ${fileRecord.id})`);

    console.log('\n🎉 준비 완료!');
    console.log(`📄 파일 ID: ${fileRecord.id}`);
    console.log('🌐 http://localhost:3000 에서 해당 파일의 "처리" 버튼을 클릭하세요!');

    await prisma.$disconnect();
    await pool.end();

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

copyAndProcess();