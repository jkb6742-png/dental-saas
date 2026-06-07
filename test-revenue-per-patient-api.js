async function testRevenuePerPatientAPI() {
  try {
    console.log('🔍 1인 객단가 월별 API 테스트...\n');

    const response = await fetch(
      'http://localhost:3000/api/patients/monthly-revenue-per-patient?clinicId=cmpyssy9c055qmwugjrq9dmvh&year=2026&type=total'
    );

    const result = await response.json();

    if (result.success) {
      const data = result.data;
      const summary = result.summary;

      console.log('✅ API 호출 성공!');
      console.log(`📊 ${summary.hasData ? '데이터 있음' : '데이터 없음'}`);
      console.log(`총 환자: ${summary.totalPatients}명`);
      console.log(`총 매출: ${summary.totalRevenue.toLocaleString()}원`);
      console.log(`연간 평균 객단가: ${summary.overallRevenuePerPatient.toLocaleString()}원`);
      console.log(`월평균 객단가: ${summary.averageRevenuePerPatient.toLocaleString()}원`);

      console.log('\n📅 월별 1인 객단가:');
      data.forEach(month => {
        if (month.patientCount > 0) {
          console.log(`  ${month.month}월: ${month.revenuePerPatient.toLocaleString()}원 (${month.patientCount}명, 총 ${month.totalRevenue.toLocaleString()}원)`);
        }
      });

      console.log(`\n📈 최고 월: ${summary.peakMonth.month}월 (${summary.peakMonth.revenuePerPatient.toLocaleString()}원)`);
      console.log(`📉 최저 월: ${summary.lowestMonth.month}월 (${summary.lowestMonth.revenuePerPatient.toLocaleString()}원)`);

    } else {
      console.error('❌ API 호출 실패:', result.error);
    }

  } catch (error) {
    console.error('❌ 테스트 오류:', error.message);
  }
}

testRevenuePerPatientAPI();