-- 통합 달력: 미팅·외부 일정 (추가만)
-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('CLINIC_MEETING', 'SALES_MEETING', 'INTERNAL_MEETING', 'EXTERNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('TENTATIVE', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CalendarVisibility" AS ENUM ('PRIVATE', 'INTERNAL', 'CLINIC');

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "taskId" TEXT,
    "type" "CalendarEventType" NOT NULL,
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'CONFIRMED',
    "visibility" "CalendarVisibility" NOT NULL DEFAULT 'INTERNAL',
    "title" VARCHAR(200) NOT NULL,
    "publicTitle" VARCHAR(200),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "location" VARCHAR(200),
    "internalNotes" TEXT,
    "organizerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventParticipant" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CalendarEventParticipant_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_taskId_key" ON "CalendarEvent"("taskId");

-- CreateIndex
CREATE INDEX "CalendarEvent_clinicId_startAt_idx" ON "CalendarEvent"("clinicId", "startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_startAt_status_idx" ON "CalendarEvent"("startAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_taskId_clinicId_key" ON "CalendarEvent"("taskId", "clinicId");

-- CreateIndex
CREATE INDEX "CalendarEventParticipant_userId_idx" ON "CalendarEventParticipant"("userId");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_taskId_clinicId_fkey" FOREIGN KEY ("taskId", "clinicId") REFERENCES "Task"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_organizerUserId_fkey" FOREIGN KEY ("organizerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventParticipant" ADD CONSTRAINT "CalendarEventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventParticipant" ADD CONSTRAINT "CalendarEventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 끝이 시작보다 빠를 수 없고, 원장 공개 일정은 치과 소속 + 공개 제목 필수
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_range_ck" CHECK ("endAt" >= "startAt");
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_clinic_visible_ck" CHECK ("visibility" <> 'CLINIC' OR ("clinicId" IS NOT NULL AND "publicTitle" IS NOT NULL));
