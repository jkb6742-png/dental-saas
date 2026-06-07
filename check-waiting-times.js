require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function checkWaitingTimes() {
  try {
    console.log('🔍 대기시간 데이터 분석 중...\n');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const clinicId = 'cmpyssy9c055qmwugjrq9dmvh';

    // 전체 대기시간 데이터 분석
    const allRecords = await prisma.receptionRecord.findMany({
      where: { clinicId },
      select: {
        receptionTime: true,
        waitingTime: true,
        patientName: true
      },
      take: 100
    });

    console.log(`📊 총 ${allRecords.length}개 레코드 분석`);

    // 대기시간 분포 확인
    let nullCount = 0;
    let zeroCount = 0;
    let validWaitingTimes = [];

    allRecords.forEach(record => {
      if (record.waitingTime === null || record.waitingTime === undefined) {
        nullCount++;
      } else if (record.waitingTime === 0) {
        zeroCount++;
      } else {
        validWaitingTimes.push(record.waitingTime);
      }
    });

    console.log('🕐 대기시간 분포:');
    console.log(`  - null/undefined: ${nullCount}개`);
    console.log(`  - 0분: ${zeroCount}개`);
    console.log(`  - 유효한 대기시간: ${validWaitingTimes.length}개`);

    if (validWaitingTimes.length > 0) {
      const avg = validWaitingTimes.reduce((a, b) => a + b, 0) / validWaitingTimes.length;
      const max = Math.max(...validWaitingTimes);
      const min = Math.min(...validWaitingTimes);

      console.log(`  - 평균: ${avg.toFixed(1)}분`);
      console.log(`  - 최대: ${max}분`);
      console.log(`  - 최소: ${min}분`);

      console.log('\n📋 샘플 유효 대기시간 (처음 10개):');
      const samplesWithWaiting = allRecords
        .filter(r => r.waitingTime && r.waitingTime > 0)
        .slice(0, 10);

      samplesWithWaiting.forEach((record, i) => {
        const date = new Date(record.receptionTime);
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[date.getDay()];
        console.log(`  ${i + 1}. ${record.patientName}: ${record.waitingTime}분 (${dayName}요일)`);
      });
    }

    // 요일별 분석
    console.log('\n📅 요일별 대기시간 분석:');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) { // 월~금만
      const dayRecords = allRecords.filter(record => {
        const date = new Date(record.receptionTime);
        return date.getDay() === dayOfWeek && record.waitingTime && record.waitingTime > 0;
      });

      if (dayRecords.length > 0) {
        const waitingTimes = dayRecords.map(r => r.waitingTime);
        const avg = waitingTimes.reduce((a, b) => a + b, 0) / waitingTimes.length;
        const max = Math.max(...waitingTimes);

        console.log(`  ${dayNames[dayOfWeek]}요일: 평균 ${avg.toFixed(1)}분, 최대 ${max}분 (${dayRecords.length}건)`);
      } else {
        console.log(`  ${dayNames[dayOfWeek]}요일: 데이터 없음`);
      }
    }

    await prisma.$disconnect();
    await pool.end();

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

checkWaitingTimes();