# 🏠 NAS 환경 치과 SaaS 설치 가이드

> **NAS 특화 최적화**: 제한된 리소스, 24/7 안정성, 비용 효율성을 고려한 설정

## 📋 **사전 요구사항**

### **NAS 하드웨어 권장사양**
- **CPU**: ARM64 또는 x86-64 (4코어 이상)
- **메모리**: 최소 4GB, 권장 8GB 이상
- **스토리지**: SSD 500GB 이상 (데이터베이스용)
- **네트워크**: 기가비트 이더넷

### **지원 NAS 브랜드**
- ✅ **Synology** (DSM 7.0 이상, Docker 지원)
- ✅ **QNAP** (QTS 5.0 이상, Container Station)
- ✅ **ASUSTOR** (ADM 4.0 이상, Docker CE)
- ✅ **TrueNAS** (Core/Scale, Docker 지원)

## 🚀 **설치 단계**

### **1. NAS Docker 환경 준비**

#### Synology NAS
```bash
# Package Center에서 Docker 설치
# SSH 접속 후
sudo -i
cd /volume1/docker/dental-saas
```

#### QNAP NAS
```bash
# Container Station 설치
# SSH 접속 후
cd /share/Container/dental-saas
```

### **2. 프로젝트 파일 업로드**
```bash
# NAS 공유 폴더에 프로젝트 복사
# 또는 Git 클론
git clone https://github.com/your-repo/dental-saas.git
cd dental-saas
```

### **3. 환경 변수 설정**
```bash
# .env 파일 생성
cp .env.example .env.nas

# NAS 특화 설정 편집
nano .env.nas
```

**NAS 환경 변수 예시**:
```env
# 기본 설정
NODE_ENV=production
DATABASE_URL="postgresql://dental_user:secure_password@localhost:5432/dental_db"
NEXTAUTH_SECRET="your-32-character-secret-key"

# NAS 최적화
MAX_PAGE_SIZE=50
DEFAULT_PAGE_SIZE=20
CACHE_DIR=/app/cache
ENABLE_FILE_CACHE=true
COMPRESSION_ENABLED=true

# 리소스 제한
NODE_OPTIONS="--max-old-space-size=768"
```

### **4. Docker 볼륨 생성**
```bash
# 영구 데이터 볼륨 생성
docker volume create dental-postgres-data
docker volume create dental-redis-data

# NAS 스토리지 디렉토리 생성
mkdir -p /volume1/docker/dental-saas/{cache,uploads,logs,postgres-backup}
```

### **5. 애플리케이션 실행**

#### 기본 실행 (PostgreSQL + App)
```bash
docker-compose -f docker-compose.nas.yml up -d
```

#### Redis 포함 실행 (메모리 여유 시)
```bash
docker-compose -f docker-compose.nas.yml --profile with-redis up -d
```

#### 모니터링 포함 실행
```bash
docker-compose -f docker-compose.nas.yml --profile monitoring up -d
```

### **6. 데이터베이스 초기 설정**
```bash
# 컨테이너 접속
docker exec -it dental-saas-app sh

# Prisma 마이그레이션
npx prisma migrate deploy

# 인덱스 적용
npx prisma db execute --file=./prisma/migrations/001_performance_indexes.sql

# 초기 데이터 생성 (선택)
npx prisma db seed
```

## 📊 **성능 최적화 확인**

### **1. 애플리케이션 상태 확인**
```bash
# 헬스체크
curl http://localhost:3000/api/health

# 성능 통계 (관리자 계정 필요)
curl http://localhost:3000/api/admin/performance
```

### **2. 데이터베이스 성능 확인**
```bash
# 컨테이너 접속
docker exec -it dental-db psql -U dental_user -d dental_db

-- 느린 쿼리 확인
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE mean_exec_time > 1000 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- 인덱스 사용률 확인
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes 
WHERE idx_scan > 0 
ORDER BY idx_scan DESC;
```

### **3. 리소스 사용량 모니터링**
```bash
# 컨테이너 리소스 확인
docker stats

# NAS 시스템 리소스
top
free -h
df -h
```

## 🔧 **NAS별 특별 설정**

### **Synology DSM**
```bash
# 방화벽 규칙
# 제어판 → 보안 → 방화벽 → 편집 규칙
# 포트 3000 허용

# 작업 스케줄러 (백업)
# 제어판 → 작업 스케줄러 → 생성 → 사용자 정의 스크립트
# 스크립트: docker-compose -f docker-compose.nas.yml --profile backup run --rm dental-backup
```

### **QNAP QTS**
```bash
# 방화벽 설정
# 제어판 → 시스템 → 보안 → 방화벽

# crontab 백업 설정
echo "0 2 * * * cd /share/Container/dental-saas && docker-compose -f docker-compose.nas.yml --profile backup run --rm dental-backup" | crontab -
```

## 📈 **성능 벤치마크**

### **NAS별 예상 성능**
| 모델 | CPU | RAM | 동시사용자 | 응답시간 |
|------|-----|-----|------------|----------|
| Synology DS920+ | Celeron J4125 | 4GB | ~10명 | 200-500ms |
| QNAP TS-464 | Celeron N5105 | 8GB | ~20명 | 150-400ms |
| Synology DS1621+ | Ryzen V1500B | 4GB | ~15명 | 180-450ms |
| ASUSTOR AS6604T | Intel i3 | 8GB | ~25명 | 120-350ms |

### **최적화 후 예상 개선**
- **페이지 로딩**: 5초 → 1-2초 (75% 개선)
- **대량 데이터**: 20초+ → 3-5초 (80% 개선)
- **메모리 사용**: -40% 절약
- **네트워크**: -30% 절약 (압축 적용)

## 🛠️ **문제 해결**

### **메모리 부족 시**
```bash
# Redis 비활성화
docker-compose -f docker-compose.nas.yml stop dental-redis

# 메모리 제한 조정
# docker-compose.nas.yml에서 memory 값 감소
```

### **성능 저하 시**
```bash
# 캐시 정리
curl -X DELETE "http://localhost:3000/api/regions?clinicId=YOUR_CLINIC_ID"

# 데이터베이스 VACUUM
docker exec -it dental-db psql -U dental_user -d dental_db -c "VACUUM ANALYZE;"
```

### **로그 확인**
```bash
# 애플리케이션 로그
docker logs dental-saas-app

# 데이터베이스 로그
docker logs dental-db

# 시스템 리소스
docker stats --no-stream
```

## 🔐 **보안 설정**

### **NAS 방화벽**
```bash
# 포트 3000만 허용
# 외부 접근 시 Reverse Proxy 사용 권장
```

### **HTTPS 설정** (Let's Encrypt)
```bash
# Nginx Proxy Manager 또는 Traefik 사용 권장
# 또는 NAS 내장 역방향 프록시 사용
```

## 📅 **유지보수**

### **정기 백업**
```bash
# 매일 새벽 2시 자동 백업
0 2 * * * docker-compose -f docker-compose.nas.yml --profile backup run --rm dental-backup
```

### **업데이트**
```bash
# 이미지 업데이트
docker-compose -f docker-compose.nas.yml pull
docker-compose -f docker-compose.nas.yml up -d
```

### **모니터링**
- 관리자 대시보드: `http://your-nas:3000/admin/performance`
- NAS 모니터링 도구 연동
- 알림 설정 (메모리/CPU 임계값)

---

**🎯 이 설정으로 NAS에서 안정적이고 효율적인 치과 SaaS를 운영할 수 있습니다!**

문제 발생 시 로그를 확인하고, GitHub Issues에 문의하세요.