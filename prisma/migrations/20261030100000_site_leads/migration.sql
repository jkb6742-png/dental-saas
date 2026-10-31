-- 홈페이지 상담문의 연동 (멱등)
CREATE TABLE IF NOT EXISTS "SiteLeadSource" (
  "id" TEXT PRIMARY KEY,
  "clinicId" TEXT NOT NULL,
  "siteUrl" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncStatus" TEXT,
  "lastSyncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "SiteLeadSource_clinicId_key" ON "SiteLeadSource"("clinicId");

CREATE TABLE IF NOT EXISTS "SiteLead" (
  "id" TEXT PRIMARY KEY,
  "clinicId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "siteLeadId" INTEGER NOT NULL,
  "boTable" TEXT NOT NULL,
  "wrId" INTEGER NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "siteUpdatedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL,
  "statusLabel" TEXT,
  "name" TEXT,
  "phone" TEXT,
  "category" TEXT,
  "subject" TEXT,
  "channel" TEXT,
  "path" TEXT,
  "src" TEXT,
  "srcLabel" TEXT,
  "med" TEXT,
  "medLabel" TEXT,
  "campaign" TEXT,
  "noteCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "SiteLead_sourceId_siteLeadId_key" ON "SiteLead"("sourceId", "siteLeadId");
CREATE INDEX IF NOT EXISTS "SiteLead_clinicId_receivedAt_idx" ON "SiteLead"("clinicId", "receivedAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteLeadSource_clinicId_fkey') THEN
    ALTER TABLE "SiteLeadSource" ADD CONSTRAINT "SiteLeadSource_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteLead_clinicId_fkey') THEN
    ALTER TABLE "SiteLead" ADD CONSTRAINT "SiteLead_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteLead_sourceId_fkey') THEN
    ALTER TABLE "SiteLead" ADD CONSTRAINT "SiteLead_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SiteLeadSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
