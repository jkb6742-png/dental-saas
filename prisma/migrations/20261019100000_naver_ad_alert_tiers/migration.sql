-- 비즈머니 2단계 알림 (멱등)
ALTER TABLE "NaverAdAccount" ADD COLUMN IF NOT EXISTS "alertThreshold2" INTEGER;
ALTER TABLE "NaverAdAccount" ADD COLUMN IF NOT EXISTS "lastAlertLevel" INTEGER NOT NULL DEFAULT 0;
