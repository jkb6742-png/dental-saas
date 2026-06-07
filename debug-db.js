const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkReceptionTimes() {
  try {
    console.log('🔍 최근 업로드된 ReceptionRecord 데이터 확인...');

    const recent = await prisma.receptionRecord.findMany({
      where: {
        clinicId: 'cmpyssy9c055qmwugjrq9dmvh'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20,
      select: {
        receptionTime: true,
        patientName: true,
        createdAt: true
      }
    });

    console.log(`📊 최근 ${recent.length}개 레코드의 receptionTime:`);

    recent.forEach((record, index) => {
      const time = new Date(record.receptionTime);
      console.log(`  ${index + 1}. ${record.patientName}: ${time.toISOString()} (시간: ${time.getHours()}시 ${time.getMinutes()}분)`);
    });

    // 시간대별 분포 확인
    const hourlyStats = {};
    recent.forEach(record => {
      const hour = new Date(record.receptionTime).getHours();
      hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
    });

    console.log('\n⏰ 시간대별 분포:');
    Object.entries(hourlyStats)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([hour, count]) => {
        console.log(`  ${hour}시: ${count}명`);
      });

  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReceptionTimes();