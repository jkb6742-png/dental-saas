require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function checkActualRevenue() {
  try {
    console.log('🔍 실제 매출 데이터 확인...\n');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const clinicId = 'cmpyssy9c055qmwugjrq9dmvh';

    // 2026년 5월 데이터 샘플 조회
    const records = await prisma.receptionRecord.findMany({
      where: {
        clinicId,
        year: 2026,
        month: 5
      },
      select: {
        patientName: true,
        patientType: true,
        totalRevenue: true,
        insuranceCoverage: true,
        patientPayment: true,
        nonInsurance: true,
        cardPayment: true,
        cashPayment: true
      },
      take: 20,
      orderBy: {
        totalRevenue: 'desc' // 매출이 높은 순으로
      }
    });

    console.log(`📊 매출 데이터 샘플 (상위 20건):`);
    records.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.patientName} (${record.patientType}):`);
      console.log(`     총진료비: ${record.totalRevenue || 0}원`);
      console.log(`     공단부담: ${record.insuranceCoverage || 0}원`);
      console.log(`     본인부담: ${record.patientPayment || 0}원`);
      console.log(`     비급여: ${record.nonInsurance || 0}원`);
      console.log(`     카드수납: ${record.cardPayment || 0}원`);
      console.log(`     현금수납: ${record.cashPayment || 0}원`);
      console.log('');
    });

    // 전체 통계
    const allRecords = await prisma.receptionRecord.findMany({
      where: {
        clinicId,
        year: 2026,
        month: 5
      },
      select: {
        totalRevenue: true,
        patientType: true
      }
    });

    const totalRevenue = allRecords.reduce((sum, r) => sum + (r.totalRevenue || 0), 0);
    const avgRevenue = allRecords.length > 0 ? totalRevenue / allRecords.length : 0;
    const maxRevenue = Math.max(...allRecords.map(r => r.totalRevenue || 0));
    const minRevenue = Math.min(...allRecords.map(r => r.totalRevenue || 0));

    console.log(`📈 전체 매출 분석 (${allRecords.length}건):`);
    console.log(`  - 총 매출: ${totalRevenue.toLocaleString()}원`);
    console.log(`  - 평균 매출: ${avgRevenue.toLocaleString()}원`);
    console.log(`  - 최대 매출: ${maxRevenue.toLocaleString()}원`);
    console.log(`  - 최소 매출: ${minRevenue.toLocaleString()}원`);

    // 0원인 레코드 확인
    const zeroRevenueCount = allRecords.filter(r => (r.totalRevenue || 0) === 0).length;
    console.log(`  - 매출 0원 레코드: ${zeroRevenueCount}건`);

    await prisma.$disconnect();
    await pool.end();

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

checkActualRevenue();