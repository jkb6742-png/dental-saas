// 네이버 리뷰 설정 테스트 스크립트
const testNaverConfig = async () => {
  const testData = {
    clinicId: "test-clinic-id", // 실제 clinicId로 변경하세요
    source: "NAVER",
    placeName: "테스트치과",
    placeUrl: "https://map.naver.com/p/12345"
  }

  try {
    const response = await fetch('http://localhost:3000/api/reviews/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 실제 인증 헤더가 필요할 수 있습니다
      },
      body: JSON.stringify(testData)
    })

    const result = await response.json()
    console.log('응답 상태:', response.status)
    console.log('응답 데이터:', result)

    if (response.ok) {
      console.log('✅ 네이버 리뷰 설정 저장 성공!')
    } else {
      console.log('❌ 네이버 리뷰 설정 저장 실패:', result.error)
    }
  } catch (error) {
    console.error('❌ 네트워크 에러:', error)
  }
}

// Node.js 환경에서 실행하려면:
// node test-review-config.js
console.log('네이버 리뷰 설정 테스트를 브라우저 콘솔에서 실행하세요:')
console.log('testNaverConfig()')