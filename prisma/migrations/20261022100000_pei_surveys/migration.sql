-- PEI 자체 설문 (구글폼 대체) (멱등)
CREATE TABLE IF NOT EXISTS "PeiSurvey" (
  "id" TEXT PRIMARY KEY,
  "clinicId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "intro" TEXT,
  "doctors" JSONB NOT NULL,
  "facilityQuestion" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PeiSurvey_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PeiSurvey_clinicId_key" ON "PeiSurvey"("clinicId");
CREATE UNIQUE INDEX IF NOT EXISTS "PeiSurvey_token_key" ON "PeiSurvey"("token");

CREATE TABLE IF NOT EXISTS "PeiResponse" (
  "id" TEXT PRIMARY KEY,
  "surveyId" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gender" TEXT,
  "ageGroup" TEXT,
  "doctor" TEXT,
  "qPhone" INTEGER,
  "qDesk" INTEGER,
  "qConsult" INTEGER,
  "qDoctorTalk" INTEGER,
  "qHygienist" INTEGER,
  "qDoctorCare" INTEGER,
  "qFacility" INTEGER,
  "qHomepage" INTEGER,
  "qWaiting" INTEGER,
  "recommend" INTEGER,
  "positive" TEXT,
  "improvement" TEXT,
  "ipHash" TEXT,
  CONSTRAINT "PeiResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "PeiSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PeiResponse_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PeiResponse_clinicId_year_month_idx" ON "PeiResponse"("clinicId", "year", "month");
CREATE INDEX IF NOT EXISTS "PeiResponse_surveyId_submittedAt_idx" ON "PeiResponse"("surveyId", "submittedAt");

-- 받은 진료(중복 선택) 문항
ALTER TABLE "PeiSurvey" ADD COLUMN IF NOT EXISTS "treatments" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "PeiResponse" ADD COLUMN IF NOT EXISTS "treatments" JSONB;
ALTER TABLE "PeiSurvey" ADD COLUMN IF NOT EXISTS "slogan" TEXT;
ALTER TABLE "PeiSurvey" ADD COLUMN IF NOT EXISTS "logo" TEXT;
ALTER TABLE "PeiSurvey" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "PeiSurvey_slug_key" ON "PeiSurvey"("slug");
ALTER TABLE "PeiSurvey" ADD COLUMN IF NOT EXISTS "questions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "PeiResponse" ADD COLUMN IF NOT EXISTS "answers" JSONB;
