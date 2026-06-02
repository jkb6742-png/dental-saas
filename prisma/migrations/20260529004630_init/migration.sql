-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "TreatmentStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'PENDING', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('COMPLETED', 'INCOMPLETE', 'NA');

-- CreateEnum
CREATE TYPE "TreatmentCategory" AS ENUM ('INSURANCE', 'NON_INSURANCE');

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "PlanTier" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLedger" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "cashIncome" DOUBLE PRECISION,
    "cardIncome" DOUBLE PRECISION,
    "onlineIncome" DOUBLE PRECISION,
    "receiptIssued" DOUBLE PRECISION,
    "insuranceClaim" DOUBLE PRECISION,
    "cashExpense" DOUBLE PRECISION,
    "cardExpense" DOUBLE PRECISION,
    "onlineExpense" DOUBLE PRECISION,
    "cardFee" DOUBLE PRECISION,
    "totalIncome" DOUBLE PRECISION,
    "totalExpense" DOUBLE PRECISION,
    "netTotal" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySummary" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalRevenue" DOUBLE PRECISION,
    "totalExpense" DOUBLE PRECISION,
    "netProfit" DOUBLE PRECISION,
    "cashIncome" DOUBLE PRECISION,
    "cardIncome" DOUBLE PRECISION,
    "insuranceClaim" DOUBLE PRECISION,
    "nonInsuranceRevenue" DOUBLE PRECISION,
    "newPatients" INTEGER,
    "totalPatients" INTEGER,
    "workingDays" INTEGER,
    "avgDailyRevenue" DOUBLE PRECISION,
    "newPatientRevenue" DOUBLE PRECISION,
    "revisitRate" DOUBLE PRECISION,
    "nonInsuranceRatio" DOUBLE PRECISION,
    "revenueGrowth" DOUBLE PRECISION,
    "newPatientGrowth" DOUBLE PRECISION,
    "totalArrears" DOUBLE PRECISION,
    "arrearsRate" DOUBLE PRECISION,
    "treatmentCompleteRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientStat" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "workingDays" DOUBLE PRECISION,
    "newPatients" DOUBLE PRECISION,
    "totalVisits" DOUBLE PRECISION,
    "totalAppointments" DOUBLE PRECISION,
    "avgDailyNewPatients" DOUBLE PRECISION,
    "avgDailyAppointments" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentStat" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" "TreatmentCategory" NOT NULL,
    "patientCount" DOUBLE PRECISION,
    "visitCount" DOUBLE PRECISION,
    "revenue" DOUBLE PRECISION,
    "visitRatio" DOUBLE PRECISION,
    "revenueRatio" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitRoute" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "routeName" TEXT NOT NULL,
    "totalVisitors" DOUBLE PRECISION,
    "returningPatients" DOUBLE PRECISION,
    "newPatients" DOUBLE PRECISION,
    "totalVisits" DOUBLE PRECISION,
    "avgRevenue" DOUBLE PRECISION,
    "totalRevenue" DOUBLE PRECISION,
    "acquisitionCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPlan" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "chartNumber" TEXT,
    "writtenDate" TIMESTAMP(3),
    "lastVisit" TIMESTAMP(3),
    "nextAppointment" TIMESTAMP(3),
    "status" "TreatmentStatus",
    "paymentStatus" "PaymentStatus",
    "doctor" TEXT,
    "counselor" TEXT,
    "planContent" TEXT,
    "contractAmount" DOUBLE PRECISION,
    "remainingAmount" DOUBLE PRECISION,
    "month" INTEGER,
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "monthlySummaryId" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "content" TEXT,
    "pdfUrl" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_agencyId_code_key" ON "Clinic"("agencyId", "code");

-- CreateIndex
CREATE INDEX "DailyLedger_clinicId_year_month_idx" ON "DailyLedger"("clinicId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLedger_clinicId_date_key" ON "DailyLedger"("clinicId", "date");

-- CreateIndex
CREATE INDEX "MonthlySummary_clinicId_year_idx" ON "MonthlySummary"("clinicId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySummary_clinicId_year_month_key" ON "MonthlySummary"("clinicId", "year", "month");

-- CreateIndex
CREATE INDEX "PatientStat_clinicId_year_month_idx" ON "PatientStat"("clinicId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PatientStat_clinicId_date_key" ON "PatientStat"("clinicId", "date");

-- CreateIndex
CREATE INDEX "TreatmentStat_clinicId_year_month_idx" ON "TreatmentStat"("clinicId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentStat_clinicId_year_month_itemName_key" ON "TreatmentStat"("clinicId", "year", "month", "itemName");

-- CreateIndex
CREATE INDEX "VisitRoute_clinicId_year_month_idx" ON "VisitRoute"("clinicId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "VisitRoute_clinicId_year_month_routeName_key" ON "VisitRoute"("clinicId", "year", "month", "routeName");

-- CreateIndex
CREATE INDEX "TreatmentPlan_clinicId_year_month_idx" ON "TreatmentPlan"("clinicId", "year", "month");

-- CreateIndex
CREATE INDEX "TreatmentPlan_clinicId_paymentStatus_idx" ON "TreatmentPlan"("clinicId", "paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Report_monthlySummaryId_key" ON "Report"("monthlySummaryId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_clinicId_year_month_key" ON "Report"("clinicId", "year", "month");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clinic" ADD CONSTRAINT "Clinic_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLedger" ADD CONSTRAINT "DailyLedger_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySummary" ADD CONSTRAINT "MonthlySummary_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientStat" ADD CONSTRAINT "PatientStat_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentStat" ADD CONSTRAINT "TreatmentStat_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRoute" ADD CONSTRAINT "VisitRoute_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_monthlySummaryId_fkey" FOREIGN KEY ("monthlySummaryId") REFERENCES "MonthlySummary"("id") ON DELETE SET NULL ON UPDATE CASCADE;
