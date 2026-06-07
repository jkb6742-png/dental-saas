import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

interface PEIAnalysisData {
  summary: {
    totalRecords: number
    peiScore: number
    avgSatisfaction: number
    avgServiceScore: number
    avgFacilityScore: number
    avgRevisitIntention: number
  }
  records: Array<{
    id: number
    date: string | null
    patientName: string | null
    satisfaction: number
    waitTime: number
    serviceScore: number
    facilityScore: number
    revisitIntention: number
  }>
  metadata: {
    clinicName: string
    dataRange: string
    lastSyncAt: string
    totalRows: number
    validRecords: number
  }
}

export async function analyzePEIData(
  data: PEIAnalysisData,
  year: number,
  month: number
): Promise<string> {
  try {
    console.log('[PEI_ANALYZER] THINKLAB 보고서 생성 시작: ' + data.metadata.clinicName)

    const analysisPrompt = createThinklabPrompt(data, year, month)

    // 🔥 THINKLAB PEI 프롬프트 적용 (Claude API)
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 8000,
      temperature: 0.3, // 일관성을 위해 낮은 temperature
      messages: [
        {
          role: "user",
          content: analysisPrompt
        }
      ]
    })

    const htmlContent = response.content[0].type === 'text' ? response.content[0].text : null

    if (!htmlContent) {
      throw new Error('Claude 응답이 비어있습니다')
    }

    if (!htmlContent.includes('<!DOCTYPE html>')) {
      throw new Error('올바른 HTML 형식이 아닙니다')
    }

    console.log('[PEI_ANALYZER] THINKLAB 보고서 생성 완료')
    return htmlContent

  } catch (error: any) {
    console.error('[PEI_ANALYZER] 분석 실패:', error)

    if (error.type === 'authentication_error') {
      throw new Error('Anthropic API 키가 유효하지 않습니다.')
    } else if (error.type === 'rate_limit_error') {
      throw new Error('Claude API 요청 한도를 초과했습니다.')
    }

    throw new Error('PEI 데이터 분석 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'))
  }
}

function createThinklabPrompt(data: PEIAnalysisData, year: number, month: number): string {
  const { summary, records, metadata } = data
  const feedbackData = (data as any).feedbackData || {}
  const feedback14List = feedbackData.feedback14 || []
  const feedback15List = feedbackData.feedback15 || []
  const genderInfo = (summary as any).genderCounts || { male: 0, female: 0, unknown: 0 }

  return `# THINKLAB PEI 보고서 생성 프롬프트

## 역할 / 목적
너는 Thinklab(thinklabmedi@gmail.com)의 치과 PEI(Patient Experience Index) 월간 보고서를 만드는 분석가다.
제공된 치과 설문 응답 데이터를 읽어, 지정한 달의 환자 경험 지표를 집계하고, 자체 완결형 HTML 보고서 1개 파일로 만든다.
디자인·구조·계산 규칙은 아래를 그대로 따른다. 임의로 바꾸지 않는다.

## 집계 규칙 (반드시 동일하게)
- 텍스트 평점 → 5점 환산: 매우 그렇다=5, 그렇다=4, 보통이다=3, 그렇지 않다=2, 전혀 그렇지 않다=1
- 제외 처리(N/A): 빈칸, 0, 경험 없음/X/해당없음 류는 평균에서 제외
- 지인 권유(추천) 환산: 해당 열의 최댓값이 5 초과(0~10 척도)면 ÷2로 5점 환산. 이미 1~5면 그대로
- 항목 평균 = 그 항목 유효 응답의 평균(소수 둘째 자리)
- 종합 평균(전반적 만족도) = 위 (환산 완료된) 항목 평균들의 단순 평균
- 상태 배지: ≥ 4.85 → 매우 양호, 4.50 ~ 4.84 → 양호, < 4.50 → 개선 필요

## 치과 정보
**대상 기간**: ${year}년 ${month}월
**치과명**: ${metadata.clinicName}
**응답 수**: ${summary.totalRecords}명
**성별 분포**: 남성 ${genderInfo.male}명, 여성 ${genderInfo.female}명

## 평가 점수 데이터
- PEI 종합 점수: ${summary.peiScore.toFixed(2)}/5.0
- 전반적 만족도: ${summary.avgSatisfaction.toFixed(2)}/5.0
- 서비스 점수: ${summary.avgServiceScore.toFixed(2)}/5.0
- 시설 점수: ${summary.avgFacilityScore.toFixed(2)}/5.0
- 재방문 의향: ${summary.avgRevisitIntention.toFixed(2)}/5.0

## 개별 응답 데이터
${records.map((record, index) =>
  `응답 ${index + 1}: 만족도=${record.satisfaction}, 서비스=${record.serviceScore}, 시설=${record.facilityScore}, 재방문=${record.revisitIntention}`
).join('\n')}

## 주관식 피드백
${feedback14List.length > 0 ? `### 좋았던 점:\n${feedback14List.map(f => `- ${f}`).join('\n')}` : '### 좋았던 점: 없음'}

${feedback15List.length > 0 ? `### 개선이 필요한 점:\n${feedback15List.map(f => `- ${f}`).join('\n')}` : '### 개선이 필요한 점: 없음'}

## HTML 템플릿 (정확히 이 양식 사용)
반드시 아래 EXACT 템플릿을 사용하고, CSS·구조·클래스는 변경 금지:

<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>26년 ${month}월 PEI 보고서 - ${metadata.clinicName}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<style>
  :root{
    --ink:#16181d;--muted:#5b616e;--line:#e4e6eb;--line-soft:#eef0f4;
    --blue:#2433e0;--blue-soft:#eef0ff;--bg:#f6f7f9;
    --good:#1d9e6f;--good-bg:#e7f6ef;--ok:#2e6fd6;--ok-bg:#e8f0fd;--warn:#d9822b;--warn-bg:#fcf1e3;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif;color:var(--ink);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased;font-feature-settings:"tnum";}
  .page{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:26mm 20mm;box-shadow:0 1px 24px rgba(20,24,40,.08);position:relative;}
  .logo{font-weight:800;font-size:34px;letter-spacing:1px;display:inline-block;}
  .cover{display:flex;flex-direction:column;justify-content:center;text-align:center;}
  .cover .logo{font-size:52px;margin-bottom:64px;}
  .cover h1{font-size:30px;font-weight:800;line-height:1.4;}
  .cover h1 .en{display:block;font-size:24px;margin-top:4px;}
  .cover .meta{margin-top:150px;display:flex;flex-direction:column;gap:14px;font-weight:600;}
  .cover .meta .client{font-size:20px;} .cover .meta .date{font-size:18px;} .cover .meta .who{font-size:15px;color:var(--muted);}
  h2.sec{font-size:21px;font-weight:800;margin:0 0 18px;padding-bottom:10px;border-bottom:2.5px solid var(--ink);display:flex;align-items:center;gap:8px;}
  h2.sec .n{color:var(--blue);}
  h3{font-size:15.5px;font-weight:700;margin:26px 0 10px;color:var(--ink);}
  h3 .tag{color:var(--blue);font-weight:800;margin-right:6px;}
  table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:6px;}
  th,td{border:1px solid var(--line);padding:8px 10px;text-align:center;vertical-align:middle;}
  th{background:#f3f4f7;font-weight:700;color:#3a3f4a;}
  td.l,th.l{text-align:left;}
  tbody tr:nth-child(even) td{background:#fafbfc;}
  .num{font-variant-numeric:tabular-nums;font-weight:700;}
  .badge{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;}
  .b-good{color:var(--good);background:var(--good-bg);} .b-ok{color:var(--ok);background:var(--ok-bg);} .b-warn{color:var(--warn);background:var(--warn-bg);}
  .delta-up{color:var(--good);font-weight:700;} .delta-down{color:#d23f3f;font-weight:700;} .delta-flat{color:var(--muted);font-weight:700;}
  .ov{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px;}
  .ov .card{border:1px solid var(--line);border-radius:12px;padding:14px 16px;}
  .ov .card.hl{border-color:var(--blue);background:var(--blue-soft);}
  .ov .card .k{font-size:11px;color:var(--muted);font-weight:600;}
  .ov .card .v{font-size:26px;font-weight:800;margin-top:2px;} .ov .card .v.sm{font-size:17px;}
  .ov .card .s{font-size:11.5px;color:var(--muted);margin-top:4px;}
  .summary th:first-child{width:120px;} .summary td.l{font-size:12px;line-height:1.55;}
  ul.op{list-style:none;margin:4px 0 14px;padding:0;}
  ul.op li{position:relative;padding:7px 12px 7px 28px;font-size:12.5px;line-height:1.55;border-left:3px solid var(--line);margin-bottom:6px;background:#fafbfc;border-radius:0 6px 6px 0;}
  ul.op li::before{content:"";position:absolute;left:11px;top:14px;width:6px;height:6px;border-radius:50%;background:var(--muted);}
  ul.op.pos li{border-left-color:var(--good);} ul.op.pos li::before{background:var(--good);}
  ul.op.neg li{border-left-color:#d9822b;} ul.op.neg li::before{background:#d9822b;}
  .none{font-size:12.5px;color:var(--muted);font-style:italic;padding:6px 0;}
  .pos-h,.neg-h{font-size:13px;font-weight:700;margin:14px 0 6px;display:flex;align-items:center;gap:6px;}
  .pos-h{color:var(--good);} .neg-h{color:#d9822b;}
  .doc-block{border:1px solid var(--line-soft);border-radius:12px;padding:16px 18px;margin-bottom:16px;}
  .doc-block h3{margin-top:0;} .role{font-size:11.5px;color:var(--muted);font-weight:500;}
  .summary-box{background:#fafbfc;border:1px solid var(--line);border-left:4px solid var(--blue);border-radius:0 10px 10px 0;padding:14px 18px;font-size:12.5px;line-height:1.7;margin:14px 0 4px;}
  .summary-box p{margin-bottom:8px;} .summary-box p:last-child{margin-bottom:0;}
  .link{font-size:11px;color:var(--muted);margin-top:14px;word-break:break-all;} .link a{color:var(--blue);text-decoration:none;}
  .named{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 12px;}
  .named .chip{font-size:11.5px;background:var(--blue-soft);color:var(--blue);padding:3px 10px;border-radius:6px;font-weight:600;}
  .note{font-size:11px;color:var(--muted);margin-top:2px;font-style:italic;}
  @media print{body{background:#fff;}.page{margin:0;box-shadow:none;width:auto;min-height:auto;padding:18mm 16mm;page-break-after:always;}.page:last-child{page-break-after:auto;}a{color:var(--ink);}}
  @media (max-width:800px){.page{width:auto;padding:24px 18px;}.ov{grid-template-columns:1fr;}}
</style>
</head>
<body>
<!-- 여기에 THINKLAB 보고서 구조에 맞는 완전한 HTML 생성 -->
</body>
</html>

## 작업 요청
위의 데이터를 바탕으로 ${year}년 ${month}월 ${metadata.clinicName} THINKLAB PEI 보고서를 생성하세요.

**반드시 지켜야 할 규칙**:
1. 위에 제공된 HTML 템플릿과 CSS를 EXACT하게 사용
2. 스타일과 클래스명 절대 변경 금지
3. 배지 클래스: b-good(≥4.85), b-ok(4.50-4.84), b-warn(<4.50)
4. 로고는 "THINKLAB" 텍스트만 사용
5. 완전한 HTML 문서로 생성 (<!DOCTYPE html>부터 </html>까지)
6. 표지 → 개요 → 전월비교 → 의료진별 의견 순서로 구성
7. 주관식 의견을 의료진별로 분류하여 정리

**보고일**: ${new Date(year, month, 1).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}

지금 바로 위 템플릿에 따라 완전한 HTML PEI 보고서를 생성해주세요.`
}