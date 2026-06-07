// 간단한 HTTP 요청으로 데이터 확인
const https = require('http');

// 최신 ReceptionRecord 몇 개를 확인하는 간단한 API 호출
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/debug/recent-records?clinicId=cmpyssy9c055qmwugjrq9dmvh&limit=10',
  method: 'GET'
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('📊 최근 ReceptionRecord 데이터:');

      if (result.records) {
        result.records.forEach((record, index) => {
          const date = new Date(record.receptionTime);
          console.log(`  ${index + 1}. ${record.patientName}: ${date.toISOString()}`);
          console.log(`     시간: ${date.getHours()}시 ${date.getMinutes()}분`);
          console.log(`     생성일: ${record.createdAt}`);
        });
      } else {
        console.log('❌ 데이터 없음 또는 API 오류');
        console.log(data);
      }
    } catch (error) {
      console.log('❌ API 호출 오류:', error.message);
      console.log('응답:', data);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ 요청 오류:', error.message);

  // 대안: 직접 SQL 같은 형태로 조회해보기
  console.log('\n🔄 대안: 파일 재업로드를 권장합니다');
  console.log('1. 브라우저에서 파일 업로드 페이지로 이동');
  console.log('2. 전체접수수납목록.xlsx 파일을 다시 업로드');
  console.log('3. 업로드 로그에서 parseDate 함수 동작 확인');
});

req.end();