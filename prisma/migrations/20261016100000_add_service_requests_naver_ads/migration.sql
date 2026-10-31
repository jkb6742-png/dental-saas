-- 요청사항 + 네이버 검색광고 연동 (멱등: 운영 NAS 는 /api/requests/init-db 로 동일 SQL 실행)
DO $$ BEGIN CREATE TYPE "ServiceRequestCategory" AS ENUM ('IMAGE','CONTENT','WEBSITE','REPORT','ADS','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ServiceRequestStatus" AS ENUM ('REQUESTED','IN_REVIEW','IN_PROGRESS','DONE','CANCELED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ServiceRequestPriority" AS ENUM ('HIGH','MEDIUM','LOW'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ServiceRequest" (
  "id" TEXT PRIMARY KEY,
  "clinicId" TEXT NOT NULL,
  "category" "ServiceRequestCategory" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "details" JSONB,
  "status" "ServiceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "priority" "ServiceRequestPriority" NOT NULL DEFAULT 'MEDIUM',
  "dueDate" TIMESTAMP(3),
  "assignee" TEXT,
  "resultNote" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceRequest_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ServiceRequest_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ServiceRequest_clinicId_status_idx" ON "ServiceRequest"("clinicId","status");
CREATE INDEX IF NOT EXISTS "ServiceRequest_clinicId_createdAt_idx" ON "ServiceRequest"("clinicId","createdAt");
CREATE INDEX IF NOT EXISTS "ServiceRequest_status_createdAt_idx" ON "ServiceRequest"("status","createdAt");

CREATE TABLE IF NOT EXISTS "ServiceRequestComment" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceRequestComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ServiceRequestComment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ServiceRequestComment_requestId_createdAt_idx" ON "ServiceRequestComment"("requestId","createdAt");

CREATE TABLE IF NOT EXISTS "ServiceRequestAttachment" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'REFERENCE',
  "uploadedBy" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceRequestAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ServiceRequestAttachment_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ServiceRequestAttachment_requestId_idx" ON "ServiceRequestAttachment"("requestId");

CREATE TABLE IF NOT EXISTS "NaverAdAccount" (
  "id" TEXT PRIMARY KEY,
  "clinicId" TEXT NOT NULL UNIQUE,
  "customerId" TEXT NOT NULL,
  "apiKey" TEXT NOT NULL,
  "secretKey" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncStatus" TEXT,
  "lastSyncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NaverAdAccount_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "NaverAdDailyStat" (
  "id" TEXT PRIMARY KEY,
  "clinicId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "campaignId" TEXT NOT NULL,
  "campaignName" TEXT NOT NULL,
  "campaignType" TEXT,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "cost" INTEGER NOT NULL DEFAULT 0,
  "avgRank" DOUBLE PRECISION,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NaverAdDailyStat_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "NaverAdDailyStat_clinicId_date_campaignId_key" ON "NaverAdDailyStat"("clinicId","date","campaignId");
CREATE INDEX IF NOT EXISTS "NaverAdDailyStat_clinicId_date_idx" ON "NaverAdDailyStat"("clinicId","date");
