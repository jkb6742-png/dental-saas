require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function debugTimeData() {
  try {
    console.log('🔍 시간 데이터 문제 진단 중...\n');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    // 1. 최근 접수 데이터의 시간 분포 확인
    console.log('=== 최근 100개 접수기록의 시간 분포 ===');
    const recentRecords = await prisma.receptionRecord.findMany({
      where: { clinicId: 'cmpyssy9c055qmwugjrq9dmvh' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        receptionTime: true,
        patientName: true,
        createdAt: true
      }
    });

    // 시간대별 분포 계산
    const hourlyStats = {};
    const uniqueHours = new Set();

    recentRecords.forEach(record => {
      const time = new Date(record.receptionTime);
      const hour = time.getHours();
      const minute = time.getMinutes();
      const second = time.getSeconds();

      hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
      uniqueHours.add(hour);

      // 처음 10개 레코드 상세 출력
      if (Object.keys(hourlyStats).length <= 10) {
        console.log(`📅 ${record.patientName}: ${time.toISOString()} (${hour}:${minute}:${second})`);
      }
    });

    console.log('\n⏰ 시간대별 분포:');
    [...uniqueHours].sort((a, b) => a - b).forEach(hour => {
      console.log(`  ${hour}시: ${hourlyStats[hour]}명`);
    });

    // 2. 전체 데이터의 시간 분포 확인
    console.log('\n=== 전체 데이터 시간대별 통계 ===');
    const allTimeData = await prisma.receptionRecord.groupBy({
      by: ['clinicId'],
      where: { clinicId: 'cmpyssy9c055qmwugjrq9dmvh' },
      _count: { id: true }
    });

    console.log(`전체 접수기록: ${allTimeData[0]?._count?.id || 0}개`);

    // 3. SQL로 시간대별 분포 직접 조회
    console.log('\n=== SQL 직접 조회 결과 ===');
    const hourlyDistribution = await prisma.$queryRaw`
      SELECT
        EXTRACT(HOUR FROM reception_time) as hour,
        COUNT(*) as count
      FROM reception_record
      WHERE clinic_id = 'cmpyssy9c055qmwugjrq9dmvh'
      GROUP BY EXTRACT(HOUR FROM reception_time)
      ORDER BY hour
    `;

    console.log('시간대별 분포 (SQL):');
    hourlyDistribution.forEach(row => {
      console.log(`  ${row.hour}시: ${row.count}명`);
    });

    // 4. 요일별 데이터 확인
    console.log('\n=== 요일별 분포 ===');
    const weeklyDistribution = await prisma.$queryRaw`
      SELECT
        EXTRACT(DOW FROM reception_time) as day_of_week,
        EXTRACT(HOUR FROM reception_time) as hour,
        COUNT(*) as count
      FROM reception_record
      WHERE clinic_id = 'cmpyssy9c055qmwugjrq9dmvh'
      GROUP BY EXTRACT(DOW FROM reception_time), EXTRACT(HOUR FROM reception_time)
      ORDER BY day_of_week, hour
    `;

    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    weeklyDistribution.forEach(row => {
      const dayName = weekdays[parseInt(row.day_of_week)];
      console.log(`  ${dayName}요일 ${row.hour}시: ${row.count}명`);
    });

    // 5. 원본 데이터 샘플 확인
    console.log('\n=== 원본 시간 데이터 샘플 ===');
    const rawSamples = await prisma.$queryRaw`
      SELECT
        reception_time,
        patient_name,
        TO_CHAR(reception_time, 'YYYY-MM-DD HH24:MI:SS') as formatted_time,
        EXTRACT(HOUR FROM reception_time) as hour,
        EXTRACT(MINUTE FROM reception_time) as minute
      FROM reception_record
      WHERE clinic_id = 'cmpyssy9c055qmwugjrq9dmvh'
      ORDER BY reception_time DESC
      LIMIT 20
    `;

    rawSamples.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.patient_name}: ${row.formatted_time} (${row.hour}:${String(row.minute).padStart(2, '0')})`);
    });

    await prisma.$disconnect();
    await pool.end();

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

debugTimeData();