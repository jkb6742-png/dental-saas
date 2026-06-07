// ReceptionRecord만 삭제하는 안전한 스크립트
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearReceptionRecords() {
  try {
    console.log('🗑️ ReceptionRecord 데이터만 삭제 중...');

    const deleteResult = await prisma.receptionRecord.deleteMany({
      where: {
        clinicId: 'cmpyssy9c055qmwugjrq9dmvh'
      }
    });

    console.log(`✅ ${deleteResult.count}개 레코드 삭제 완료`);

    console.log('🗑️ PatientStat 데이터도 삭제 중...');

    const deleteStatsResult = await prisma.patientStat.deleteMany({
      where: {
        clinicId: 'cmpyssy9c055qmwugjrq9dmvh'
      }
    });

    console.log(`✅ ${deleteStatsResult.count}개 통계 레코드 삭제 완료`);

    console.log('🎯 이제 파일을 다시 업로드하면 깨끗한 상태에서 시작됩니다');

  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearReceptionRecords();