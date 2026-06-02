-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('NAVER', 'GOOGLE');

-- CreateTable
CREATE TABLE "ReviewConfig" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "source" "ReviewSource" NOT NULL,
    "placeName" TEXT,
    "placeId" TEXT,
    "placeUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "source" "ReviewSource" NOT NULL,
    "reviewId" TEXT NOT NULL,
    "authorName" TEXT,
    "rating" INTEGER,
    "content" TEXT,
    "reviewDate" TIMESTAMP(3),
    "reply" TEXT,
    "replyDate" TIMESTAMP(3),
    "isPositive" BOOLEAN,
    "keywords" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewSummary" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "source" "ReviewSource" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "newReviews" INTEGER NOT NULL DEFAULT 0,
    "avgRating" DOUBLE PRECISION,
    "positiveCount" INTEGER NOT NULL DEFAULT 0,
    "negativeCount" INTEGER NOT NULL DEFAULT 0,
    "replyRate" DOUBLE PRECISION,
    "topKeywords" JSONB,
    "ratingDist" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewConfig_clinicId_isActive_idx" ON "ReviewConfig"("clinicId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewConfig_clinicId_source_key" ON "ReviewConfig"("clinicId", "source");

-- CreateIndex
CREATE INDEX "Review_clinicId_source_reviewDate_idx" ON "Review"("clinicId", "source", "reviewDate");

-- CreateIndex
CREATE INDEX "Review_clinicId_rating_idx" ON "Review"("clinicId", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "Review_configId_reviewId_key" ON "Review"("configId", "reviewId");

-- CreateIndex
CREATE INDEX "ReviewSummary_clinicId_year_month_idx" ON "ReviewSummary"("clinicId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewSummary_clinicId_source_year_month_key" ON "ReviewSummary"("clinicId", "source", "year", "month");

-- AddForeignKey
ALTER TABLE "ReviewConfig" ADD CONSTRAINT "ReviewConfig_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ReviewConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSummary" ADD CONSTRAINT "ReviewSummary_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
