-- THINKLAB 운영 V4: 계약·월 분량·검수·발행 기록·업체 메모·청구·입금·월 마감·영업·메신저·알림 발송 (추가만)
-- CreateEnum
CREATE TYPE "DeliverableKind" AS ENUM ('BLOG_POST', 'WEBSITE_COLUMN', 'IMAGE_ASSET', 'MANAGEMENT_REPORT', 'PEI_REPORT', 'BLOG_REPORT', 'ADS_REPORT', 'CLINIC_MEETING', 'SEARCH_AD_OPERATION', 'WEBSITE_MAINTENANCE');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "VatTreatment" AS ENUM ('UNCONFIRMED', 'INCLUDED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'CHANGES_REQUIRED');

-- CreateEnum
CREATE TYPE "SalesStage" AS ENUM ('NEW', 'CONTACTED', 'MEETING', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('BLOG', 'COLUMN');

-- CreateEnum
CREATE TYPE "ContentSource" AS ENUM ('MANUAL', 'BOKBOK', 'WEBSITE');

-- CreateEnum
CREATE TYPE "PublishVerification" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClinicNoteKind" AS ENUM ('CALL', 'MEETING', 'REQUEST', 'SPECIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ChatRoomType" AS ENUM ('DIRECT', 'GROUP', 'CLINIC');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WEB_PUSH');

-- CreateEnum
CREATE TYPE "DeliveryState" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RequestSource" AS ENUM ('APP', 'KAKAO', 'PHONE', 'EMAIL', 'MEETING', 'OTHER');

-- AlterEnum
ALTER TYPE "TaskCategory" ADD VALUE IF NOT EXISTS 'MEETING';

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "dedupKey" TEXT,
ADD COLUMN     "groupKey" TEXT;

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "enteredByUserId" TEXT,
ADD COLUMN     "source" "RequestSource" NOT NULL DEFAULT 'APP';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "blockedReason" VARCHAR(200),
ADD COLUMN     "externalWorkUrl" VARCHAR(1000),
ADD COLUMN     "fulfilledAt" TIMESTAMPTZ(3),
ADD COLUMN     "generationKey" TEXT,
ADD COLUMN     "monthlyCommitmentId" TEXT,
ADD COLUMN     "quotaSlot" INTEGER,
ADD COLUMN     "resultUrl" VARCHAR(1000),
ADD COLUMN     "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduledPublishAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "ClinicContract" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "originOpportunityId" TEXT,
    "planName" VARCHAR(100) NOT NULL,
    "monthlyFeeKrw" INTEGER NOT NULL,
    "vatTreatment" "VatTreatment" NOT NULL DEFAULT 'UNCONFIRMED',
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "billDayOfMonth" INTEGER,
    "paymentDueDay" INTEGER,
    "paymentDueMonthOffset" INTEGER NOT NULL DEFAULT 0,
    "signedContractUrl" VARCHAR(1000),
    "creatorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractLine" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "kind" "DeliverableKind" NOT NULL,
    "monthlyTarget" INTEGER NOT NULL,
    "defaultDueDay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyCommitment" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "contractLineId" TEXT,
    "monthStart" DATE NOT NULL,
    "kind" "DeliverableKind" NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "adjustmentReason" VARCHAR(300),
    "adjustedByUserId" TEXT,
    "adjustedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskReview" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "artifactVersionId" TEXT,
    "reviewerUserId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "claimsChecked" BOOLEAN NOT NULL DEFAULT false,
    "riskDisclosureChecked" BOOLEAN NOT NULL DEFAULT false,
    "anonymizationChecked" BOOLEAN NOT NULL DEFAULT false,
    "casePhotoConsentChecked" BOOLEAN,
    "note" VARCHAR(1000),
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOpportunity" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "clinicName" VARCHAR(160) NOT NULL,
    "stage" "SalesStage" NOT NULL DEFAULT 'NEW',
    "contactPerson" VARCHAR(100),
    "contactChannel" VARCHAR(40),
    "contactValue" VARCHAR(200),
    "region" VARCHAR(100),
    "proposalUrl" VARCHAR(1000),
    "expectedMonthlyFeeKrw" INTEGER,
    "nextActionOn" DATE,
    "nextAction" VARCHAR(200),
    "ownerUserId" TEXT,
    "lostReason" VARCHAR(300),
    "wonAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCycle" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "serviceMonth" DATE NOT NULL,
    "plannedBillOn" DATE NOT NULL,
    "dueOn" DATE NOT NULL,
    "amountDueKrw" INTEGER NOT NULL,
    "billedAt" TIMESTAMPTZ(3),
    "taxInvoiceIssuedAt" TIMESTAMPTZ(3),
    "taxInvoiceNumber" VARCHAR(60),
    "taxCheckedByUserId" TEXT,
    "voidedAt" TIMESTAMPTZ(3),
    "memo" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReceipt" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "billingCycleId" TEXT NOT NULL,
    "receivedOn" DATE NOT NULL,
    "amountKrw" INTEGER NOT NULL,
    "memo" VARCHAR(300),
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedContent" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "taskId" TEXT,
    "kind" "ContentKind" NOT NULL,
    "source" "ContentSource" NOT NULL DEFAULT 'MANUAL',
    "externalPostId" VARCHAR(120),
    "title" VARCHAR(300) NOT NULL,
    "url" TEXT NOT NULL,
    "urlSha256" VARCHAR(64) NOT NULL,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL,
    "serviceMonth" DATE NOT NULL,
    "primaryKeyword" VARCHAR(100),
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authorUserId" TEXT,
    "authorNameSnapshot" VARCHAR(60),
    "reviewerUserId" TEXT,
    "verification" "PublishVerification" NOT NULL DEFAULT 'PENDING',
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),
    "lastSourceEventId" VARCHAR(120),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishedContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicNote" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "kind" "ClinicNoteKind" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" VARCHAR(200),
    "body" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "taskId" TEXT,
    "serviceRequestId" TEXT,
    "calendarEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClinicNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicMonthClose" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "monthStart" DATE NOT NULL,
    "operationsClosedAt" TIMESTAMP(3),
    "operationsClosedById" TEXT,
    "exceptionNote" VARCHAR(1000),
    "financeReviewedAt" TIMESTAMP(3),
    "financeReviewedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicMonthClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRoom" (
    "id" TEXT NOT NULL,
    "type" "ChatRoomType" NOT NULL,
    "clinicId" TEXT,
    "title" VARCHAR(100),
    "directKey" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMember" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadMessageId" BIGINT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),

    CONSTRAINT "ChatMember_pkey" PRIMARY KEY ("roomId","userId")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" BIGSERIAL NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "clientNonce" VARCHAR(64),
    "body" TEXT,
    "taskId" TEXT,
    "serviceRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessageFile" (
    "messageId" BIGINT NOT NULL,
    "fileVersionId" TEXT NOT NULL,

    CONSTRAINT "ChatMessageFile_pkey" PRIMARY KEY ("messageId","fileVersionId")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietStartMinute" INTEGER NOT NULL DEFAULT 1200,
    "quietEndMinute" INTEGER NOT NULL DEFAULT 540,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpointHash" TEXT NOT NULL,
    "endpointCiphertext" TEXT NOT NULL,
    "p256dhCiphertext" TEXT NOT NULL,
    "authCiphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "pushSubscriptionId" TEXT,
    "dedupKey" TEXT NOT NULL,
    "state" "DeliveryState" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lastErrorCode" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicContract_clinicId_status_startsOn_idx" ON "ClinicContract"("clinicId", "status", "startsOn");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicContract_id_clinicId_key" ON "ClinicContract"("id", "clinicId");

-- CreateIndex
CREATE INDEX "ContractLine_clinicId_kind_idx" ON "ContractLine"("clinicId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ContractLine_id_clinicId_key" ON "ContractLine"("id", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractLine_contractId_kind_key" ON "ContractLine"("contractId", "kind");

-- CreateIndex
CREATE INDEX "MonthlyCommitment_monthStart_kind_idx" ON "MonthlyCommitment"("monthStart", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyCommitment_id_clinicId_key" ON "MonthlyCommitment"("id", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyCommitment_clinicId_monthStart_kind_key" ON "MonthlyCommitment"("clinicId", "monthStart", "kind");

-- CreateIndex
CREATE INDEX "TaskReview_taskId_reviewedAt_idx" ON "TaskReview"("taskId", "reviewedAt");

-- CreateIndex
CREATE INDEX "SalesOpportunity_stage_nextActionOn_idx" ON "SalesOpportunity"("stage", "nextActionOn");

-- CreateIndex
CREATE INDEX "SalesOpportunity_clinicId_idx" ON "SalesOpportunity"("clinicId");

-- CreateIndex
CREATE INDEX "BillingCycle_clinicId_serviceMonth_idx" ON "BillingCycle"("clinicId", "serviceMonth");

-- CreateIndex
CREATE INDEX "BillingCycle_dueOn_voidedAt_idx" ON "BillingCycle"("dueOn", "voidedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCycle_id_clinicId_key" ON "BillingCycle"("id", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCycle_contractId_serviceMonth_key" ON "BillingCycle"("contractId", "serviceMonth");

-- CreateIndex
CREATE INDEX "PaymentReceipt_clinicId_receivedOn_idx" ON "PaymentReceipt"("clinicId", "receivedOn");

-- CreateIndex
CREATE INDEX "PaymentReceipt_billingCycleId_idx" ON "PaymentReceipt"("billingCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedContent_taskId_key" ON "PublishedContent"("taskId");

-- CreateIndex
CREATE INDEX "PublishedContent_clinicId_kind_serviceMonth_idx" ON "PublishedContent"("clinicId", "kind", "serviceMonth");

-- CreateIndex
CREATE INDEX "PublishedContent_clinicId_publishedAt_idx" ON "PublishedContent"("clinicId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedContent_clinicId_urlSha256_key" ON "PublishedContent"("clinicId", "urlSha256");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedContent_taskId_clinicId_key" ON "PublishedContent"("taskId", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedContent_source_clinicId_externalPostId_key" ON "PublishedContent"("source", "clinicId", "externalPostId");

-- CreateIndex
CREATE INDEX "ClinicNote_clinicId_occurredAt_idx" ON "ClinicNote"("clinicId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicMonthClose_clinicId_monthStart_key" ON "ClinicMonthClose"("clinicId", "monthStart");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_directKey_key" ON "ChatRoom"("directKey");

-- CreateIndex
CREATE INDEX "ChatRoom_lastMessageAt_idx" ON "ChatRoom"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_type_clinicId_key" ON "ChatRoom"("type", "clinicId");

-- CreateIndex
CREATE INDEX "ChatMember_userId_leftAt_idx" ON "ChatMember"("userId", "leftAt");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_id_idx" ON "ChatMessage"("roomId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_senderUserId_clientNonce_key" ON "ChatMessage"("senderUserId", "clientNonce");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpointHash_key" ON "PushSubscription"("endpointHash");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_revokedAt_idx" ON "PushSubscription"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_dedupKey_key" ON "NotificationDelivery"("dedupKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_state_nextAttemptAt_idx" ON "NotificationDelivery"("state", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_id_clinicId_key" ON "CalendarEvent"("id", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupKey_key" ON "Notification"("dedupKey");

-- CreateIndex
CREATE UNIQUE INDEX "Task_generationKey_key" ON "Task"("generationKey");

-- CreateIndex
CREATE INDEX "Task_monthlyCommitmentId_idx" ON "Task"("monthlyCommitmentId");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_enteredByUserId_fkey" FOREIGN KEY ("enteredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_monthlyCommitmentId_clinicId_fkey" FOREIGN KEY ("monthlyCommitmentId", "clinicId") REFERENCES "MonthlyCommitment"("id", "clinicId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicContract" ADD CONSTRAINT "ClinicContract_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicContract" ADD CONSTRAINT "ClinicContract_originOpportunityId_fkey" FOREIGN KEY ("originOpportunityId") REFERENCES "SalesOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicContract" ADD CONSTRAINT "ClinicContract_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractLine" ADD CONSTRAINT "ContractLine_contractId_clinicId_fkey" FOREIGN KEY ("contractId", "clinicId") REFERENCES "ClinicContract"("id", "clinicId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyCommitment" ADD CONSTRAINT "MonthlyCommitment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyCommitment" ADD CONSTRAINT "MonthlyCommitment_contractLineId_clinicId_fkey" FOREIGN KEY ("contractLineId", "clinicId") REFERENCES "ContractLine"("id", "clinicId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyCommitment" ADD CONSTRAINT "MonthlyCommitment_adjustedByUserId_fkey" FOREIGN KEY ("adjustedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReview" ADD CONSTRAINT "TaskReview_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReview" ADD CONSTRAINT "TaskReview_artifactVersionId_fkey" FOREIGN KEY ("artifactVersionId") REFERENCES "SharedFileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReview" ADD CONSTRAINT "TaskReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOpportunity" ADD CONSTRAINT "SalesOpportunity_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOpportunity" ADD CONSTRAINT "SalesOpportunity_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_contractId_clinicId_fkey" FOREIGN KEY ("contractId", "clinicId") REFERENCES "ClinicContract"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_taxCheckedByUserId_fkey" FOREIGN KEY ("taxCheckedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_billingCycleId_clinicId_fkey" FOREIGN KEY ("billingCycleId", "clinicId") REFERENCES "BillingCycle"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedContent" ADD CONSTRAINT "PublishedContent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedContent" ADD CONSTRAINT "PublishedContent_taskId_clinicId_fkey" FOREIGN KEY ("taskId", "clinicId") REFERENCES "Task"("id", "clinicId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedContent" ADD CONSTRAINT "PublishedContent_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedContent" ADD CONSTRAINT "PublishedContent_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedContent" ADD CONSTRAINT "PublishedContent_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicNote" ADD CONSTRAINT "ClinicNote_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicNote" ADD CONSTRAINT "ClinicNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicNote" ADD CONSTRAINT "ClinicNote_taskId_clinicId_fkey" FOREIGN KEY ("taskId", "clinicId") REFERENCES "Task"("id", "clinicId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicNote" ADD CONSTRAINT "ClinicNote_serviceRequestId_clinicId_fkey" FOREIGN KEY ("serviceRequestId", "clinicId") REFERENCES "ServiceRequest"("id", "clinicId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicNote" ADD CONSTRAINT "ClinicNote_calendarEventId_clinicId_fkey" FOREIGN KEY ("calendarEventId", "clinicId") REFERENCES "CalendarEvent"("id", "clinicId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMonthClose" ADD CONSTRAINT "ClinicMonthClose_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMonthClose" ADD CONSTRAINT "ClinicMonthClose_operationsClosedById_fkey" FOREIGN KEY ("operationsClosedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMonthClose" ADD CONSTRAINT "ClinicMonthClose_financeReviewedById_fkey" FOREIGN KEY ("financeReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessageFile" ADD CONSTRAINT "ChatMessageFile_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessageFile" ADD CONSTRAINT "ChatMessageFile_fileVersionId_fkey" FOREIGN KEY ("fileVersionId") REFERENCES "SharedFileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_pushSubscriptionId_fkey" FOREIGN KEY ("pushSubscriptionId") REFERENCES "PushSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- 값 범위
ALTER TABLE "ClinicContract" ADD CONSTRAINT "ClinicContract_ck" CHECK (
  "monthlyFeeKrw" >= 0
  AND ("endsOn" IS NULL OR "endsOn" >= "startsOn")
  AND ("billDayOfMonth" IS NULL OR "billDayOfMonth" BETWEEN 1 AND 31)
  AND ("paymentDueDay" IS NULL OR "paymentDueDay" BETWEEN 1 AND 31)
  AND "paymentDueMonthOffset" BETWEEN 0 AND 2
);
ALTER TABLE "ContractLine" ADD CONSTRAINT "ContractLine_ck" CHECK ("monthlyTarget" >= 0 AND ("defaultDueDay" IS NULL OR "defaultDueDay" BETWEEN 1 AND 31));
ALTER TABLE "MonthlyCommitment" ADD CONSTRAINT "MonthlyCommitment_ck" CHECK ("targetCount" >= 0 AND EXTRACT(DAY FROM "monthStart") = 1);
ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_ck" CHECK ("amountDueKrw" >= 0 AND EXTRACT(DAY FROM "serviceMonth") = 1);
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_ck" CHECK ("amountKrw" > 0);
ALTER TABLE "PublishedContent" ADD CONSTRAINT "PublishedContent_ck" CHECK (EXTRACT(DAY FROM "serviceMonth") = 1);
ALTER TABLE "ClinicMonthClose" ADD CONSTRAINT "ClinicMonthClose_ck" CHECK (EXTRACT(DAY FROM "monthStart") = 1);
-- 치과 채널은 치과 필수, 1:1·그룹은 치과 없음
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_type_ck" CHECK (("type" = 'CLINIC') = ("clinicId" IS NOT NULL));
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_ck" CHECK ("quietStartMinute" BETWEEN 0 AND 1439 AND "quietEndMinute" BETWEEN 0 AND 1439);
