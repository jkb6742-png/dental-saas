-- 홈페이지 상담문의 본문 (암호화 저장, 멱등)
ALTER TABLE "SiteLead" ADD COLUMN IF NOT EXISTS "content" TEXT;
