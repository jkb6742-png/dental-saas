require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function verifyMaxWaiting() {
  try {
    console.log('🔍 최대 대기시간 검증 중...\n');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const clinicId = 'cmpyssy9c055qmwugjrq9dmvh';

    // 2026년 5월 데이터 조회
    const records = await prisma.receptionRecord.findMany({
      where: {
        clinicId,
        year: 2026,
        month: 5,
        waitingTime: { gt: 0 } // 0보다 큰 대기시간만
      },
      select: {
        patientName: true,
        receptionTime: true,
        waitingTime: true
      },
      orderBy: {
        waitingTime: 'desc' // 대기시간이 긴 순서대로
      },
      take: 20 // 상위 20개만
    });

    console.log(`📊 0분 초과 대기시간 레코드: ${records.length}개`);

    if (records.length > 0) {
      console.log('\n🔥 대기시간 상위 20명:');
      records.forEach((record, index) => {
        const date = new Date(record.receptionTime);
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[date.getDay()];
        const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

        console.log(`  ${index + 1}. ${record.patientName}: ${record.waitingTime}분 (${timeStr} ${dayName}요일)`);
      });

      const maxWaiting = records[0].waitingTime;
      const avgWaiting = records.reduce((sum, r) => sum + r.waitingTime, 0) / records.length;

      console.log(`\n📈 통계:`);
      console.log(`  - 최대 대기시간: ${maxWaiting}분`);
      console.log(`  - 평균 대기시간: ${avgWaiting.toFixed(1)}분`);
      console.log(`  - 최소 대기시간: ${records[records.length - 1].waitingTime}분`);

      // 95분 이상인 레코드들만 확인
      const longWaitRecords = records.filter(r => r.waitingTime >= 95);
      console.log(`\n⚠️ 95분 이상 대기한 환자: ${longWaitRecords.length}명`);
      if (longWaitRecords.length > 0) {
        longWaitRecords.forEach(record => {
          console.log(`  - ${record.patientName}: ${record.waitingTime}분`);
        });
      }

    } else {
      console.log('❌ 대기시간 데이터가 없습니다.');
    }

    await prisma.$disconnect();
    await pool.end();

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

verifyMaxWaiting();