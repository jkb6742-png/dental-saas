-- CreateTable
CREATE TABLE "ImplantStat" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "fixtureName" TEXT NOT NULL,
    "surgeryCount" DOUBLE PRECISION,
    "usageCount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImplantStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationStat" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "counselorName" TEXT NOT NULL,
    "planCount" DOUBLE PRECISION,
    "confirmedCount" DOUBLE PRECISION,
    "confirmationRate" DOUBLE PRECISION,
    "patientCount" DOUBLE PRECISION,
    "confirmedPatients" DOUBLE PRECISION,
    "patientConfirmRate" DOUBLE PRECISION,
    "confirmedAmount" DOUBLE PRECISION,
    "avgDiscountRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceptionRecord" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "receptionTime" TIMESTAMP(3),
    "status" TEXT,
    "chartNumber" TEXT,
    "patientName" TEXT,
    "ageGender" TEXT,
    "insuranceType" TEXT,
    "patientType" TEXT,
    "doctor" TEXT,
    "totalRevenue" DOUBLE PRECISION,
    "insuranceCoverage" DOUBLE PRECISION,
    "patientPayment" DOUBLE PRECISION,
    "nonInsurance" DOUBLE PRECISION,
    "cardPayment" DOUBLE PRECISION,
    "cashPayment" DOUBLE PRECISION,
    "onlinePayment" DOUBLE PRECISION,
    "dailyArrears" DOUBLE PRECISION,
    "totalArrears" DOUBLE PRECISION,
    "visitRoute" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceptionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgeDist" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "totalPatients" DOUBLE PRECISION,
    "returningPatients" DOUBLE PRECISION,
    "newPatients" DOUBLE PRECISION,
    "avgRevenue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgeDist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegionDist" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "region" TEXT NOT NULL,
    "totalPatients" DOUBLE PRECISION,
    "returningPatients" DOUBLE PRECISION,
    "newPatients" DOUBLE PRECISION,
    "totalVisits" DOUBLE PRECISION,
    "avgRevenue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegionDist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImplantStat_clinicId_year_month_idx" ON "ImplantStat"("clinicId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ImplantStat_clinicId_year_month_fixtureName_key" ON "ImplantStat"("clinicId", "year", "month", "fixtureName");

-- CreateIndex
CREATE INDEX "ConsultationStat_clinicId_year_month_idx" ON "ConsultationStat"("clinicId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationStat_clinicId_year_month_counselorName_key" ON "ConsultationStat"("clinicId", "year", "month", "counselorName");

-- CreateIndex
CREATE INDEX "ReceptionRecord_clinicId_year_month_idx" ON "ReceptionRecord"("clinicId", "year", "month");

-- CreateIndex
CREATE INDEX "ReceptionRecord_clinicId_patientType_idx" ON "ReceptionRecord"("clinicId", "patientType");

-- CreateIndex
CREATE INDEX "ReceptionRecord_clinicId_doctor_idx" ON "ReceptionRecord"("clinicId", "doctor");

-- CreateIndex
CREATE INDEX "AgeDist_clinicId_year_month_idx" ON "AgeDist"("clinicId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "AgeDist_clinicId_year_month_ageGroup_key" ON "AgeDist"("clinicId", "year", "month", "ageGroup");

-- CreateIndex
CREATE INDEX "RegionDist_clinicId_year_month_idx" ON "RegionDist"("clinicId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "RegionDist_clinicId_year_month_region_key" ON "RegionDist"("clinicId", "year", "month", "region");

-- AddForeignKey
ALTER TABLE "ImplantStat" ADD CONSTRAINT "ImplantStat_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationStat" ADD CONSTRAINT "ConsultationStat_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionRecord" ADD CONSTRAINT "ReceptionRecord_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgeDist" ADD CONSTRAINT "AgeDist_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegionDist" ADD CONSTRAINT "RegionDist_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
