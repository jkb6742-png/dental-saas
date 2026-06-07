const XLSX = require('xlsx');
const path = require('path');

function createTestExcel() {
  console.log('🔨 테스트용 엑셀 파일 생성 중...');

  // 연령별분포 테스트 데이터
  const ageDistData = [
    ['연령대', '총환자수', '구환수', '신환수', '평균진료비'],
    ['10대', 15, 12, 3, 85000],
    ['20대', 45, 38, 7, 95000],
    ['30대', 120, 95, 25, 125000],
    ['40대', 180, 145, 35, 145000],
    ['50대', 150, 125, 25, 155000],
    ['60대 이상', 90, 75, 15, 135000]
  ];

  // 지역별분포 테스트 데이터
  const regionDistData = [
    ['지역명', '총환자수', '구환수', '신환수', '총내원수', '평균진료비'],
    ['중산동', 80, 65, 15, 120, 125000],
    ['반포동', 45, 35, 10, 68, 135000],
    ['서초동', 60, 48, 12, 85, 145000],
    ['강남구 기타', 25, 20, 5, 35, 115000],
    ['타지역', 15, 12, 3, 18, 95000]
  ];

  try {
    // 연령별분포 엑셀 파일 생성
    const ageWorkbook = XLSX.utils.book_new();
    const ageWorksheet = XLSX.utils.aoa_to_sheet(ageDistData);
    XLSX.utils.book_append_sheet(ageWorkbook, ageWorksheet, '연령별분포');

    const ageFileName = '2026년06월내원환자연령분포.xlsx';
    XLSX.writeFile(ageWorkbook, ageFileName);
    console.log(`✅ 연령별분포 파일 생성: ${ageFileName}`);

    // 지역별분포 엑셀 파일 생성
    const regionWorkbook = XLSX.utils.book_new();
    const regionWorksheet = XLSX.utils.aoa_to_sheet(regionDistData);
    XLSX.utils.book_append_sheet(regionWorkbook, regionWorksheet, '지역별분포');

    const regionFileName = '2026년06월내원환자지역별분포.xlsx';
    XLSX.writeFile(regionWorkbook, regionFileName);
    console.log(`✅ 지역별분포 파일 생성: ${regionFileName}`);

    console.log('\n📁 생성된 테스트 파일들:');
    console.log(`  1. ${ageFileName} (연령별분포)`);
    console.log(`  2. ${regionFileName} (지역별분포)`);
    console.log('\n🚀 이제 웹 인터페이스에서 이 파일들을 업로드해서 테스트할 수 있습니다!');

  } catch (error) {
    console.error('❌ 엑셀 파일 생성 오류:', error.message);
  }
}

createTestExcel();