import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { readSheetData, parsePEIData } from "@/lib/googleSheets"
import { analyzePEIData } from "@/lib/pei/analyzer"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    const { clinicId, year, month, forceAnalysis } = await req.json()

    if (!clinicId || !year || !month) {
      return NextResponse.json({
        error: "clinicId, year, month가 필요합니다"
      }, { status: 400 })
    }

    console.log(`[PEI_ANALYZE] ${clinicId} ${year}년 ${month}월 분석 요청`)

    // 해당 치과의 시트 설정 조회
    const sheetConfig = await prisma.peiSheetConfig.findUnique({
      where: { clinicId },
      include: {
        clinic: { select: { name: true } }
      }
    })

    if (!sheetConfig) {
      return NextResponse.json({
        error: "설정된 구글 시트가 없습니다",
        needsConfig: true
      }, { status: 404 })
    }

    if (!sheetConfig.isActive) {
      return NextResponse.json({
        error: "비활성화된 시트 설정입니다"
      }, { status: 400 })
    }

    // 기존 분석 결과가 있는지 확인 (forceAnalysis가 false인 경우)
    if (!forceAnalysis) {
      const existingReport = await prisma.peiReport.findUnique({
        where: {
          clinicId_year_month: { clinicId, year, month }
        }
      })

      if (existingReport && existingReport.status === 'COMPLETED') {
        console.log(`[PEI_ANALYZE] 기존 HTML 보고서 반환: ${existingReport.id}`)
        return NextResponse.json({
          success: true,
          message: "기존 HTML 보고서를 반환합니다",
          cached: true,
          reportType: "html",
          htmlReport: existingReport.content, // HTML 내용 반환
          analysis: {
            peiScore: existingReport.peiScore,
            categoryScores: existingReport.categoryScores
          },
          reportId: existingReport.id,
          generatedAt: existingReport.generatedAt
        })
      }
    }

    console.log(`[PEI_ANALYZE] 새로운 분석 시작`)

    // 구글 시트에서 데이터 읽기
    const fullRange = sheetConfig.sheetName
      ? `${sheetConfig.sheetName}!A1:Z1000`
      : 'A1:Z1000'

    console.log(`[PEI_ANALYZE] 🔍 구글 시트 데이터 읽기 시작:`)
    console.log(`  sheetId: ${sheetConfig.sheetId}`)
    console.log(`  sheetName: ${sheetConfig.sheetName}`)
    console.log(`  fullRange: ${fullRange}`)
    console.log(`  isActive: ${sheetConfig.isActive}`)

    const rawData = await readSheetData(sheetConfig.sheetId, fullRange)

    console.log(`[PEI_ANALYZE] ✅ 데이터 읽기 완료:`)
    console.log(`  총 행수: ${rawData.values?.length || 0}`)
    console.log(`  헤더: `, rawData.values?.[0])
    console.log(`  O열 헤더: "${rawData.values?.[0]?.[14]}"`)
    console.log(`  P열 헤더: "${rawData.values?.[0]?.[15]}"`)

    if (rawData.values && rawData.values.length > 1) {
      console.log(`  첫 데이터 행:`)
      console.log(`    O열 데이터: "${rawData.values[1][14]}"`)
      console.log(`    P열 데이터: "${rawData.values[1][15]}"`)
    }

    if (!rawData.values || rawData.values.length === 0) {
      return NextResponse.json({
        error: "시트에 데이터가 없습니다",
        isEmpty: true
      }, { status: 404 })
    }

    // PEI 데이터 파싱 (월별 필터링 적용)
    const peiData = parsePEIData(rawData.values, year, month)

    if (peiData.summary.totalRecords === 0) {
      return NextResponse.json({
        error: "유효한 PEI 데이터가 없습니다",
        summary: peiData.summary
      }, { status: 400 })
    }

    console.log(`[PEI_ANALYZE] 데이터 파싱 완료: ${peiData.summary.totalRecords}건`)

    // 분석용 데이터 구조 생성
    const analysisData = {
      summary: peiData.summary,
      records: peiData.records,
      feedbackData: peiData.feedbackData, // 🚨 이게 중요!
      metadata: {
        clinicName: sheetConfig.clinic.name,
        dataRange: fullRange,
        lastSyncAt: new Date().toISOString(),
        totalRows: rawData.values.length,
        validRecords: peiData.records.length
      }
    }

    console.log(`[PEI_ANALYZE] 🔍 analysisData 확인:`)
    console.log(`  summary.totalRecords:`, analysisData.summary.totalRecords)
    console.log(`  records 길이:`, analysisData.records.length)
    console.log(`  feedbackData 존재:`, !!analysisData.feedbackData)
    console.log(`  feedbackData.feedback14 길이:`, analysisData.feedbackData?.feedback14?.length || 0)
    console.log(`  feedbackData.feedback15 길이:`, analysisData.feedbackData?.feedback15?.length || 0)

    // GPT로 HTML 보고서 생성
    console.log(`[PEI_ANALYZE] HTML 보고서 생성 시작...`)
    const htmlReport = await analyzePEIData(analysisData, year, month)
    console.log(`[PEI_ANALYZE] HTML 보고서 생성 완료`)

    // HTML 보고서를 데이터베이스에 저장
    const reportData = {
      clinicId,
      sheetConfigId: sheetConfig.id,
      year,
      month,
      title: `${sheetConfig.clinic.name} ${year}년 ${month}월 PEI 분석 보고서`,
      summary: `${year}년 ${month}월 PEI HTML 보고서가 생성되었습니다.`,
      insights: [], // HTML 보고서에 포함되므로 별도 저장 불필요
      recommendations: [], // HTML 보고서에 포함되므로 별도 저장 불필요
      rawData: analysisData,
      peiScore: peiData.summary.peiScore,
      categoryScores: {
        satisfaction: peiData.summary.avgSatisfaction,
        service: peiData.summary.avgServiceScore,
        facility: peiData.summary.avgFacilityScore,
        revisit: peiData.summary.avgRevisitIntention
      },
      content: htmlReport, // HTML 콘텐츠 저장
      status: 'COMPLETED',
      generatedAt: new Date(),
      generatedBy: (session.user as any).id
    }

    // Upsert 방식으로 보고서 저장 (기존 것이 있으면 업데이트)
    const savedReport = await prisma.peiReport.upsert({
      where: {
        clinicId_year_month: { clinicId, year, month }
      },
      update: {
        ...reportData,
        updatedAt: new Date()
      },
      create: reportData
    })

    console.log(`[PEI_ANALYZE] 분석 완료 및 저장: ${savedReport.id}`)

    return NextResponse.json({
      success: true,
      message: "PEI HTML 보고서가 생성되었습니다",
      reportType: "html",
      htmlReport: htmlReport,
      analysis: {
        peiScore: peiData.summary.peiScore,
        categoryScores: reportData.categoryScores
      },
      metadata: {
        totalRecords: peiData.summary.totalRecords,
        dataQuality: peiData.summary.totalRecords >= 10 ? 'good' : 'limited',
        analysisDate: new Date().toISOString(),
        clinicName: sheetConfig.clinic.name,
        reportFormat: "HTML"
      },
      reportId: savedReport.id
    })

  } catch (error: any) {
    console.error('[PEI_ANALYZE] 분석 실패:', error)

    // 구체적인 에러 처리
    let errorMessage = "PEI 분석 중 오류가 발생했습니다"
    let statusCode = 500

    if (error.message?.includes('OPENAI_API_KEY')) {
      errorMessage = "OpenAI API 키가 설정되지 않았습니다"
      statusCode = 500
    } else if (error.message?.includes('insufficient_quota')) {
      errorMessage = "API 사용량 한도가 초과되었습니다"
      statusCode = 429
    } else if (error.message?.includes('rate_limit')) {
      errorMessage = "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요"
      statusCode = 429
    } else if (error.code === 404) {
      errorMessage = "스프레드시트를 찾을 수 없습니다"
      statusCode = 404
    } else if (error.code === 403) {
      errorMessage = "시트 접근 권한이 없습니다"
      statusCode = 403
    }

    return NextResponse.json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      retryAfter: statusCode === 429 ? 60 : undefined
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
    const clinicId = searchParams.get('clinicId')
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!clinicId || !year || !month) {
      return NextResponse.json({
        error: "clinicId, year, month 파라미터가 필요합니다"
      }, { status: 400 })
    }

    // 기존 분석 결과 조회
    const existingReport = await prisma.peiReport.findUnique({
      where: {
        clinicId_year_month: {
          clinicId,
          year: parseInt(year),
          month: parseInt(month)
        }
      },
      include: {
        clinic: { select: { name: true } },
        sheetConfig: { select: { sheetUrl: true, lastSyncAt: true } }
      }
    })

    if (!existingReport) {
      return NextResponse.json({
        hasReport: false,
        message: "해당 기간의 분석 결과가 없습니다"
      })
    }

    return NextResponse.json({
      hasReport: true,
      reportType: "html",
      htmlReport: existingReport.content, // HTML 보고서 내용
      report: {
        id: existingReport.id,
        title: existingReport.title,
        peiScore: existingReport.peiScore,
        summary: existingReport.summary,
        categoryScores: existingReport.categoryScores,
        status: existingReport.status,
        generatedAt: existingReport.generatedAt,
        clinicName: existingReport.clinic.name
      },
      metadata: {
        lastSyncAt: existingReport.sheetConfig?.lastSyncAt,
        dataSource: existingReport.sheetConfig?.sheetUrl,
        reportFormat: "HTML"
      }
    })

  } catch (error) {
    console.error('[PEI_ANALYZE] 조회 실패:', error)
    return NextResponse.json({
      error: "분석 결과 조회 중 오류가 발생했습니다"
    }, { status: 500 })
  }
}