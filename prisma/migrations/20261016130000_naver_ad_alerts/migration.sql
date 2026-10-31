-- 네이버 검색광고 알림 설정 (멱등)
ALTER TABLE "NaverAdAccount" ADD COLUMN IF NOT EXISTS "alertEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NaverAdAccount" ADD COLUMN IF NOT EXISTS "alertThreshold" INTEGER NOT NULL DEFAULT 100000;
ALTER TABLE "NaverAdAccount" ADD COLUMN IF NOT EXISTS "alertEmails" TEXT;
ALTER TABLE "NaverAdAccount" ADD COLUMN IF NOT EXISTS "alertOnSyncFail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NaverAdAccount" ADD COLUMN IF NOT EXISTS "lastAlertAt" TIMESTAMP(3);
ALTER TABLE "NaverAdAccount" ADD COLUMN IF NOT EXISTS "lastBizmoney" INTEGER;
ALTER TABLE "NaverAdAccount" ADD COLUMN IF NOT EXISTS "lastBizmoneyAt" TIMESTAMP(3);
ALTER TABLE "NaverAdAccount" ADD COLUMN IF NOT EXISTS "autoMonthlyReport" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "NaverAdReport" (
  "id" TEXT PRIMARY KEY,
  "clinicId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "compareStart" DATE NOT NULL,
  "compareEnd" DATE NOT NULL,
  "memo" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DONE',
  "error" TEXT,
  "model" TEXT,
  "summary" JSONB,
  "html" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NaverAdReport_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "NaverAdReport_clinicId_createdAt_idx" ON "NaverAdReport"("clinicId", "createdAt");
