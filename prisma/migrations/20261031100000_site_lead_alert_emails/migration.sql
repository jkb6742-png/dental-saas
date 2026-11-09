-- 홈페이지 문의 새 글 메일 알림 수신 주소 (멱등)
ALTER TABLE "SiteLeadSource" ADD COLUMN IF NOT EXISTS "alertEmails" TEXT;
