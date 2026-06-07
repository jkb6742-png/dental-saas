const XLSX = require('xlsx');
const fs = require('fs');

// 가장 최근에 업로드된 Excel 파일 찾기
const uploadsDir = 'C:\\uploads';
let latestFile = null;

try {
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir)
      .filter(file => file.includes('전체접수수납목록') && file.endsWith('.xlsx'))
      .map(file => ({
        name: file,
        path: `${uploadsDir}\\${file}`,
        time: fs.statSync(`${uploadsDir}\\${file}`).mtime
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 0) {
      latestFile = files[0].path;
    }
  }

  // 실제 파일 경로들 체크
  const candidateFiles = [
    'C:\\Users\\jjang\\Desktop\\THINKLB - 중산사과나무치과\\2026\\7.신환,구환\\전체접수수납목록.xlsx',
    'C:\\Users\\jjang\\Desktop\\고산365연치과의원\\7.신환,구환\\2026년 전체접수수납목록.xlsx',
    'C:\\Users\\jjang\\Desktop\\전체접수수납목록.xlsx'
  ];

  for (const file of candidateFiles) {
    if (fs.existsSync(file)) {
      latestFile = file;
      break;
    }
  }

  if (!latestFile) {
    console.log('❌ Excel 파일을 찾을 수 없습니다');
    process.exit(1);
  }

  console.log(`📂 파일 분석: ${latestFile}`);

  // Excel 파일 읽기
  const workbook = XLSX.readFile(latestFile);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // 원시 데이터로 변환 (셀 타입 유지)
  const rawData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,  // 원시 값 유지
    dateNF: 'yyyy-mm-dd hh:mm:ss'
  });

  console.log(`📊 총 ${rawData.length}행 데이터`);
  console.log('🔍 첫 5행의 A컬럼 데이터 (접수시각):');

  for (let i = 0; i < Math.min(10, rawData.length); i++) {
    const row = rawData[i];
    const cellValue = row[0];
    console.log(`  행 ${i + 1}: "${cellValue}" (타입: ${typeof cellValue})`);

    // 만약 숫자라면 Excel 날짜로 변환해보기
    if (typeof cellValue === 'number') {
      const excelEpoch = new Date(1900, 0, 1).getTime();
      const days = Math.floor(cellValue) - 2;
      const timeFraction = cellValue - Math.floor(cellValue);
      const dayMs = days * 24 * 60 * 60 * 1000;
      const timeMs = timeFraction * 24 * 60 * 60 * 1000;
      const date = new Date(excelEpoch + dayMs + timeMs);
      console.log(`    → 변환된 날짜: ${date.toISOString()}`);
    }
  }

} catch (error) {
  console.error('❌ 오류:', error.message);
}