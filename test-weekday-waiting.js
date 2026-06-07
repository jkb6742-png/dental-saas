async function testWeekdayWaiting() {
  try {
    console.log('🔍 요일별 대기시간 API 테스트...\n');

    const response = await fetch(
      'http://localhost:3000/api/patients/simple-stats?clinicId=cmpyssy9c055qmwugjrq9dmvh&year=2026&month=5'
    );

    const result = await response.json();

    if (result.success) {
      const data = result.data;

      console.log('✅ API 호출 성공!');
      console.log(`📊 ${data.period} 통계:`);
      console.log(`  - 총 환자: ${data.totalPatientCount}명`);
      console.log(`  - 전체 평균 대기시간: ${data.overallAvgWaitingTime}분`);
      console.log(`  - 전체 최대 대기시간: ${data.overallMaxWaitingTime}분`);

      console.log('\n📅 요일별 대기시간 통계:');
      if (data.weekdayWaitingStats) {
        Object.entries(data.weekdayWaitingStats).forEach(([day, stats]) => {
          console.log(`  ${day}요일: 평균 ${stats.avg}분, 최대 ${stats.max}분 (${stats.count}건)`);
        });
      }

    } else {
      console.error('❌ API 호출 실패:', result.error);
    }

  } catch (error) {
    console.error('❌ 테스트 오류:', error.message);
  }
}

testWeekdayWaiting();