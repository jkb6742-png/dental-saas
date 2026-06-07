const XLSX = require('xlsx');

// 실제 엑셀 파일의 매출 데이터 확인
const filePath = 'C:\\Users\\jjang\\Desktop\\THINKLB - 중산사과나무치과\\2026\\7.신환,구환\\전체접수수납목록.xlsx';

console.log('🔍 엑셀 파일의 매출 데이터 확인...');

try {
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  // 원시 데이터로 읽기
  const rawData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false
  });

  console.log('📋 헤더 (첫 번째 행):');
  console.log(rawData[0]);

  // 매출 관련 컬럼 찾기
  const headers = rawData[0];
  const revenueColumnIndexes = {};

  headers.forEach((header, index) => {
    if (header.includes('진료비') || header.includes('매출') || header.includes('수납') || header.includes('부담')) {
      revenueColumnIndexes[header] = index;
    }
  });

  console.log('\n💰 매출 관련 컬럼 위치:');
  Object.entries(revenueColumnIndexes).forEach(([header, index]) => {
    console.log(`  - ${header}: ${index}번 컬럼`);
  });

  console.log('\n📊 처음 10행의 매출 데이터:');
  for (let i = 1; i <= Math.min(10, rawData.length - 1); i++) {
    const row = rawData[i];
    console.log(`\n--- 행 ${i + 1}: ${row[3]} ---`); // 환자명

    Object.entries(revenueColumnIndexes).forEach(([header, index]) => {
      const value = row[index];
      console.log(`  ${header}: "${value}" (타입: ${typeof value})`);
    });
  }

  // 총진료비 컬럼 (20번 컬럼)의 실제 값들 확인
  console.log('\n🎯 총진료비 컬럼 (20번) 샘플:');
  for (let i = 1; i <= Math.min(20, rawData.length - 1); i++) {
    const totalRevenue = rawData[i][20]; // 20번 컬럼이 총진료비
    console.log(`  ${i}. ${rawData[i][3]}: ${totalRevenue} (타입: ${typeof totalRevenue})`);
  }

} catch (error) {
  console.error('❌ 오류:', error.message);
}