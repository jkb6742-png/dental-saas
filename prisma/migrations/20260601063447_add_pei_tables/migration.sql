/*
  Warnings:

  - You are about to drop the column `agencyId` on the `InviteCode` table. All the data in the column will be lost.
  - Added the required column `clinicId` to the `InviteCode` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "InviteCode" DROP CONSTRAINT "InviteCode_agencyId_fkey";

-- DropIndex
DROP INDEX "InviteCode_agencyId_isActive_idx";

-- AlterTable
ALTER TABLE "InviteCode" DROP COLUMN "agencyId",
ADD COLUMN     "clinicId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "PeiSheetConfig" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "sheetUrl" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "sheetName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeiSheetConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeiReport" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "sheetConfigId" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "insights" JSONB,
    "recommendations" JSONB,
    "rawData" JSONB,
    "peiScore" DOUBLE PRECISION,
    "categoryScores" JSONB,
    "content" TEXT,
    "pdfUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'GENERATING',
    "generatedAt" TIMESTAMP(3),
    "generatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeiReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PeiSheetConfig_clinicId_key" ON "PeiSheetConfig"("clinicId");

-- CreateIndex
CREATE INDEX "PeiSheetConfig_clinicId_isActive_idx" ON "PeiSheetConfig"("clinicId", "isActive");

-- CreateIndex
CREATE INDEX "PeiReport_clinicId_status_idx" ON "PeiReport"("clinicId", "status");

-- CreateIndex
CREATE INDEX "PeiReport_generatedAt_idx" ON "PeiReport"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PeiReport_clinicId_year_month_key" ON "PeiReport"("clinicId", "year", "month");

-- CreateIndex
CREATE INDEX "InviteCode_clinicId_isActive_idx" ON "InviteCode"("clinicId", "isActive");

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeiSheetConfig" ADD CONSTRAINT "PeiSheetConfig_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeiSheetConfig" ADD CONSTRAINT "PeiSheetConfig_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeiReport" ADD CONSTRAINT "PeiReport_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeiReport" ADD CONSTRAINT "PeiReport_sheetConfigId_fkey" FOREIGN KEY ("sheetConfigId") REFERENCES "PeiSheetConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeiReport" ADD CONSTRAINT "PeiReport_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
