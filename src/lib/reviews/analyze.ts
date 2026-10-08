import Anthropic from "@anthropic-ai/sdk"

// 네이버는 별점을 없앴으므로 긍정/부정은 본문을 읽고 판단한다.
// 답글이 없는 리뷰에는 원장님 명의 답글 초안을 함께 만든다 (등록은 사람이 확인 후 직접).

// 키가 없는 환경(운영 .env 에 ANTHROPIC_API_KEY 미설정)에서도 수집 모듈이 로드되도록 지연 생성한다.
// 모듈 최상위에서 new Anthropic() 을 하면 키가 없을 때 import 단계에서 예외가 나서 크롤·스케줄러가 통째로 죽는다.
let client: Anthropic | null = null
function getClient() {
  if (!client) client = new Anthropic()
  return client
}

export const REVIEW_TOPICS = ["친절", "설명", "통증", "실력", "비용", "대기", "예약", "시설", "청결", "주차", "직원응대", "기타"] as const

export interface ReviewAnalysis {
  sentiment: "positive" | "neutral" | "negative"
  topics: string[]
  issue: string | null   // 부정·중립 리뷰에서 치과가 고칠 점 한 줄
  replyDraft: string | null
}

export interface ReviewToAnalyze {
  id: string
  body: string
  hasReply: boolean
}

const SYSTEM = `당신은 치과 온라인 리뷰를 관리하는 실장입니다. 네이버 플레이스 방문자 리뷰를 읽고 분류하고, 답글이 필요한 리뷰에는 치과 명의 답글 초안을 씁니다.

분류 기준
- sentiment: 불만·아쉬움이 한 문장이라도 분명히 있으면 negative, 칭찬과 아쉬움이 비슷하면 neutral, 그 외 positive.
- topics: 리뷰가 실제로 언급한 주제만 고릅니다. 목록: ${REVIEW_TOPICS.join(", ")}.
- issue: negative/neutral 일 때만, 치과가 고칠 점을 한 문장으로. positive 면 null.

답글 초안 (needsReply 가 true 인 리뷰만, 아니면 null)
- 리뷰에 나온 구체적인 내용(진료 종류, 언급한 직원·상황)을 하나 짚어 감사나 사과를 합니다. 어느 리뷰에나 붙일 수 있는 상투 문구는 피합니다.
- 불만 리뷰는 변명 없이 사과하고, 무엇을 점검하겠다고 짧게 약속합니다. 직원 개인을 탓하지 않습니다.
- 의료법상 치료 효과 보장, 다른 치과 비교, 할인·이벤트 안내, 환자의 진료 내용 추가 노출은 쓰지 않습니다.
- 2~4문장, 존댓말, 이모지 없이.`

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
          topics: { type: "array", items: { type: "string", enum: [...REVIEW_TOPICS] } },
          issue: { type: ["string", "null"] },
          replyDraft: { type: ["string", "null"] },
        },
        required: ["id", "sentiment", "topics", "issue", "replyDraft"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
}

export async function analyzeReviews(clinicName: string, reviews: ReviewToAnalyze[]): Promise<Map<string, ReviewAnalysis>> {
  const out = new Map<string, ReviewAnalysis>()
  if (reviews.length === 0 || !process.env.ANTHROPIC_API_KEY) return out

  const payload = reviews.map((r) => ({ id: r.id, needsReply: !r.hasReply, body: r.body }))
  const response = await getClient().beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    // SDK 0.100 타입에는 아직 없는 필드라 그대로 실어 보낸다
    ...({ fallbacks: "default", output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } } } as any),
    system: SYSTEM,
    messages: [{ role: "user", content: `치과: ${clinicName}\n\n리뷰 목록(JSON):\n${JSON.stringify(payload)}` }],
  })

  if (response.stop_reason === "refusal") {
    console.warn("[reviews] 분석 거절됨:", (response as any).stop_details?.category)
    return out
  }
  const text = response.content.find((b) => b.type === "text")
  if (!text || text.type !== "text") return out

  const parsed = JSON.parse(text.text) as { results: Array<ReviewAnalysis & { id: string }> }
  for (const r of parsed.results) {
    out.set(r.id, { sentiment: r.sentiment, topics: r.topics, issue: r.issue, replyDraft: r.replyDraft })
  }
  return out
}
