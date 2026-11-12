-- THINKLAB 직원 전용 영역: 직원·담당치과·업무·공유파일·근태·연차 (추가만, 기존 표 변경 없음)
-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('BLOG', 'IMAGE', 'WEBSITE', 'REPORT', 'ADS', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskActivityType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNEE_CHANGED', 'DUE_DATE_CHANGED', 'CONTENT_CHANGED', 'REOPENED');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('INTERNAL', 'CLINIC');

-- CreateEnum
CREATE TYPE "AttendanceClass" AS ENUM ('WORKED', 'PAID_LEAVE', 'BUSINESS_TRIP', 'ABSENT', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('SELF', 'MANAGER');

-- CreateEnum
CREATE TYPE "LeaveUnit" AS ENUM ('FULL', 'HALF_AM', 'HALF_PM');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveLedgerType" AS ENUM ('GRANT', 'USE', 'EXPIRE', 'ADJUST', 'REVERSAL');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STAFF';

-- CreateTable
CREATE TABLE "Employee" (
    "userId" TEXT NOT NULL,
    "hiredOn" DATE NOT NULL,
    "leftOn" DATE,
    "weeklyContractMinutes" INTEGER NOT NULL DEFAULT 2400,
    "workWeekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "StaffClinicAccess" (
    "employeeUserId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffClinicAccess_pkey" PRIMARY KEY ("employeeUserId","clinicId")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" "TaskCategory" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "assigneeUserId" TEXT,
    "serviceRequestId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "startOn" DATE,
    "dueOn" DATE,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskActivity" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "TaskActivityType" NOT NULL,
    "oldValue" VARCHAR(300),
    "newValue" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedFile" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "taskId" TEXT,
    "serviceRequestId" TEXT,
    "visibility" "FileVisibility" NOT NULL DEFAULT 'INTERNAL',
    "title" VARCHAR(200) NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedFileVersion" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedFileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "clockInAt" TIMESTAMPTZ(3),
    "clockOutAt" TIMESTAMPTZ(3),
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "class" "AttendanceClass",
    "source" "AttendanceSource" NOT NULL DEFAULT 'SELF',
    "note" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "startOn" DATE NOT NULL,
    "endOn" DATE NOT NULL,
    "unit" "LeaveUnit" NOT NULL DEFAULT 'FULL',
    "requestedDays" DECIMAL(5,2) NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveLedgerEntry" (
    "id" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "type" "LeaveLedgerType" NOT NULL,
    "deltaDays" DECIMAL(5,2) NOT NULL,
    "effectiveOn" DATE NOT NULL,
    "expiresOn" DATE,
    "grantEntryId" TEXT,
    "leaveRequestId" TEXT,
    "reversesEntryId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "note" VARCHAR(200),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffClinicAccess_clinicId_idx" ON "StaffClinicAccess"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_serviceRequestId_key" ON "Task"("serviceRequestId");

-- CreateIndex
CREATE INDEX "Task_clinicId_status_dueOn_idx" ON "Task"("clinicId", "status", "dueOn");

-- CreateIndex
CREATE INDEX "Task_assigneeUserId_status_dueOn_idx" ON "Task"("assigneeUserId", "status", "dueOn");

-- CreateIndex
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Task_id_clinicId_key" ON "Task"("id", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_serviceRequestId_clinicId_key" ON "Task"("serviceRequestId", "clinicId");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskActivity_taskId_createdAt_idx" ON "TaskActivity"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskActivity_type_createdAt_idx" ON "TaskActivity"("type", "createdAt");

-- CreateIndex
CREATE INDEX "SharedFile_clinicId_visibility_deletedAt_idx" ON "SharedFile"("clinicId", "visibility", "deletedAt");

-- CreateIndex
CREATE INDEX "SharedFile_taskId_idx" ON "SharedFile"("taskId");

-- CreateIndex
CREATE INDEX "SharedFile_serviceRequestId_idx" ON "SharedFile"("serviceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedFileVersion_storageKey_key" ON "SharedFileVersion"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "SharedFileVersion_fileId_versionNo_key" ON "SharedFileVersion"("fileId", "versionNo");

-- CreateIndex
CREATE INDEX "AttendanceRecord_workDate_idx" ON "AttendanceRecord"("workDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_employeeUserId_workDate_key" ON "AttendanceRecord"("employeeUserId", "workDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeUserId_startOn_endOn_idx" ON "LeaveRequest"("employeeUserId", "startOn", "endOn");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_createdAt_idx" ON "LeaveRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveLedgerEntry_reversesEntryId_key" ON "LeaveLedgerEntry"("reversesEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveLedgerEntry_sourceKey_key" ON "LeaveLedgerEntry"("sourceKey");

-- CreateIndex
CREATE INDEX "LeaveLedgerEntry_employeeUserId_effectiveOn_idx" ON "LeaveLedgerEntry"("employeeUserId", "effectiveOn");

-- CreateIndex
CREATE INDEX "LeaveLedgerEntry_grantEntryId_idx" ON "LeaveLedgerEntry"("grantEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_id_clinicId_key" ON "ServiceRequest"("id", "clinicId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffClinicAccess" ADD CONSTRAINT "StaffClinicAccess_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "Employee"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffClinicAccess" ADD CONSTRAINT "StaffClinicAccess_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "Employee"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_serviceRequestId_clinicId_fkey" FOREIGN KEY ("serviceRequestId", "clinicId") REFERENCES "ServiceRequest"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedFile" ADD CONSTRAINT "SharedFile_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedFile" ADD CONSTRAINT "SharedFile_taskId_clinicId_fkey" FOREIGN KEY ("taskId", "clinicId") REFERENCES "Task"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedFile" ADD CONSTRAINT "SharedFile_serviceRequestId_clinicId_fkey" FOREIGN KEY ("serviceRequestId", "clinicId") REFERENCES "ServiceRequest"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedFile" ADD CONSTRAINT "SharedFile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedFileVersion" ADD CONSTRAINT "SharedFileVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "SharedFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedFileVersion" ADD CONSTRAINT "SharedFileVersion_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "Employee"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "Employee"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "Employee"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_grantEntryId_fkey" FOREIGN KEY ("grantEntryId") REFERENCES "LeaveLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_reversesEntryId_fkey" FOREIGN KEY ("reversesEntryId") REFERENCES "LeaveLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- 치과 공개 파일은 반드시 치과 소속, 업무·요청에 붙은 파일도 치과 소속
ALTER TABLE "SharedFile" ADD CONSTRAINT "SharedFile_scope_ck" CHECK (
  ("visibility" <> 'CLINIC' OR "clinicId" IS NOT NULL)
  AND ("taskId" IS NULL OR "clinicId" IS NOT NULL)
  AND ("serviceRequestId" IS NULL OR "clinicId" IS NOT NULL)
);
-- 연차 거래 부호: 발생은 양수, 사용·소멸은 음수
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_sign_ck" CHECK (
  ("type" = 'GRANT' AND "deltaDays" > 0)
  OR ("type" IN ('USE','EXPIRE') AND "deltaDays" < 0)
  OR ("type" IN ('ADJUST','REVERSAL'))
);
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_range_ck" CHECK ("endOn" >= "startOn" AND "requestedDays" > 0);
