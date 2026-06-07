# 🏥 Dental SaaS NAS 배포 가이드

## 📋 개요

이 문서는 Dental SaaS 애플리케이션을 Synology NAS 환경으로 배포하는 방법을 설명합니다.

### ✨ 최신 업데이트 (2026-06-08)

현재 버전에 포함된 주요 기능:

#### 🎯 실행계획 관리
- **새로운 실행계획 카테고리** 추가
- **우선순위 시스템**: 상/중/하 분류 및 시각적 구분
- **첨부파일 업로드**: 계획별 파일 첨부 기능
- **댓글 시스템**: 마스터-치과 간 실시간 소통
- **권한 제어**: 마스터만 수정/삭제, 치과는 조회/댓글만
- **홈 대시보드 통합**: 진행중인 계획 현황 표시

#### 🗃️ 데이터베이스 관리
- **월별 필터링**: 모든 데이터베이스 페이지에 년도/월 필터 추가
- **깔끔한 UI**: 불필요한 총계 통계 카드 제거
- **통합 관리**: 6개 핵심 테이블 중앙 관리

#### 🔐 권한 시스템
- **역할 기반 접근**: 마스터 vs 치과 사용자 구분
- **기능별 제한**: 데이터 조회/수정 권한 세분화

---

## 🚀 배포 방법

### 방법 1: PowerShell 스크립트 (Windows 권장)

```powershell
# PowerShell에서 실행
.\Deploy-ToNAS.ps1 -NASHost "192.168.1.100" -NASUser "admin"
```

### 방법 2: Bash 스크립트 (Linux/Mac)

```bash
# 환경변수 설정
export NAS_HOST="192.168.1.100"
export NAS_USER="admin"

# 스크립트 실행
chmod +x deploy-to-nas.sh
./deploy-to-nas.sh
```

---

## ⚙️ 사전 준비사항

### 1. NAS 환경 설정

#### Docker 설치
- **Container Manager** 패키지 설치
- **Docker** 및 **Docker Compose** 활성화

#### SSH 접속 설정
- **제어판 > 터미널 및 SNMP > 터미널** 에서 SSH 활성화
- SSH 키 인증 설정 (비밀번호 없이 접속)

```bash
# SSH 키 생성 (로컬 PC에서)
ssh-keygen -t rsa -b 4096 -C "dental-saas-deploy"

# 공개키를 NAS로 복사
ssh-copy-id admin@192.168.1.100
```

### 2. NAS 디렉토리 구조

```
/volume1/docker/dental-saas/
├── docker-compose.nas.yml     # Docker 구성
├── .env                       # 환경 설정
├── cache/                     # 애플리케이션 캐시
├── uploads/                   # 업로드 파일
├── logs/                      # 로그 파일
└── postgres_data/             # 데이터베이스 데이터
```

### 3. 환경 변수 설정

배포 후 `/volume1/docker/dental-saas/.env` 파일을 편집:

```env
# 데이터베이스 설정
DATABASE_URL=postgresql://dental_user:your_strong_password@dental-db:5432/dental_db
DB_PASSWORD=your_strong_password

# NextAuth 설정
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=http://your-nas-ip:3000

# Anthropic API (AI 기능용)
ANTHROPIC_API_KEY=your_anthropic_api_key

# NAS 최적화 설정
NODE_ENV=production
CACHE_DIR=/app/cache
MAX_PAGE_SIZE=50
DEFAULT_PAGE_SIZE=20
ENABLE_FILE_CACHE=true
COMPRESSION_ENABLED=true
```

---

## 🔄 배포 과정

### 자동 배포 단계

1. **Git 상태 확인**: 커밋되지 않은 변경사항 체크
2. **기존 버전 백업**: 타임스탬프 기반 자동 백업
3. **패키지 생성**: 필요한 파일만 압축 (node_modules 제외)
4. **파일 전송**: SCP를 통한 안전한 전송
5. **NAS 배포**: 
   - 기존 컨테이너 중지
   - 새 버전 압축 해제
   - 권한 설정
   - Docker 이미지 빌드
   - 서비스 시작
6. **배포 확인**: 컨테이너 상태 및 로그 확인

### 수동 단계

배포 완료 후 다음을 수동으로 확인:

1. **환경 설정**: `.env` 파일 내용 확인/수정
2. **데이터베이스**: 마이그레이션 및 초기 데이터 확인
3. **웹 접속**: `http://NAS_IP:3000` 접속 테스트
4. **기능 테스트**: 파일 업로드, 로그인 등

---

## 🛠️ 운영 및 관리

### 컨테이너 관리

```bash
# NAS에 SSH 접속 후
cd /volume1/docker/dental-saas

# 서비스 상태 확인
docker-compose -f docker-compose.nas.yml ps

# 로그 확인
docker-compose -f docker-compose.nas.yml logs -f dental-app

# 서비스 재시작
docker-compose -f docker-compose.nas.yml restart

# 서비스 중지
docker-compose -f docker-compose.nas.yml down

# 서비스 시작
docker-compose -f docker-compose.nas.yml up -d
```

### 백업 및 복원

```bash
# 백업 목록 확인
ls -la /volume1/docker/ | grep dental-saas-backup

# 백업에서 복원 (예시)
cd /volume1/docker
rm -rf dental-saas
mv dental-saas-backup-20260608_143022 dental-saas
cd dental-saas
docker-compose -f docker-compose.nas.yml up -d
```

### 데이터베이스 관리

```bash
# 데이터베이스 컨테이너 접속
docker-compose -f docker-compose.nas.yml exec dental-db psql -U dental_user -d dental_db

# 데이터베이스 백업
docker-compose -f docker-compose.nas.yml exec dental-db pg_dump -U dental_user dental_db > backup.sql

# 데이터베이스 복원
docker-compose -f docker-compose.nas.yml exec -T dental-db psql -U dental_user -d dental_db < backup.sql
```

---

## 🔧 문제 해결

### 자주 발생하는 문제

#### 1. SSH 연결 실패
```bash
# SSH 연결 테스트
ssh -o ConnectTimeout=10 admin@192.168.1.100 "echo 'test'"

# SSH 키 문제 해결
ssh-copy-id admin@192.168.1.100
```

#### 2. Docker 빌드 실패
```bash
# Docker 로그 확인
docker-compose -f docker-compose.nas.yml logs

# 이미지 재빌드
docker-compose -f docker-compose.nas.yml build --no-cache
```

#### 3. 메모리 부족
```bash
# 메모리 사용량 확인
docker stats

# 불필요한 이미지 정리
docker image prune -a
```

#### 4. 포트 충돌
```bash
# 포트 사용 확인
netstat -tuln | grep 3000

# docker-compose.nas.yml 포트 변경
ports:
  - "3001:3000"  # 3000 -> 3001로 변경
```

### 로그 위치

- **애플리케이션 로그**: `/volume1/docker/dental-saas/logs/`
- **Docker 로그**: `docker-compose logs`
- **데이터베이스 로그**: Docker 컨테이너 로그에서 확인

---

## 📊 성능 최적화

### NAS 리소스 제한

현재 설정된 리소스 제한:

- **메모리**: 최대 1GB, 예약 512MB
- **CPU**: 최대 50%, 예약 25%

### 캐시 최적화

```env
# .env에서 캐시 설정 조정
ENABLE_FILE_CACHE=true
CACHE_DIR=/app/cache
MAX_PAGE_SIZE=50        # 페이지당 항목 수 제한
DEFAULT_PAGE_SIZE=20    # 기본 페이지 크기
```

### 데이터베이스 최적화

```sql
-- 주기적인 VACUUM 실행 (월 1회)
VACUUM ANALYZE;

-- 인덱스 재구성 (필요시)
REINDEX DATABASE dental_db;
```

---

## 📞 지원 및 문의

### 기술 지원

- **배포 문제**: 스크립트 실행 로그 확인
- **운영 문제**: Docker 로그 및 애플리케이션 로그 확인
- **성능 문제**: NAS 리소스 사용량 모니터링

### 업데이트 정보

- **Git 저장소**: 최신 변경사항 확인
- **릴리즈 노트**: 각 버전별 변경사항
- **마이그레이션 가이드**: 데이터베이스 스키마 변경시

---

## 🔐 보안 고려사항

### 네트워크 보안

```bash
# 방화벽 설정 (예시)
iptables -A INPUT -p tcp --dport 3000 -s 192.168.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP
```

### 데이터 보안

- **정기 백업**: 자동 백업 스크립트 설정
- **암호화**: 데이터베이스 백업 암호화
- **접근 제어**: SSH 키 기반 인증만 허용

### 업데이트 보안

- **권한 최소화**: 배포 스크립트 실행 권한 제한
- **변경 추적**: Git 커밋 기반 변경사항 추적
- **롤백 준비**: 자동 백업으로 빠른 복원 가능

---

## ✅ 체크리스트

### 배포 전 확인사항
- [ ] Git 상태 깨끗함 (커밋 완료)
- [ ] SSH 키 설정 완료
- [ ] NAS Docker 환경 준비
- [ ] 환경 변수 준비

### 배포 후 확인사항
- [ ] 웹 사이트 접속 가능
- [ ] 로그인 기능 정상
- [ ] 파일 업로드 정상
- [ ] 데이터베이스 연결 정상
- [ ] 실행계획 기능 정상
- [ ] 권한 시스템 정상

---

📅 **마지막 업데이트**: 2026-06-08  
🔄 **현재 버전**: v2.0 (실행계획 및 권한 시스템 포함)  
📋 **다음 업데이트 예정**: 추가 보고서 기능, API 개선