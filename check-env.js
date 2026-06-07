require('dotenv/config');

console.log('🔍 환경변수 확인:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '설정됨' : '설정 안됨');
console.log('DIRECT_URL:', process.env.DIRECT_URL ? '설정됨' : '설정 안됨');

if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL (첫 50자):', process.env.DATABASE_URL.substring(0, 50) + '...');
}

// dotenv 패키지가 제대로 설치되어 있는지 확인
try {
  require('dotenv');
  console.log('✅ dotenv 패키지 설치됨');
} catch (error) {
  console.log('❌ dotenv 패키지 설치되지 않음:', error.message);
}