const XLSX = require('xlsx');

// 실제 엑셀 파일 직접 분석
const filePath = 'C:\\Users\\jjang\\Desktop\\THINKLB - 중산사과나무치과\\2026\\7.신환,구환\\전체접수수납목록.xlsx';

console.log('🔍 실제 엑셀 파일 직접 분석 시작...');
console.log('📂 파일:', filePath);

try {
  const workbook = XLSX.readFile(filePath);
  console.log('📊 시트 목록:', workbook.SheetNames);

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  console.log('📋 첫 번째 시트:', workbook.SheetNames[0]);

  // 원시 데이터로 읽기
  const rawData = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    raw: false,
    dateNF: 'yyyy-mm-dd hh:mm:ss'
  });

  console.log(`\n📊 총 ${rawData.length}행 데이터`);
  console.log('📋 헤더 (첫 번째 행):');
  console.log(rawData[0]);

  console.log('\n🔍 처음 5행의 시간 데이터 분석:');
  for (let i = 1; i <= Math.min(5, rawData.length - 1); i++) {
    const row = rawData[i];
    const timeCell = row[0]; // 첫 번째 컬럼 (접수시각)

    console.log(`\n--- 행 ${i + 1} ---`);
    console.log(`원본 값: "${timeCell}"`);
    console.log(`타입: ${typeof timeCell}`);

    if (typeof timeCell === 'number') {
      // Excel 날짜 숫자를 직접 변환
      const excelEpoch = new Date(1899, 11, 30);
      const wholeDays = Math.floor(timeCell);
      const timeFraction = timeCell - wholeDays;

      const targetDate = new Date(excelEpoch);
      targetDate.setDate(excelEpoch.getDate() + wholeDays);

      const totalMinutes = Math.round(timeFraction * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      const result = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hours, minutes);

      console.log(`변환된 날짜시간: ${result.getFullYear()}-${(result.getMonth()+1).toString().padStart(2,'0')}-${result.getDate().toString().padStart(2,'0')} ${result.getHours().toString().padStart(2,'0')}:${result.getMinutes().toString().padStart(2,'0')}`);
      console.log(`시간: ${result.getHours()}시 ${result.getMinutes()}분`);
    } else if (typeof timeCell === 'string') {
      console.log(`문자열 날짜: ${timeCell}`);
      const parsed = new Date(timeCell);
      if (!isNaN(parsed.getTime())) {
        console.log(`파싱 결과: ${parsed.getHours()}시 ${parsed.getMinutes()}분`);
      } else {
        console.log('파싱 실패');
      }
    }

    console.log(`환자명: "${row[3]}"`);
  }

  console.log('\n🔍 시간 분포 통계:');
  const hourStats = {};
  let totalProcessed = 0;

  for (let i = 1; i < Math.min(100, rawData.length); i++) {
    const row = rawData[i];
    const timeCell = row[0];

    if (typeof timeCell === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const wholeDays = Math.floor(timeCell);
      const timeFraction = timeCell - wholeDays;
      const targetDate = new Date(excelEpoch);
      targetDate.setDate(excelEpoch.getDate() + wholeDays);
      const totalMinutes = Math.round(timeFraction * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);

      hourStats[hours] = (hourStats[hours] || 0) + 1;
      totalProcessed++;
    }
  }

  console.log(`처리된 ${totalProcessed}개 행의 시간대별 분포:`);
  Object.keys(hourStats).sort((a, b) => parseInt(a) - parseInt(b)).forEach(hour => {
    console.log(`  ${hour}시: ${hourStats[hour]}명`);
  });

} catch (error) {
  console.error('❌ 오류:', error.message);
}