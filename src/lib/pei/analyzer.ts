import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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
    console.log('[PEI_ANALYZER] HTML 보고서 생성 시작: ' + data.metadata.clinicName)

    const analysisPrompt = createAnalysisPrompt(data, year, month)

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "당신은 치과 PEI 보고서 분석가입니다. 완전한 HTML 보고서를 생성해주세요."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      temperature: 0.7
    })

    const htmlContent = response.choices[0]?.message?.content
    if (!htmlContent) {
      throw new Error('GPT 응답이 비어있습니다')
    }

    if (!htmlContent.includes('<!DOCTYPE html>')) {
      throw new Error('올바른 HTML 형식이 아닙니다')
    }

    console.log('[PEI_ANALYZER] HTML 보고서 생성 완료')
    return htmlContent

  } catch (error: any) {
    console.error('[PEI_ANALYZER] 분석 실패:', error)

    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI API 사용량 한도가 초과되었습니다.')
    } else if (error.code === 'rate_limit_exceeded') {
      throw new Error('OpenAI API 요청 한도를 초과했습니다.')
    } else if (error.code === 'invalid_api_key') {
      throw new Error('OpenAI API 키가 유효하지 않습니다.')
    }

    throw new Error('PEI 데이터 분석 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'))
  }
}

function createAnalysisPrompt(data: PEIAnalysisData, year: number, month: number): string {
  const { summary, records, metadata } = data
  const feedbackData = (data as any).feedbackData || {}
  const feedback14List = feedbackData.feedback14 || []
  const feedback15List = feedbackData.feedback15 || []

  const genderInfo = (summary as any).genderCounts || { male: 0, female: 0, unknown: 0 }

  let prompt = '# THINKLAB PEI 보고서 생성\n\n'
  prompt += '당신은 치과 PEI 보고서를 생성하는 전문가입니다.\n'
  prompt += '다음 정보를 바탕으로 완전한 HTML 보고서를 생성해주세요.\n\n'

  prompt += '## 기본 정보\n'
  prompt += '치과명: ' + metadata.clinicName + '\n'
  prompt += '기간: ' + year + '년 ' + month + '월\n'
  prompt += '응답수: ' + summary.totalRecords + '개\n'
  prompt += '평균점수: ' + (summary.overallAverage || summary.peiScore).toFixed(2) + '/5.0\n'
  prompt += '성별분포: 남성 ' + genderInfo.male + '명, 여성 ' + genderInfo.female + '명\n\n'

  if (feedback14List.length > 0) {
    prompt += '## 긍정 의견 (' + feedback14List.length + '개)\n'
    for (let i = 0; i < Math.min(feedback14List.length, 5); i++) {
      const item = feedback14List[i]
      prompt += (i + 1) + '. [' + (item.doctor || '미지정') + '] ' + item.content + '\n'
    }
    prompt += '\n'
  }

  if (feedback15List.length > 0) {
    prompt += '## 개선 의견 (' + feedback15List.length + '개)\n'
    for (let i = 0; i < Math.min(feedback15List.length, 5); i++) {
      const item = feedback15List[i]
      prompt += (i + 1) + '. [' + (item.doctor || '미지정') + '] ' + item.content + '\n'
    }
    prompt += '\n'
  }

  prompt += '## 요구사항\n'
  prompt += '1. THINKLAB 브랜딩이 포함된 완전한 HTML 문서를 생성하세요\n'
  prompt += '2. 표지, 개요, 의료진별 의견 섹션을 포함하세요\n'
  prompt += '3. 전문적인 CSS 스타일링을 포함하세요\n'
  prompt += '4. 실제 데이터만 사용하고 가짜 데이터는 생성하지 마세요\n'
  prompt += '5. 완성된 HTML 코드 전체를 응답으로 제공하세요\n'

  return prompt
}