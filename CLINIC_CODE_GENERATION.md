# 치과 코드 자동 생성 기능

## 개요
치과 생성 시 코드를 자동으로 생성하는 기능을 구현했습니다. 사용자가 치과 이름만 입력하면 시스템이 자동으로 고유한 코드를 생성합니다.

## 주요 기능

### 1. 자동 코드 생성
- **입력**: 치과 이름 (예: "이생각치과")
- **출력**: 자동 생성된 코드 (예: "이생각")

### 2. 코드 생성 규칙
- 한글, 영문, 숫자만 허용
- 특수문자 및 공백 제거
- "치과" 접미사 자동 제거
- 최대 20자 제한
- 대소문자 통일 (소문자)

### 3. 중복 방지
- 동일 대행사 내에서 코드 중복 검사
- 중복 시 자동으로 번호 추가 (예: "이생각1", "이생각2")

### 4. 사용자 선택권
- 자동 생성 활성화/비활성화 토글
- 수동으로 코드 입력 가능
- 실시간 미리보기 기능

## 구현된 파일들

### 1. 유틸리티 함수
```typescript
// src/lib/utils/clinicCodeGenerator.ts
export function generateCodeFromName(name: string): string
export async function generateUniqueClinicCode(agencyId: string, name: string): Promise<string>
export function isValidClinicCode(code: string): boolean
```

### 2. API 엔드포인트 업데이트
```typescript
// src/app/api/clinics/route.ts
// POST: 치과 생성 (코드 자동 생성 지원)
// GET: 치과 목록 조회
```

### 3. 프론트엔드 컴포넌트
```typescript
// src/app/admin/clinics/ClinicManager.tsx
// 자동 생성 토글 및 미리보기 기능
```

## 사용 방법

### 1. 자동 생성 모드 (기본값)
1. 치과 이름 입력 (예: "서울대학교치과병원")
2. 실시간으로 코드 미리보기 확인 (예: "서울대학교")
3. "치과 추가" 버튼 클릭
4. 서버에서 중복 검사 후 고유 코드 생성

### 2. 수동 입력 모드
1. "코드 자동 생성" 체크박스 해제
2. 치과 이름과 코드 직접 입력
3. 코드 유효성 검사 및 중복 확인
4. "치과 추가" 버튼 클릭

## 코드 생성 예시

| 입력 치과 이름 | 생성된 코드 |
|---|---|
| 이생각치과 | isanggak |
| 서울치과 | seoul |
| Seoul Dental Clinic | seouldentalclinic |
| 강남 Yonsei 치과 | kangnamyonsei |
| 제1치과 | je1 |
| Dental 365 | dental365 |

## 오류 처리

### 1. 클라이언트 측
- 치과 이름 필수 입력 검증
- 수동 모드에서 코드 필수 입력 검증
- 실시간 코드 미리보기

### 2. 서버 측
- 코드 형식 유효성 검사
- 대행사 내 코드 중복 방지
- 자동 중복 해결 (번호 추가)

## 테스트

### 1. 단위 테스트
```bash
npm test -- clinicCodeGenerator.test.ts
```

### 2. 수동 테스트
```bash
node scripts/test-clinic-code-generation.js
```

## 장점

1. **사용성 향상**: 코드를 직접 생각할 필요 없음
2. **일관성**: 규칙에 따른 표준화된 코드 생성
3. **중복 방지**: 자동 중복 검사 및 해결
4. **유연성**: 자동/수동 선택 가능
5. **예측 가능성**: 실시간 미리보기 제공

## 향후 개선 사항

1. **커스텀 규칙**: 대행사별 코드 생성 규칙 설정
2. **다국어 지원**: 다양한 언어의 치과명 처리
3. **코드 변경**: 기존 치과 코드 변경 기능
4. **벌크 생성**: 여러 치과 동시 등록 기능