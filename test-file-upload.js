require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function testFileSystem() {
  try {
    console.log('🔍 파일 시스템 및 업로드 테스트...');

    // PostgreSQL Pool 생성
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    // 업로드 디렉토리 확인
    const uploadsDir = path.join(process.cwd(), 'uploads');
    console.log('📂 업로드 디렉토리:', uploadsDir);
    console.log('📂 존재 여부:', fs.existsSync(uploadsDir));

    if (fs.existsSync(uploadsDir)) {
      const contents = fs.readdirSync(uploadsDir, { withFileTypes: true });
      console.log('📂 업로드 디렉토리 내용:');
      contents.forEach(item => {
        console.log(`  ${item.isDirectory() ? '📁' : '📄'} ${item.name}`);
      });
    }

    // 클리닉별 디렉토리 확인
    const clinicId = 'cmpyssy9c055qmwugjrq9dmvh';
    const clinicDir = path.join(uploadsDir, clinicId);
    console.log(`\n📂 클리닉 디렉토리: ${clinicDir}`);
    console.log('📂 존재 여부:', fs.existsSync(clinicDir));

    if (fs.existsSync(clinicDir)) {
      const files = fs.readdirSync(clinicDir);
      console.log(`📄 클리닉 파일 수: ${files.length}개`);
      files.forEach((file, index) => {
        const filePath = path.join(clinicDir, file);
        const stats = fs.statSync(filePath);
        console.log(`  ${index + 1}. ${file} (${stats.size} bytes)`);
      });
    }

    // DB에서 PENDING 상태 파일들 확인
    console.log('\n🔍 DB에서 PENDING 상태 파일들 확인...');
    const pendingFiles = await prisma.fileUpload.findMany({
      where: {
        clinicId,
        status: 'PENDING'
      },
      orderBy: { uploadedAt: 'desc' }
    });

    console.log(`📊 PENDING 상태 파일: ${pendingFiles.length}개`);
    pendingFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.fileName}`);
      console.log(`     경로: ${file.filePath}`);
      console.log(`     존재: ${fs.existsSync(file.filePath) ? '✅' : '❌'}`);
    });

    await prisma.$disconnect();
    await pool.end();

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  }
}

testFileSystem();