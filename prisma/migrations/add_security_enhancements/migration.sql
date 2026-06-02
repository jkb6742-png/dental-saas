-- 보안 강화 마이그레이션
-- 1. User 모델에 보안 필드 추가
-- 2. SecurityLog 테이블 추가
-- 3. Row Level Security (RLS) 정책 적용

-- User 테이블에 보안 필드 추가
ALTER TABLE "User" ADD COLUMN "lockedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lockUntil" TIMESTAMP(3);

-- SecurityLog 테이블 생성
CREATE TABLE "SecurityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "clinicId" TEXT,
    "agencyId" TEXT,
    "ip" TEXT,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',

    CONSTRAINT "SecurityLog_pkey" PRIMARY KEY ("id")
);

-- SecurityLog 인덱스 생성
CREATE INDEX "SecurityLog_userId_timestamp_idx" ON "SecurityLog"("userId", "timestamp");
CREATE INDEX "SecurityLog_event_timestamp_idx" ON "SecurityLog"("event", "timestamp");
CREATE INDEX "SecurityLog_clinicId_timestamp_idx" ON "SecurityLog"("clinicId", "timestamp");

-- Row Level Security (RLS) 활성화
ALTER TABLE "Clinic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MonthlySummary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatientStat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreatmentStat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VisitRoute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreatmentPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImplantStat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsultationStat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReceptionRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgeDist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RegionDist" ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성: 사용자는 자신의 에이전시 데이터만 접근 가능
-- Clinic 테이블
CREATE POLICY "Users can only access their agency clinics" ON "Clinic"
    USING (
        "agencyId" IN (
            SELECT "agencyId" FROM "User"
            WHERE "email" = current_setting('app.current_user_email')::text
        )
    );

-- DailyLedger 테이블
CREATE POLICY "Users can only access their clinic daily ledgers" ON "DailyLedger"
    USING (
        "clinicId" IN (
            SELECT c."id" FROM "Clinic" c
            JOIN "User" u ON c."agencyId" = u."agencyId"
            WHERE u."email" = current_setting('app.current_user_email')::text
        )
    );

-- MonthlySummary 테이블
CREATE POLICY "Users can only access their clinic monthly summaries" ON "MonthlySummary"
    USING (
        "clinicId" IN (
            SELECT c."id" FROM "Clinic" c
            JOIN "User" u ON c."agencyId" = u."agencyId"
            WHERE u."email" = current_setting('app.current_user_email')::text
        )
    );

-- PatientStat 테이블
CREATE POLICY "Users can only access their clinic patient stats" ON "PatientStat"
    USING (
        "clinicId" IN (
            SELECT c."id" FROM "Clinic" c
            JOIN "User" u ON c."agencyId" = u."agencyId"
            WHERE u."email" = current_setting('app.current_user_email')::text
        )
    );

-- TreatmentStat 테이블
CREATE POLICY "Users can only access their clinic treatment stats" ON "TreatmentStat"
    USING (
        "clinicId" IN (
            SELECT c."id" FROM "Clinic" c
            JOIN "User" u ON c."agencyId" = u."agencyId"
            WHERE u."email" = current_setting('app.current_user_email')::text
        )
    );

-- VisitRoute 테이블
CREATE POLICY "Users can only access their clinic visit routes" ON "VisitRoute"
    USING (
        "clinicId" IN (
            SELECT c."id" FROM "Clinic" c
            JOIN "User" u ON c."agencyId" = u."agencyId"
            WHERE u."email" = current_setting('app.current_user_email')::text
        )
    );

-- TreatmentPlan 테이블
CREATE POLICY "Users can only access their clinic treatment plans" ON "TreatmentPlan"
    USING (
        "clinicId" IN (
            SELECT c."id" FROM "Clinic" c
            JOIN "User" u ON c."agencyId" = u."agencyId"
            WHERE u."email" = current_setting('app.current_user_email')::text
        )
    );

-- Report 테이블
CREATE POLICY "Users can only access their clinic reports" ON "Report"
    USING (
        "clinicId" IN (
            SELECT c."id" FROM "Clinic" c
            JOIN "User" u ON c."agencyId" = u."agencyId"
            WHERE u."email" = current_setting('app.current_user_email')::text
        )
    );

-- ImplantStat 테이블
CREATE POLICY "Users can only access their clinic implant stats" ON "ImplantStat"
    USING (
        "clinicId" IN (
            SELECT c."id" FROM "Clinic" c
            JOIN "User" u ON c."agencyId" = u."agencyId"
            WHERE u."email" = current_setting('app.current_user_email')::text
        )
    );

-- ConsultationStat 테이블
CREATE POLICY "Users can only access their clinic consultation stats" ON "ConsultationStat"
    USING (
        "clinicId" IN (
            SELECT c."id" FROM "Clinic" c
            JOIN "User" u ON c."agencyId" = u."agencyId"
            WHERE u."email" = current_setting('app.current_user_email')::text
        )
    );

-- ReceptionRecord 테이블
CREATE POLICY "Users can only access their clinic reception records" ON "ReceptionRecord"
    USING (
        "clinicId" IN (
            SELECT c."id" FROM "Clinic" c
            JOIN "User" u ON c."agencyId" = u."agencyId"
            WHERE u."email" = current_setting('app.current_user_email')::text
        )
    );

-- AgeDist 테이블
CREATE POLICY "Users can only access their clinic age distributions" ON "AgeDist"
    USING (
        "clinicId" IN (
            SELECT c."id" FROM "Clinic" c
            JOIN "User" u ON c."agencyId" = u."agencyId"
            WHERE u."email" = current_setting('app.current_user_email')::text
        )
    );

-- RegionDist 테이블
CREATE POLICY "Users can only access their clinic region distributions" ON "RegionDist"
    USING (
        "clinicId" IN (
            SELECT c."id" FROM "Clinic" c
            JOIN "User" u ON c."agencyId" = u."agencyId"
            WHERE u."email" = current_setting('app.current_user_email')::text
        )
    );

-- SecurityLog에 대한 제한적 접근 (관리자만)
CREATE POLICY "Only admins can access security logs" ON "SecurityLog"
    USING (
        EXISTS (
            SELECT 1 FROM "User"
            WHERE "email" = current_setting('app.current_user_email')::text
            AND "role" = 'ADMIN'
        )
    );

-- 함수: 현재 사용자 이메일 설정
CREATE OR REPLACE FUNCTION set_current_user_email(user_email TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_email', user_email, true);
END;
$$ LANGUAGE plpgsql;