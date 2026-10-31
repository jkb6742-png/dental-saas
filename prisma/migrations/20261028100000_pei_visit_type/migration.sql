-- PEI 설문 첫 문항: 첫 방문 / 재방문 (멱등)
ALTER TABLE "PeiResponse" ADD COLUMN IF NOT EXISTS "visitType" TEXT;

-- 문항 구성을 이미 저장한 설문은 맨 앞에 방문 문항을 붙인다 (없을 때만)
UPDATE "PeiSurvey"
SET "questions" = jsonb_build_array(jsonb_build_object(
  'id', 'visit', 'type', 'single', 'text', '{치과명}에 처음 방문하셨나요?', 'required', true,
  'options', jsonb_build_array('네, 처음이에요', '아니요, 전에도 왔어요')
)) || "questions"
WHERE jsonb_array_length("questions") > 0
  AND NOT "questions" @> '[{"id":"visit"}]'::jsonb;
