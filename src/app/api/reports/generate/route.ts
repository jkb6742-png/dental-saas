import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { requireClinicAccess, logSecurityEvent } from "@/lib/security"
import { createSecureQueryExecutor } from "@/lib/db-secure"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export async function POST(request: NextRequest) {
  try {
    const { clinicId, year, month } = await request.json()

    if (!clinicId || !year || !month) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 🔒 보안 검증: 클리닉 접근 권한 확인
    const user = await requireClinicAccess(clinicId)

    // 보안 이벤트 로깅 (정상 접근도 로깅)
    await logSecurityEvent({
      userId: user.id!,
      event: "REPORT_GENERATION_REQUEST",
      clinicId,
      timestamp: new Date(),
      details: { year, month }
    })

    // 🔒 보안 쿼리 실행기 생성 (RLS 적용)
    const secureQuery = await createSecureQueryExecutor(user.email || undefined)

    // 해당 월의 데이터 조회 (RLS 정책 자동 적용)
    const monthlySummary = await secureQuery.findMonthlySummary(
      clinicId,
      parseInt(year),
      parseInt(month)
    )

    if (!monthlySummary) {
      return NextResponse.json({ error: "해당 월의 데이터가 없습니다. 먼저 엑셀 파일을 업로드해주세요." }, { status: 404 })
    }

    // 기존 리포트가 있는지 확인
    const existingReport = await prisma.report.findFirst({
      where: {
        clinicId,
        year: parseInt(year),
        month: parseInt(month),
      },
    })

    // 추가 통계 데이터 조회
    const [patientStats, treatmentStats, visitRoutes, implantStats, consultationStats] = await Promise.all([
      prisma.patientStat.findFirst({
        where: { clinicId, year: parseInt(year), month: parseInt(month) },
      }),
      prisma.treatmentStat.findFirst({
        where: { clinicId, year: parseInt(year), month: parseInt(month) },
      }),
      prisma.visitRoute.findMany({
        where: { clinicId, year: parseInt(year), month: parseInt(month) },
        take: 10,
      }),
      prisma.implantStat.findFirst({
        where: { clinicId, year: parseInt(year), month: parseInt(month) },
      }),
      prisma.consultationStat.findFirst({
        where: { clinicId, year: parseInt(year), month: parseInt(month) },
      }),
    ])

    // 클리닉 정보 조회
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
    })

    // OpenAI API를 사용해 리포트 생성
    const reportContent = await generateReportWithGPT({
      clinic: clinic!,
      year: parseInt(year),
      month: parseInt(month),
      monthlySummary,
      patientStats,
      treatmentStats,
      visitRoutes,
      implantStats,
      consultationStats,
    })

    // 리포트 저장 또는 업데이트
    const reportData = {
      clinicId,
      year: parseInt(year),
      month: parseInt(month),
      content: reportContent,
      generatedAt: new Date(),
      monthlySummaryId: monthlySummary.id,
    }

    const report = existingReport
      ? await prisma.report.update({
          where: { id: existingReport.id },
          data: reportData,
        })
      : await prisma.report.create({
          data: reportData,
        })

    return NextResponse.json({
      success: true,
      reportId: report.id,
      message: "리포트가 성공적으로 생성되었습니다."
    })

  } catch (error) {
    console.error("Error generating report:", error)
    return NextResponse.json({
      error: "리포트 생성 중 오류가 발생했습니다."
    }, { status: 500 })
  }
}

interface ReportData {
  clinic: any
  year: number
  month: number
  monthlySummary: any
  patientStats: any
  treatmentStats: any
  visitRoutes: any[]
  implantStats: any
  consultationStats: any
}

async function generateReportWithGPT(data: ReportData): Promise<string> {
  const prompt = `
당신은 치과 경영 컨설턴트입니다. 다음 데이터를 바탕으로 ${data.clinic.name}의 ${data.year}년 ${data.month}월 경영 분석 리포트를 작성해주세요.

## 기본 정보
- 치과명: ${data.clinic.name}
- 분석 기간: ${data.year}년 ${data.month}월

## 월간 매출 현황
- 총 매출: ${data.monthlySummary?.totalRevenue?.toLocaleString() || 'N/A'}원
- 보험 매출: ${data.monthlySummary?.insuranceRevenue?.toLocaleString() || 'N/A'}원
- 비보험 매출: ${data.monthlySummary?.nonInsuranceRevenue?.toLocaleString() || 'N/A'}원
- 진료 일수: ${data.monthlySummary?.workingDays || 'N/A'}일
- 일 평균 매출: ${data.monthlySummary?.dailyAverage?.toLocaleString() || 'N/A'}원

## 환자 현황
- 총 방문 환자수: ${data.patientStats?.totalPatients || 'N/A'}명
- 신환자수: ${data.patientStats?.newPatients || 'N/A'}명
- 재방문환자수: ${data.patientStats?.returningPatients || 'N/A'}명
- 신환자 비율: ${data.patientStats?.newPatientRatio ? (data.patientStats.newPatientRatio * 100).toFixed(1) : 'N/A'}%

## 진료 현황
${data.treatmentStats ? `
- 보험 진료 건수: ${data.treatmentStats.insuranceCount || 0}건
- 비보험 진료 건수: ${data.treatmentStats.nonInsuranceCount || 0}건
- 평균 진료비: ${data.treatmentStats.averageTreatmentCost?.toLocaleString() || 'N/A'}원
` : '진료 현황 데이터 없음'}

## 임플란트 현황
${data.implantStats ? `
- 임플란트 건수: ${data.implantStats.totalCount || 0}건
- 임플란트 매출: ${data.implantStats.totalRevenue?.toLocaleString() || 'N/A'}원
- 건당 평균 금액: ${data.implantStats.averageCost?.toLocaleString() || 'N/A'}원
` : '임플란트 현황 데이터 없음'}

## 상담 현황
${data.consultationStats ? `
- 총 상담 건수: ${data.consultationStats.totalConsultations || 0}건
- 성약 건수: ${data.consultationStats.successfulConsultations || 0}건
- 성약률: ${data.consultationStats.successRate ? (data.consultationStats.successRate * 100).toFixed(1) : 'N/A'}%
` : '상담 현황 데이터 없음'}

## 주요 내원 경로
${data.visitRoutes.length > 0 ?
  data.visitRoutes.map(route => `- ${route.routeName}: ${route.patientCount}명 (비용: ${route.cost?.toLocaleString() || 'N/A'}원)`).join('\n')
  : '내원 경로 데이터 없음'
}

다음 형식으로 리포트를 작성해주세요:

# ${data.clinic.name} ${data.year}년 ${data.month}월 경영 분석 리포트

## 📊 월간 성과 요약

## 💰 매출 분석
- 전월 대비 성장률 추정 및 분석
- 보험/비보험 매출 비중 분석
- 일 평균 매출 트렌드 분석

## 👥 환자 현황 분석
- 신환자 유입 현황 및 평가
- 재방문 환자 관리 현황
- 환자당 평균 매출 분석

## 🦷 진료 현황 분석
- 주요 진료 항목별 수익성 분석
- 임플란트 사업 현황 (해당시)
- 고수익 진료 비중 분석

## 📈 마케팅 ROI 분석
- 내원 경로별 효율성 분석
- 마케팅 비용 대비 효과
- 상담 성약률 개선 방안

## 🎯 개선 권장사항
1. 즉시 개선 가능한 항목 3가지
2. 중장기 발전 방향 3가지
3. 다음 달 목표 설정

## 📋 종합 평가
- 이번 달 경영 성과 평점 (A~F)
- 강점 요약
- 약점 및 개선점 요약

**리포트는 실용적이고 구체적인 조언을 포함해야 하며, 마케팅 담당자가 실제로 활용할 수 있는 인사이트를 제공해주세요.**
`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4000,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "당신은 치과 경영 컨설턴트입니다. 제공된 데이터를 분석하여 실용적이고 구체적인 경영 분석 리포트를 작성해주세요."
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    })

    return completion.choices[0]?.message?.content || ""
  } catch (error) {
    console.error("OpenAI API error:", error)
    throw new Error("AI 리포트 생성에 실패했습니다.")
  }
}