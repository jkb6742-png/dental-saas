require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const XLSX = require('xlsx');

async function directImport() {
  console.log('🔥 직접 처리 시작 - 기존 시스템 무시하고 바로 처리');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const clinicId = 'cmpyssy9c055qmwugjrq9dmvh';

    // 1. 기존 데이터 삭제
    console.log('1️⃣ 기존 데이터 삭제...');
    await prisma.receptionRecord.deleteMany({ where: { clinicId } });
    console.log('✅ 삭제 완료');

    // 2. 엑셀 파일 직접 읽기
    const filePath = 'C:\\Users\\jjang\\Desktop\\THINKLB - 중산사과나무치과\\2026\\7.신환,구환\\전체접수수납목록.xlsx';
    console.log('2️⃣ 엑셀 파일 읽기...');
    console.log(`📂 ${filePath}`);

    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

    console.log(`📊 총 ${data.length}행 읽음`);

    // 3. 데이터 직접 처리 (헤더 제외)
    console.log('3️⃣ 데이터 직접 처리...');
    let processed = 0;
    let failed = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      try {
        // 접수시각 파싱 - 문자열 "2026-05-11 16:55:56" 형태
        const timeStr = row[0];
        if (!timeStr) continue;

        const receptionTime = new Date(timeStr);
        if (isNaN(receptionTime.getTime())) continue;

        // 첫 10개 상세 로그
        if (processed < 10) {
          console.log(`  [${processed + 1}] "${timeStr}" → ${receptionTime.getHours()}:${receptionTime.getMinutes().toString().padStart(2,'0')}`);
        }

        // 데이터베이스에 직접 삽입
        await prisma.receptionRecord.create({
          data: {
            clinicId,
            year: receptionTime.getFullYear(),
            month: receptionTime.getMonth() + 1,
            receptionTime,
            status: String(row[1] || ''),
            chartNumber: String(row[2] || ''),
            patientName: String(row[3] || ''),
            ageGender: String(row[4] || ''),
            insuranceType: String(row[5] || ''),
            patientType: String(row[6] || '').includes('신') ? '신환' : '구환',
            waitingTime: parseFloat(row[8]) || 0,
            doctor: String(row[12] || ''),
            totalRevenue: parseFloat(row[20]) || 0,
            insuranceCoverage: parseFloat(row[21]) || 0,
            patientPayment: parseFloat(row[22]) || 0,
            nonInsurance: parseFloat(row[23]) || 0,
            cardPayment: parseFloat(row[26]) || 0,
            cashPayment: parseFloat(row[27]) || 0,
            onlinePayment: parseFloat(row[28]) || 0,
            dailyArrears: parseFloat(row[31]) || 0,
            totalArrears: parseFloat(row[32]) || 0,
            visitRoute: String(row[35] || '')
          }
        });

        processed++;

        // 진행상황 표시
        if (processed % 500 === 0) {
          console.log(`  📊 진행: ${processed}개 처리됨`);
        }

      } catch (error) {
        failed++;
        if (failed < 5) {
          console.log(`  ❌ 행 ${i + 1} 실패: ${error.message}`);
        }
      }
    }

    console.log('\n🎉 직접 처리 완료!');
    console.log(`✅ 성공: ${processed}개`);
    console.log(`❌ 실패: ${failed}개`);

    // 4. 시간 분포 확인
    console.log('\n4️⃣ 시간 분포 확인...');
    const timeCheck = await prisma.receptionRecord.findMany({
      where: { clinicId },
      select: { receptionTime: true, patientName: true },
      take: 20,
      orderBy: { receptionTime: 'desc' }
    });

    console.log('최근 20개 레코드 시간:');
    timeCheck.forEach((record, i) => {
      const time = new Date(record.receptionTime);
      console.log(`  ${i + 1}. ${record.patientName}: ${time.getHours()}:${time.getMinutes().toString().padStart(2,'0')}`);
    });

    await prisma.$disconnect();
    await pool.end();

  } catch (error) {
    console.error('❌ 직접 처리 실패:', error);
  }
}

directImport();