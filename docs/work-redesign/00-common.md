# /work 개편 공통 규칙 (2026-11-12, GPT 자문 3건 + Claude 결정)

- 대상: THINKLAB 사내 업무 앱 `/work` (원장용 `/dashboard`는 건드리지 않음).
- 디자인: 토스풍 단순. 배경 #f2f2ef, 카드 흰색 + 1px #d1d1cc, 둥근 모서리 rounded(4px). 얇은 선 표. 진한 카드·배지·칩 최소화.
  강조색: 파랑 #0062ff(선택·링크), 빨강 #d92d20(지연·위험), 주황 #b54708(대기), 초록 #1a7f37(완료). 회색 글자 #6f6f6a / #8a8a84.
  숫자는 tabular-nums. 아이콘은 lucide-react.
- 화면 폭: 본문 최대 1600px. 1366px 기준 좌 65 : 우 35.
- 그래프: recharts(이미 설치). 데이터 부족하면 0 그래프 대신 "데이터 모으는 중" 안내.
- 갱신 주기: 근태·알림·승인 30~60초, 진행률·그래프 5분, 탭 다시 활성화 시 즉시.
- 권한: 결제·계약·인사·연봉은 대표(MASTER)만. API에서도 같은 검사.
- 날짜 표시: 오늘 / 내일 / 11.18(수) / "2일 지연"(빨강).
- Next.js 16: params·searchParams는 await. proxy.ts가 /api/work 를 직원·마스터로 제한.
- 커밋 금지. prisma schema 수정 금지(필요하면 보고). dev 서버(3200) 재시작·prisma generate 금지.
- 빠른 추가 계약: `window.dispatchEvent(new CustomEvent("work:quick-add", { detail: { kind: "task" | "event" | "memo", clinicId?, groupId? } }))`
  → 상단 바의 QuickAdd 가 받아서 연다(사이드바·상단 바 작업자가 구현).
