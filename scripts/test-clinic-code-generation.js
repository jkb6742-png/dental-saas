/**
 * Test script for clinic code generation
 * Run with: node scripts/test-clinic-code-generation.js
 */

// Simple test function to demonstrate code generation logic
function generateCodeFromName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z가-힣0-9]/g, '') // Keep only Korean, English letters and numbers first
    .replace(/\s+/g, '') // Remove spaces
    .replace(/치과$/, '') // Remove '치과' suffix if present (after cleaning)
    .substring(0, 20) // Limit length
}

// Test cases
const testCases = [
  '이생각치과',
  '서울치과',
  '강남연세치과',
  'Seoul Dental Clinic',
  'Happy Dental',
  'Seoul 연세치과',
  '강남 Dental 치과',
  '이생각-치과!',
  'Seoul & Dental@',
  '제1치과',
  'Dental 365',
  '매우긴이름의치과병원입니다치과',
  '치과',
  'A',
  ''
]

console.log('🦷 치과 코드 자동 생성 테스트\n')
console.log('입력값 → 생성된 코드')
console.log('─'.repeat(40))

testCases.forEach(name => {
  const code = generateCodeFromName(name)
  const fallback = code.length < 2 ? 'clinic' : code
  console.log(`"${name}" → "${fallback}"`)
})

console.log('\n✅ 테스트 완료!')
console.log('\n💡 주요 기능:')
console.log('- 치과 이름에서 자동으로 코드 생성')
console.log('- 한글, 영문, 숫자 지원')
console.log('- 특수문자 및 공백 제거')
console.log('- "치과" 접미사 자동 제거')
console.log('- 중복 방지를 위한 번호 추가 (서버에서 처리)')
console.log('- 최대 20자 제한')