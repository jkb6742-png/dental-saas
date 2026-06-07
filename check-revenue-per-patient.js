async function checkRevenuePerPatient() {
  try {
    console.log('🔍 1인 객단가 계산 검증...\n');

    const response = await fetch(
      'http://localhost:3000/api/patients/simple-stats?clinicId=cmpyssy9c055qmwugjrq9dmvh&year=2026&month=5'
    );

    const result = await response.json();

    if (result.success) {
      const data = result.data;

      console.log('📊 기본 통계:');
      console.log(`  - 신환 총인원: ${data.newPatientCount}명`);
      console.log(`  - 신환 총방문: ${data.newPatientVisits}회`);
      console.log(`  - 신환 총매출: ${data.newPatientRevenue.toLocaleString()}원`);
      console.log(`  - 신환 1인 객단가: ${data.newPatientCount > 0 ? Math.round(data.newPatientRevenue / data.newPatientCount).toLocaleString() : 0}원`);

      console.log('\n📋 구환 통계:');
      console.log(`  - 구환 총인원: ${data.returningPatientCount}명`);
      console.log(`  - 구환 총방문: ${data.returningPatientVisits}회`);
      console.log(`  - 구환 총매출: ${data.returningPatientRevenue.toLocaleString()}원`);
      console.log(`  - 구환 1인 객단가: ${data.returningPatientCount > 0 ? Math.round(data.returningPatientRevenue / data.returningPatientCount).toLocaleString() : 0}원`);

      console.log('\n🧮 객단가 계산 분석:');
      const newPatientAvg = data.newPatientCount > 0 ? data.newPatientRevenue / data.newPatientCount : 0;
      const returningPatientAvg = data.returningPatientCount > 0 ? data.returningPatientRevenue / data.returningPatientCount : 0;

      console.log(`  - 신환 1인당: ${newPatientAvg.toLocaleString()}원 (${data.newPatientRevenue.toLocaleString()} ÷ ${data.newPatientCount})`);
      console.log(`  - 구환 1인당: ${returningPatientAvg.toLocaleString()}원 (${data.returningPatientRevenue.toLocaleString()} ÷ ${data.returningPatientCount})`);

      // 방문당 객단가도 계산
      const newVisitAvg = data.newPatientVisits > 0 ? data.newPatientRevenue / data.newPatientVisits : 0;
      const returningVisitAvg = data.returningPatientVisits > 0 ? data.returningPatientRevenue / data.returningPatientVisits : 0;

      console.log('\n📈 참고: 방문당 객단가');
      console.log(`  - 신환 방문당: ${newVisitAvg.toLocaleString()}원 (${data.newPatientRevenue.toLocaleString()} ÷ ${data.newPatientVisits})`);
      console.log(`  - 구환 방문당: ${returningVisitAvg.toLocaleString()}원 (${data.returningPatientRevenue.toLocaleString()} ÷ ${data.returningPatientVisits})`);

    } else {
      console.error('❌ API 호출 실패:', result.error);
    }

  } catch (error) {
    console.error('❌ 테스트 오류:', error.message);
  }
}

checkRevenuePerPatient();