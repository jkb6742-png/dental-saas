import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    const { clinicId, year, month, reportType = 'standard' } = await req.json()

    if (!clinicId || !year || !month) {
      return NextResponse.json({
        error: "clinicId, year, month가 필요합니다"
      }, { status: 400 })
    }

    console.log(`[PEI_GENERATE] ${clinicId} ${year}년 ${month}월 보고서 생성 시작`)

    // 기존 분석 결과 조회
    const existingReport = await prisma.peiReport.findUnique({
      where: {
        clinicId_year_month: { clinicId, year, month }
      },
      include: {
        clinic: { select: { name: true } },
        sheetConfig: { select: { sheetUrl: true } }
      }
    })

    if (!existingReport || existingReport.status !== 'COMPLETED') {
      return NextResponse.json({
        error: "해당 기간의 분석 결과가 없습니다. 먼저 분석을 실행해주세요",
        needsAnalysis: true
      }, { status: 404 })
    }

    console.log(`[PEI_GENERATE] 기존 분석 결과 확인: ${existingReport.id}`)

    // 기존 content가 HTML인 경우와 JSON인 경우를 모두 처리
    let analysis = null
    if (existingReport.content) {
      try {
        // 기존 JSON 형태 시도
        analysis = JSON.parse(existingReport.content)
      } catch (e) {
        // HTML 형태인 경우 rawData에서 기본 정보 구성
        console.log(`[PEI_GENERATE] HTML 컨텐츠 감지, rawData 사용`)
        analysis = {
          overview: {
            totalResponses: existingReport.rawData?.summary?.totalRecords || 0,
            averageScore: existingReport.peiScore || 0,
            genderRatio: existingReport.rawData?.summary?.genderCounts || { male: 0, female: 0 },
            ageGroup: "30~50대 중심"
          },
          sectionalSummary: {
            overallEvaluation: `${existingReport.clinic.name}의 ${year}년 ${month}월 PEI 보고서`
          },
          htmlReport: existingReport.content // 기존 HTML 보고서 포함
        }
      }
    }

    if (!analysis) {
      return NextResponse.json({
        error: "분석 데이터가 손상되었습니다. 다시 분석을 실행해주세요"
      }, { status: 500 })
    }

    // 보고서 텍스트 생성
    console.log(`[PEI_GENERATE] 보고서 텍스트 생성 중...`)
    const reportContent = await generateReportContent({
      clinicName: existingReport.clinic.name,
      year,
      month,
      peiScore: existingReport.peiScore,
      categoryScores: existingReport.categoryScores,
      analysis,
      rawData: existingReport.rawData,
      reportType
    })

    console.log(`[PEI_GENERATE] 보고서 텍스트 생성 완료`)

    // HTML 보고서 생성
    const htmlReport = generateHTMLReport({
      clinicName: existingReport.clinic.name,
      year,
      month,
      reportContent,
      analysis,
      peiScore: existingReport.peiScore,
      categoryScores: existingReport.categoryScores
    })

    // 데이터베이스에 생성된 보고서 내용 업데이트
    const updatedReport = await prisma.peiReport.update({
      where: { id: existingReport.id },
      data: {
        content: JSON.stringify({
          ...analysis,
          fullReport: reportContent,
          htmlReport
        }),
        updatedAt: new Date()
      }
    })

    console.log(`[PEI_GENERATE] 보고서 생성 완료: ${updatedReport.id}`)

    return NextResponse.json({
      success: true,
      message: "PEI 보고서가 성공적으로 생성되었습니다",
      report: {
        id: updatedReport.id,
        content: reportContent,
        htmlReport,
        metadata: {
          clinicName: existingReport.clinic.name,
          period: `${year}년 ${month}월`,
          generatedAt: new Date().toISOString(),
          peiScore: existingReport.peiScore,
          reportType
        }
      }
    })

  } catch (error: any) {
    console.error('[PEI_GENERATE] 보고서 생성 실패:', error)

    let errorMessage = "보고서 생성 중 오류가 발생했습니다"
    let statusCode = 500

    if (error.message?.includes('OPENAI_API_KEY')) {
      errorMessage = "OpenAI API 키가 설정되지 않았습니다"
    } else if (error.message?.includes('insufficient_quota')) {
      errorMessage = "API 사용량 한도가 초과되었습니다"
      statusCode = 429
    } else if (error.message?.includes('rate_limit')) {
      errorMessage = "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요"
      statusCode = 429
    }

    return NextResponse.json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: statusCode })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const reportId = searchParams.get('reportId')

    if (!reportId) {
      return NextResponse.json({
        error: "reportId 파라미터가 필요합니다"
      }, { status: 400 })
    }

    // 보고서 조회
    const report = await prisma.peiReport.findUnique({
      where: { id: reportId },
      include: {
        clinic: { select: { name: true } }
      }
    })

    if (!report) {
      return NextResponse.json({
        error: "보고서를 찾을 수 없습니다"
      }, { status: 404 })
    }

    const content = report.content ? JSON.parse(report.content) : null

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        title: report.title,
        clinicName: report.clinic.name,
        year: report.year,
        month: report.month,
        peiScore: report.peiScore,
        categoryScores: report.categoryScores,
        content: content?.fullReport || report.summary,
        htmlReport: content?.htmlReport,
        generatedAt: report.generatedAt
      }
    })

  } catch (error) {
    console.error('[PEI_GENERATE] 보고서 조회 실패:', error)
    return NextResponse.json({
      error: "보고서 조회 중 오류가 발생했습니다"
    }, { status: 500 })
  }
}

/**
 * GPT를 사용한 상세 보고서 텍스트 생성
 */
async function generateReportContent(params: {
  clinicName: string
  year: number
  month: number
  peiScore: number
  categoryScores: any
  analysis: any
  rawData: any
  reportType: string
}) {
  const { clinicName, year, month, peiScore, categoryScores, analysis, rawData, reportType } = params

  const prompt = `
다음 PEI 분석 결과를 바탕으로 전문적인 월간 보고서를 작성해주세요.

## 기본 정보
- 치과명: ${clinicName}
- 분석 기간: ${year}년 ${month}월
- 전체 PEI 점수: ${peiScore}/5.0
- 만족도: ${categoryScores?.satisfaction || 0}/5.0
- 서비스 점수: ${categoryScores?.service || 0}/5.0
- 시설 점수: ${categoryScores?.facility || 0}/5.0
- 재방문 의향: ${categoryScores?.revisit || 0}/5.0

## 분석 결과
${JSON.stringify(analysis, null, 2)}

## 원본 데이터 요약
- 총 응답수: ${rawData?.metadata?.totalRows || 0}개
- 유효 응답수: ${rawData?.metadata?.validRecords || 0}개

다음 구조로 전문적인 보고서를 작성해주세요:

1. **경영진 요약** (Executive Summary)
   - 핵심 성과 지표 요약
   - 주요 발견사항
   - 우선 조치 사항

2. **PEI 성과 분석**
   - 전체 점수 분석
   - 영역별 상세 분석
   - 전월/전년 대비 비교 (가능한 경우)

3. **고객 경험 인사이트**
   - 강점 분석
   - 개선 필요 영역
   - 고객 피드백 패턴

4. **개선 권고사항**
   - 즉시 실행 항목
   - 단기 개선 계획
   - 장기 전략 방향

5. **액션 플랜**
   - 구체적 실행 계획
   - 담당자 및 일정
   - 성과 측정 방법

보고서는 치과 경영진이 읽기 쉽고 실행 가능한 내용으로 작성해주세요.
각 섹션은 명확한 제목과 함께 구조화하고, 데이터 기반의 구체적인 내용을 포함해주세요.
`

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "당신은 치과 경영 컨설턴트로서 PEI 보고서를 작성하는 전문가입니다. 실용적이고 구체적인 보고서를 작성해주세요."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 3000
  })

  return response.choices[0]?.message?.content || "보고서 생성에 실패했습니다."
}

/**
 * HTML 보고서 템플릿 생성
 */
function generateHTMLReport(params: {
  clinicName: string
  year: number
  month: number
  reportContent: string
  analysis: any
  peiScore: number
  categoryScores: any
}) {
  const { clinicName, year, month, reportContent, analysis, peiScore, categoryScores } = params

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${clinicName} ${year}년 ${month}월 PEI 분석 보고서</title>
    <style>
        body {
            font-family: 'Malgun Gothic', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #3182f6;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #3182f6;
            margin: 0;
            font-size: 28px;
        }
        .header .subtitle {
            color: #666;
            font-size: 16px;
            margin-top: 5px;
        }
        .score-overview {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 30px;
        }
        .score-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .score-item {
            text-align: center;
        }
        .score-value {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .score-label {
            font-size: 14px;
            opacity: 0.9;
        }
        .content-section {
            margin-bottom: 30px;
        }
        .content-section h2 {
            color: #3182f6;
            border-left: 4px solid #3182f6;
            padding-left: 15px;
            margin-bottom: 15px;
        }
        .recommendations {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .recommendation-item {
            margin-bottom: 15px;
            padding: 15px;
            background: white;
            border-radius: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .priority-high { border-left: 4px solid #f04452; }
        .priority-medium { border-left: 4px solid #ff9500; }
        .priority-low { border-left: 4px solid #05c072; }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 14px;
        }
        .report-content {
            white-space: pre-wrap;
            line-height: 1.8;
        }
        @media print {
            body { margin: 0; padding: 20px; }
            .score-overview { background: #f0f0f0 !important; color: #333 !important; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${clinicName}</h1>
        <div class="subtitle">${year}년 ${month}월 환자경험평가(PEI) 분석 보고서</div>
    </div>

    <div class="score-overview">
        <h2 style="margin: 0 0 10px 0; text-align: center;">종합 성과 지표</h2>
        <div class="score-grid">
            <div class="score-item">
                <div class="score-value">${peiScore?.toFixed(1) || 0}</div>
                <div class="score-label">전체 PEI 점수</div>
            </div>
            <div class="score-item">
                <div class="score-value">${categoryScores?.satisfaction?.toFixed(1) || 0}</div>
                <div class="score-label">만족도</div>
            </div>
            <div class="score-item">
                <div class="score-value">${categoryScores?.service?.toFixed(1) || 0}</div>
                <div class="score-label">서비스</div>
            </div>
            <div class="score-item">
                <div class="score-value">${categoryScores?.facility?.toFixed(1) || 0}</div>
                <div class="score-label">시설</div>
            </div>
            <div class="score-item">
                <div class="score-value">${categoryScores?.revisit?.toFixed(1) || 0}</div>
                <div class="score-label">재방문 의향</div>
            </div>
        </div>
    </div>

    <div class="content-section">
        <div class="report-content">${reportContent}</div>
    </div>

    ${analysis?.recommendations ? `
    <div class="recommendations">
        <h2>핵심 권고사항</h2>
        ${analysis.recommendations.immediate?.map(rec => `
            <div class="recommendation-item priority-high">
                <strong>🔴 긴급:</strong> ${rec.action} (${rec.timeframe})
            </div>
        `).join('') || ''}
        ${analysis.recommendations.shortTerm?.map(rec => `
            <div class="recommendation-item priority-medium">
                <strong>🟡 단기:</strong> ${rec.action} (${rec.timeframe})
            </div>
        `).join('') || ''}
        ${analysis.recommendations.longTerm?.map(rec => `
            <div class="recommendation-item priority-low">
                <strong>🟢 장기:</strong> ${rec.action} (${rec.timeframe})
            </div>
        `).join('') || ''}
    </div>
    ` : ''}

    <div class="footer">
        <p>본 보고서는 THINKLAB dental insight에서 자동 생성되었습니다.</p>
        <p>생성일시: ${new Date().toLocaleString('ko-KR')}</p>
    </div>
</body>
</html>
`
}