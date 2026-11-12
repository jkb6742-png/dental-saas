-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('OFFICE', 'REMOTE');

-- CreateEnum
CREATE TYPE "RemoteCheckStatus" AS ENUM ('SCHEDULED', 'SHOWN', 'VERIFIED', 'MISSED', 'CANCELLED', 'EXCUSED');

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "clockInIp" VARCHAR(64),
ADD COLUMN     "clockOutIp" VARCHAR(64),
ADD COLUMN     "workMode" "WorkMode";

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "employmentType" VARCHAR(20),
ADD COLUMN     "jobTitle" VARCHAR(40),
ADD COLUMN     "memo" VARCHAR(500),
ADD COLUMN     "phone" VARCHAR(20),
ADD COLUMN     "workEnd" VARCHAR(5) NOT NULL DEFAULT '18:00',
ADD COLUMN     "workMode" "WorkMode" NOT NULL DEFAULT 'OFFICE',
ADD COLUMN     "workStart" VARCHAR(5) NOT NULL DEFAULT '09:00';

-- CreateTable
CREATE TABLE "AttendanceNetwork" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "cidr" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSetting" (
    "agencyId" TEXT NOT NULL,
    "remoteChecksPerDay" INTEGER NOT NULL DEFAULT 2,
    "qrSeconds" INTEGER NOT NULL DEFAULT 90,
    "graceMinutes" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSetting_pkey" PRIMARY KEY ("agencyId")
);

-- CreateTable
CREATE TABLE "RemoteCheck" (
    "id" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "RemoteCheckStatus" NOT NULL DEFAULT 'SCHEDULED',
    "shownAt" TIMESTAMPTZ(3),
    "tokenHash" VARCHAR(64),
    "tokenExpiresAt" TIMESTAMPTZ(3),
    "matchCode" VARCHAR(2),
    "reissueCount" INTEGER NOT NULL DEFAULT 0,
    "deadlineAt" TIMESTAMPTZ(3),
    "verifiedAt" TIMESTAMPTZ(3),
    "verifiedIp" VARCHAR(64),
    "verifiedUa" VARCHAR(300),
    "wrongAttempts" INTEGER NOT NULL DEFAULT 0,
    "reason" VARCHAR(300),
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemoteCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceNetwork_agencyId_idx" ON "AttendanceNetwork"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteCheck_tokenHash_key" ON "RemoteCheck"("tokenHash");

-- CreateIndex
CREATE INDEX "RemoteCheck_employeeUserId_workDate_idx" ON "RemoteCheck"("employeeUserId", "workDate");

-- CreateIndex
CREATE INDEX "RemoteCheck_status_scheduledAt_idx" ON "RemoteCheck"("status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "RemoteCheck" ADD CONSTRAINT "RemoteCheck_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "Employee"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "EmployeeSalary" (
    "id" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "effectiveOn" DATE NOT NULL,
    "annualSalary" INTEGER NOT NULL,
    "reason" VARCHAR(100),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSalary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeSalary_employeeUserId_effectiveOn_idx" ON "EmployeeSalary"("employeeUserId", "effectiveOn");

-- AddForeignKey
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "Employee"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "clinicId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TaskGroup" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "name" VARCHAR(60) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskGroup_clinicId_archivedAt_sortOrder_idx" ON "TaskGroup"("clinicId", "archivedAt", "sortOrder");

-- CreateIndex
CREATE INDEX "Task_groupId_sortOrder_idx" ON "Task"("groupId", "sortOrder");

-- AddForeignKey
ALTER TABLE "TaskGroup" ADD CONSTRAINT "TaskGroup_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TaskGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- 사내 업무(치과 없음)에도 파일을 붙일 수 있게: 업무 파일의 치과 필수 조건 제거(앱이 업무의 치과와 같게 맞춘다)
ALTER TABLE "SharedFile" DROP CONSTRAINT "SharedFile_scope_ck";
ALTER TABLE "SharedFile" ADD CONSTRAINT "SharedFile_scope_ck" CHECK (
  ("visibility" <> 'CLINIC' OR "clinicId" IS NOT NULL)
  AND ("serviceRequestId" IS NULL OR "clinicId" IS NOT NULL)
);
-- CreateTable
CREATE TABLE "TaskChecklistItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "doneAt" TIMESTAMPTZ(3),
    "doneByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkPin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "refId" VARCHAR(40) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkMemo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "clinicId" TEXT,
    "convertedTaskId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkMemo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskChecklistItem_taskId_sortOrder_idx" ON "TaskChecklistItem"("taskId", "sortOrder");

-- CreateIndex
CREATE INDEX "WorkPin_userId_sortOrder_idx" ON "WorkPin"("userId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPin_userId_kind_refId_key" ON "WorkPin"("userId", "kind", "refId");

-- CreateIndex
CREATE INDEX "WorkMemo_userId_archivedAt_createdAt_idx" ON "WorkMemo"("userId", "archivedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "OvertimeRecord" (
    "id" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'PENDING',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMPTZ(3),
    "decisionNote" VARCHAR(200),
    "source" VARCHAR(12) NOT NULL DEFAULT 'SELF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OvertimeRecord_employeeUserId_workDate_idx" ON "OvertimeRecord"("employeeUserId", "workDate");

-- CreateIndex
CREATE INDEX "OvertimeRecord_status_workDate_idx" ON "OvertimeRecord"("status", "workDate");

-- AddForeignKey
ALTER TABLE "OvertimeRecord" ADD CONSTRAINT "OvertimeRecord_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "Employee"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ServiceAccount" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clinicId" TEXT,
    "category" VARCHAR(40) NOT NULL,
    "label" VARCHAR(80),
    "loginId" VARCHAR(200),
    "passwordEnc" TEXT,
    "url" VARCHAR(500),
    "memo" VARCHAR(500),
    "visibility" VARCHAR(10) NOT NULL DEFAULT 'STAFF',
    "passwordChangedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceAccount_agencyId_clinicId_idx" ON "ServiceAccount"("agencyId", "clinicId");

-- AlterTable
ALTER TABLE "SharedFile" ADD COLUMN     "imageFolderId" TEXT;

-- CreateTable
CREATE TABLE "ImageFolder" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clinicId" TEXT,
    "parentId" TEXT,
    "name" VARCHAR(80) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageFolder_agencyId_clinicId_parentId_idx" ON "ImageFolder"("agencyId", "clinicId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageFolder_agencyId_path_key" ON "ImageFolder"("agencyId", "path");

