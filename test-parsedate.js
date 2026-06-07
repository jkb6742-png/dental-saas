// parseDate 함수 테스트
function parseDate(dateValue) {
  if (!dateValue) return null

  console.log(`[parseDate] 입력값: "${dateValue}" (타입: ${typeof dateValue})`);

  // Excel 날짜 숫자인 경우 (시간 정보 포함)
  if (typeof dateValue === 'number') {
    // Excel epoch (1900-01-01)에서 시작하는 일수 + 시간 정보
    const excelEpoch = new Date(1900, 0, 1).getTime()
    const days = Math.floor(dateValue) - 2 // Excel의 버그 보정
    const timeFraction = dateValue - Math.floor(dateValue) // 소수점 부분이 시간

    const dayMilliseconds = days * 24 * 60 * 60 * 1000
    const timeMilliseconds = timeFraction * 24 * 60 * 60 * 1000

    const result = new Date(excelEpoch + dayMilliseconds + timeMilliseconds)
    console.log(`[parseDate] Excel 숫자 파싱: ${dateValue} → ${result.toISOString()}`);
    return result
  }

  // 문자열 날짜인 경우 (다양한 형식 지원)
  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim()
    console.log(`[parseDate] 문자열 파싱 시도: "${trimmed}"`);

    // "2026-05-11 14:30:00" 형식
    // "2026-05-11T14:30:00" 형식
    // "05/11/2026 14:30" 형식
    const date = new Date(trimmed)
    if (!isNaN(date.getTime())) {
      console.log(`[parseDate] 문자열 파싱 성공: ${date.toISOString()}`);
      return date
    }

    console.log(`[parseDate] 문자열 파싱 실패`);
  }

  // Date 객체인 경우
  if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
    console.log(`[parseDate] Date 객체: ${dateValue.toISOString()}`);
    return dateValue
  }

  console.log(`[parseDate] 파싱 실패 - null 반환`);
  return null
}

// 테스트 데이터
const testData = [
  "2026-05-11 16:55:56",
  "2026-05-11 16:40:39",
  "2026-05-11 15:46:12",
  "2026-05-11 14:30:00",
  "2026-05-11 09:00:00"
];

console.log('🧪 parseDate 함수 테스트 시작');
console.log('=====================================');

testData.forEach((data, index) => {
  console.log(`\n테스트 ${index + 1}: "${data}"`);
  const result = parseDate(data);
  if (result) {
    console.log(`✅ 결과: ${result.toISOString()}`);
    console.log(`   시간: ${result.getHours()}시 ${result.getMinutes()}분`);
  } else {
    console.log(`❌ 파싱 실패`);
  }
});

console.log('\n=====================================');
console.log('🧪 테스트 완료');