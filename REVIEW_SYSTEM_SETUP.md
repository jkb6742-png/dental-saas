# 온라인 리뷰 관리 시스템 설정 가이드

## 개요

dental-saas에 네이버와 구글 리뷰를 자동으로 수집하고 분석하는 기능이 추가되었습니다.

## 주요 기능

✅ **네이버 리뷰 관리**: 네이버 플레이스 리뷰 모니터링 (수동 입력)  
✅ **구글 리뷰 자동수집**: Google Places API를 통한 자동 리뷰 수집  
✅ **실시간 대시보드**: 월별 리뷰 현황, 평점 분석, 감정 분석  
✅ **자동화**: 정기적인 리뷰 데이터 동기화  
✅ **통계 분석**: 평점 분포, 답글 응답률, 긍정/부정 리뷰 분류  

## 1. 환경 설정

### 1.1 Google Places API 키 발급

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" > "라이브러리"로 이동
4. "Places API" 검색 후 활성화
5. "API 및 서비스" > "사용자 인증 정보"로 이동
6. "사용자 인증 정보 만들기" > "API 키" 선택
7. API 키 복사

### 1.2 환경변수 설정

`.env` 파일에 다음 변수들을 추가하세요:

```env
# Google Places API (구글 리뷰 크롤링용)
GOOGLE_PLACES_API_KEY="your-google-places-api-key"

# 자동 리뷰 수집 시크릿 키 (cron job 인증용)
CRON_SECRET="your-random-cron-secret-key"
```

## 2. 데이터베이스 마이그레이션

```bash
npx prisma generate
npx prisma migrate dev
```

## 3. 리뷰 설정

### 3.1 네이버 리뷰 설정

1. 대시보드에서 "온라인 리뷰" 메뉴 접속
2. "설정 관리" 탭으로 이동
3. 네이버 섹션에서 다음 정보 입력:
   - **업체명**: 네이버에 등록된 치과 이름
   - **네이버 플레이스 URL**: `https://map.naver.com/p/...` 형태의 URL

### 3.2 구글 리뷰 설정

1. "설정 관리" 탭의 구글 섹션에서:
   - **업체명**: 구글 비즈니스에 등록된 치과 이름  
   - **Google Place ID**: 치과의 Google Place ID

#### Google Place ID 찾는 방법:
1. [Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id) 사용
2. 또는 Google 지도에서 치과 검색 후 URL에서 확인

## 4. 리뷰 수집 및 모니터링

### 4.1 수동 수집

- 각 플랫폼별 "수집" 버튼 클릭
- 실시간으로 새로운 리뷰 데이터 확인

### 4.2 자동 수집 (Cron Job)

매일 자동으로 리뷰를 수집하려면 다음 cron job을 설정하세요:

```bash
# 매일 오전 9시에 실행
0 9 * * * curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/reviews/auto-sync
```

### 4.3 대시보드 활용

**홈 대시보드**: 월별 리뷰 요약이 자동으로 표시됩니다.

**리뷰 전용 페이지**: `/dashboard/{clinicId}/reviews`에서 상세 현황 확인 가능
- 플랫폼별 상세 통계
- 최근 리뷰 목록
- 평점 분포 및 감정 분석

## 5. 데이터 구조

### 5.1 수집되는 데이터

- **기본 정보**: 리뷰어명, 평점, 리뷰 내용, 작성일
- **분석 데이터**: 긍정/부정 분류, 키워드 추출
- **응답 관리**: 사장님 답글 및 답글 작성일

### 5.2 월별 요약 통계

- 총 리뷰 수 / 신규 리뷰 수
- 평균 평점 / 평점 분포
- 긍정/부정 리뷰 비율
- 답글 응답률

## 6. 문제 해결

### 6.1 구글 리뷰가 수집되지 않을 때

1. Google Places API 키가 올바른지 확인
2. Places API가 활성화되어 있는지 확인
3. Google Place ID가 정확한지 확인
4. API 할당량을 확인 (일일 제한)

### 6.2 네이버 리뷰 관련

- 현재는 수동 입력만 지원
- 네이버 공식 API가 제한적이므로 자동 크롤링 개발 예정

### 6.3 데이터가 표시되지 않을 때

1. 데이터베이스 마이그레이션 완료 확인
2. 리뷰 설정이 올바르게 저장되었는지 확인
3. 브라우저 새로고침 또는 캐시 삭제

## 7. 향후 계획

🔄 **네이버 리뷰 자동 크롤링**: 웹 스크래핑을 통한 자동 수집  
📊 **고급 분석**: 키워드 트렌드, 경쟁사 비교  
🔔 **알림 시스템**: 새 리뷰 알림, 부정 리뷰 즉시 알림  
🤖 **AI 분석**: 리뷰 감정 분석 고도화, 개선 제안  

---

## 지원 및 문의

설정 중 문제가 발생하면 개발팀에 문의하세요.
- 이슈 등록: [GitHub Issues](https://github.com/jkb6742-png/dental-saas/issues)