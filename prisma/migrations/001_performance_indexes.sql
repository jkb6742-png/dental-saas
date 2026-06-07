-- 성능 최적화를 위한 인덱스 추가
-- 실행: npx prisma db execute --file=./prisma/migrations/001_performance_indexes.sql --schema=./prisma/schema.prisma

-- 1. ReceptionRecord 최적화 (환자 데이터 검색용)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReceptionRecord_patient_search_idx"
ON "ReceptionRecord" ("clinicId", "patientName", "chartNumber");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReceptionRecord_date_revenue_idx"
ON "ReceptionRecord" ("clinicId", "year", "month", "receptionTime", "totalRevenue");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReceptionRecord_waiting_analysis_idx"
ON "ReceptionRecord" ("clinicId", "year", "month", "waitingTime")
WHERE "waitingTime" IS NOT NULL;

-- 2. RegionDist 최적화 (지역별 분석용)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "RegionDist_region_analysis_idx"
ON "RegionDist" ("clinicId", "region", "year")
INCLUDE ("totalPatients", "newPatients", "returningPatients");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "RegionDist_monthly_stats_idx"
ON "RegionDist" ("clinicId", "year", "month", "totalPatients" DESC);

-- 3. AgeDist 최적화 (연령별 분석용)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AgeDist_age_analysis_idx"
ON "AgeDist" ("clinicId", "ageGroup", "year")
INCLUDE ("totalPatients", "newPatients", "returningPatients");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AgeDist_monthly_stats_idx"
ON "AgeDist" ("clinicId", "year", "month", "totalPatients" DESC);

-- 4. DailyLedger 최적화 (일별 수익 분석용)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DailyLedger_revenue_analysis_idx"
ON "DailyLedger" ("clinicId", "date", "totalIncome" DESC, "netTotal" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "DailyLedger_date_range_idx"
ON "DailyLedger" ("clinicId", "date")
INCLUDE ("totalIncome", "totalExpense", "netTotal");

-- 5. MonthlySummary 최적화 (월별 요약 분석용)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MonthlySummary_growth_analysis_idx"
ON "MonthlySummary" ("clinicId", "year", "month")
INCLUDE ("revenueGrowth", "newPatientGrowth", "revisitRate");

-- 6. TreatmentStat 최적화 (진료항목별 분석용)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "TreatmentStat_item_analysis_idx"
ON "TreatmentStat" ("clinicId", "itemName", "year", "month")
INCLUDE ("revenue", "patientCount", "visitCount");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "TreatmentStat_revenue_ranking_idx"
ON "TreatmentStat" ("clinicId", "year", "month", "revenue" DESC);

-- 7. Review 최적화 (리뷰 분석용)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Review_rating_analysis_idx"
ON "Review" ("clinicId", "rating", "reviewDate" DESC)
WHERE "rating" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Review_sentiment_analysis_idx"
ON "Review" ("clinicId", "isPositive", "reviewDate" DESC)
WHERE "isPositive" IS NOT NULL;

-- 8. FileUpload 최적화 (파일 관리용)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "FileUpload_category_date_idx"
ON "FileUpload" ("clinicId", "category", "year", "month", "uploadedAt" DESC);

-- 9. User 최적화 (사용자 관리용)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_role_status_idx"
ON "User" ("agencyId", "role", "status");

-- 10. 전체 텍스트 검색을 위한 GIN 인덱스 (PostgreSQL 전용)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 환자명 검색용
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReceptionRecord_patient_name_search_idx"
ON "ReceptionRecord" USING gin ("patientName" gin_trgm_ops);

-- 진료항목명 검색용
CREATE INDEX CONCURRENTLY IF NOT EXISTS "TreatmentStat_item_name_search_idx"
ON "TreatmentStat" USING gin ("itemName" gin_trgm_ops);

-- 리뷰 내용 검색용
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Review_content_search_idx"
ON "Review" USING gin ("content" gin_trgm_ops)
WHERE "content" IS NOT NULL;

-- 파셜 인덱스 (조건부 인덱스)
-- 활성 사용자만
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_active_users_idx"
ON "User" ("agencyId", "role", "createdAt")
WHERE "status" = 'APPROVED';

-- 미처리 파일만
CREATE INDEX CONCURRENTLY IF NOT EXISTS "FileUpload_pending_files_idx"
ON "FileUpload" ("clinicId", "uploadedAt")
WHERE "status" IN ('PENDING', 'PROCESSING');

-- 최근 3개월 데이터만 (최신 데이터 빠른 조회)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReceptionRecord_recent_idx"
ON "ReceptionRecord" ("clinicId", "receptionTime" DESC, "totalRevenue")
WHERE "receptionTime" >= CURRENT_DATE - INTERVAL '3 months';

-- 통계를 업데이트하여 쿼리 플래너가 올바른 인덱스를 선택하도록 함
ANALYZE;

-- 인덱스 사용량 확인용 뷰 생성
CREATE OR REPLACE VIEW performance_monitor AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan > 0
ORDER BY idx_scan DESC;