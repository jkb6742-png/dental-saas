// 대기시간 파싱 함수 테스트
function parseWaitingTime(value) {
  if (!value) return 0

  const str = String(value).trim()
  console.log(`🔍 대기시간 파싱: "${str}"`)

  // "31분", "14분" 형태에서 숫자만 추출
  const match = str.match(/(\d+)\s*분?/)
  if (match) {
    const minutes = parseInt(match[1])
    console.log(`✅ 파싱 성공: ${minutes}분`)
    return minutes
  }

  // 순수 숫자인 경우
  const num = parseFloat(str)
  if (!isNaN(num)) {
    console.log(`✅ 숫자 파싱: ${num}분`)
    return num
  }

  console.log(`❌ 파싱 실패: "${str}"`)
  return 0
}

// 테스트 케이스
console.log('=== 대기시간 파싱 테스트 ===')
const testCases = ['31분', '14분', '5분', '120분', '15', '0분', '', null, '대기없음', '10 분']

testCases.forEach(testCase => {
  const result = parseWaitingTime(testCase)
  console.log(`입력: "${testCase}" → 결과: ${result}분\n`)
})