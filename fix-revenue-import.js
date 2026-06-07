require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const XLSX = require('xlsx');

async function fixRevenueImport() {
  console.log('🔧 매출 데이터 수정 처리 시작...');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const clinicId = 'cmpyssy9c055qmwugjrq9dmvh';

    // 1. 기존 데이터 삭제
    console.log('1️⃣ 기존 데이터 삭제...');
    await prisma.receptionRecord.deleteMany({ where: { clinicId } });
    console.log('✅ 삭제 완료');

    // 2. 엑셀 파일 다시 읽기
    const filePath = 'C:\\Users\\jjang\\Desktop\\THINKLB - 중산사과나무치과\\2026\\7.신환,구환\\전체접수수납목록.xlsx';
    console.log('2️⃣ 엑셀 파일 읽기...');
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

    console.log(`📊 총 ${data.length}행 읽음`);

    // 쉼표 제거하고 숫자로 변환하는 함수
    function parseKoreanNumber(value) {
      if (!value) return 0;
      const str = String(value).replace(/,/g, ''); // 쉼표 제거
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    }

    // 3. 수정된 데이터 처리
    console.log('3️⃣ 수정된 매출 파싱으로 데이터 처리...');
    let processed = 0;
    let failed = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      try {
        // 접수시각 파싱
        const timeStr = row[0];
        if (!timeStr) continue;

        const receptionTime = new Date(timeStr);
        if (isNaN(receptionTime.getTime())) continue;

        // 매출 데이터를 쉼표 제거하고 파싱
        const totalRevenue = parseKoreanNumber(row[20]);          // 총진료비
        const insuranceCoverage = parseKoreanNumber(row[21]);     // 공단부담
        const patientPayment = parseKoreanNumber(row[22]);        // 본인부담
        const nonInsurance = parseKoreanNumber(row[23]);          // 비급여
        const cardPayment = parseKoreanNumber(row[26]);           // 카드수납
        const cashPayment = parseKoreanNumber(row[27]);           // 현금수납
        const onlinePayment = parseKoreanNumber(row[28]);         // 기타(온라인)
        const dailyArrears = parseKoreanNumber(row[31]);          // 당일미수
        const totalArrears = parseKoreanNumber(row[32]);          // 총미수금

        // 처음 10개는 상세 로그
        if (processed < 10) {
          console.log(`  [${processed + 1}] ${row[3]}: 총진료비 ${totalRevenue.toLocaleString()}원 (원본: "${row[20]}")`);
        }

        // 데이터베이스에 저장
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
            totalRevenue,
            insuranceCoverage,
            patientPayment,
            nonInsurance,
            cardPayment,
            cashPayment,
            onlinePayment,
            dailyArrears,
            totalArrears,
            visitRoute: String(row[35] || '')
          }
        });

        processed++;

        if (processed % 1000 === 0) {
          console.log(`  📊 진행: ${processed}개 처리됨`);
        }

      } catch (error) {
        failed++;
        if (failed < 5) {
          console.log(`  ❌ 행 ${i + 1} 실패: ${error.message}`);
        }
      }
    }

    console.log('\n🎉 수정된 처리 완료!');
    console.log(`✅ 성공: ${processed}개`);
    console.log(`❌ 실패: ${failed}개`);

    // 4. 매출 확인
    console.log('\n4️⃣ 수정된 매출 데이터 확인...');
    const revenueCheck = await prisma.receptionRecord.findMany({
      where: {
        clinicId,
        totalRevenue: { gt: 0 }
      },
      select: {
        patientName: true,
        totalRevenue: true,
        cardPayment: true,
        cashPayment: true
      },
      orderBy: { totalRevenue: 'desc' },
      take: 10
    });

    console.log('매출 상위 10명:');
    revenueCheck.forEach((record, i) => {
      console.log(`  ${i + 1}. ${record.patientName}: ${record.totalRevenue.toLocaleString()}원 (카드: ${record.cardPayment.toLocaleString()}, 현금: ${record.cashPayment.toLocaleString()})`);
    });

    await prisma.$disconnect();
    await pool.end();

  } catch (error) {
    console.error('❌ 수정 처리 실패:', error);
  }
}

fixRevenueImport();