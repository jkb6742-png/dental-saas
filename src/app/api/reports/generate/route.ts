import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { requireClinicAccess, logSecurityEvent } from "@/lib/security"
import { createSecureQueryExecutor } from "@/lib/db-secure"
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!, // 🔥 OpenAI API 사용 (임시 해결책)
})

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 API 호출 시작")
    console.log("🔍 DATABASE_URL 존재:", !!process.env.DATABASE_URL)
    console.log("🔍 NODE_ENV:", process.env.NODE_ENV)

    const { clinicId, year, month } = await request.json()

    if (!clinicId || !year || !month) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log("🔍 요청 파라미터:", { clinicId, year, month })

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
    const reportContent = await generateReportWithOpenAI({
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

    // HTML 파일 생성
    const fileName = `[${clinic?.name}] ${year}년 ${month}월 경영보고서.html`
    const filePath = `C:\\Users\\jjang\\Desktop\\${fileName}`

    // HTML 파일로 저장
    const fs = require('fs').promises
    await fs.writeFile(filePath, reportContent, 'utf8')

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
      fileName: fileName,
      filePath: filePath,
      message: "리포트가 성공적으로 생성되었습니다."
    })

  } catch (error) {
    console.error("Error generating report:", error)

    // 더 상세한 오류 정보 제공
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)

      // 인증 관련 오류인 경우 구체적 메시지 반환
      if (error.message.includes("인증되지 않은") || error.message.includes("접근 권한이")) {
        return NextResponse.json({
          error: error.message,
          code: "AUTH_ERROR"
        }, { status: 401 })
      }
    }

    return NextResponse.json({
      error: "리포트 생성 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "Unknown error"
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

async function generateReportWithOpenAI(data: ReportData): Promise<string> {
  const prompt = `
제공된 데이터를 바탕으로 ${data.clinic.name}의 ${data.year}년 ${data.month}월 경영 분석 리포트를 작성해주세요.

## 데이터 현황
- 치과명: ${data.clinic.name}
- 분석 기간: ${data.year}년 ${data.month}월
- 총 매출: ${data.monthlySummary?.totalRevenue?.toLocaleString() || 'N/A'}원
- 보험 매출: ${data.monthlySummary?.insuranceRevenue?.toLocaleString() || 'N/A'}원
- 비보험 매출: ${data.monthlySummary?.nonInsuranceRevenue?.toLocaleString() || 'N/A'}원
- 진료 일수: ${data.monthlySummary?.workingDays || 'N/A'}일
- 총 방문 환자수: ${data.patientStats?.totalPatients || 'N/A'}명
- 신환자수: ${data.patientStats?.newPatients || 'N/A'}명
- 재방문환자수: ${data.patientStats?.returningPatients || 'N/A'}명

**완성된 HTML 문서를 출력해주세요. HTML에는 다음 요소들이 포함되어야 합니다:**

1. **전문적인 디자인**: 깔끔하고 현대적인 스타일
2. **월 회의 논의 항목**:
   - 매출 목표 달성률 및 분석
   - 신환/구환 관리 현황
   - 진료 항목별 수익성
   - 상담 성약률 현황
   - 마케팅 ROI 분석
   - 개선 필요 사항
   - 다음 달 행동 계획

3. **시각적 요소**:
   - 색상 구분 (긍정: 파란색, 주의: 주황색, 위험: 빨간색)
   - 카드형 레이아웃
   - 아이콘 활용
   - 반응형 디자인

4. **실용적 내용**:
   - 구체적 수치와 비교 분석
   - 실행 가능한 개선안
   - 명확한 액션 아이템

완전한 HTML 문서(<!DOCTYPE html>부터 </html>까지)로 작성해주세요.`

  try {
    // 🔥 OpenAI API로 월 보고서 생성
    const completion = await openai.chat.completions.create({
      model: "gpt-4", // GPT-4 모델 사용
      max_tokens: 4000,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "당신은 치과 경영 컨설턴트입니다. 월간 경영 회의에서 논의할 전문적인 HTML 보고서를 작성해주세요."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })

    return completion.choices[0]?.message?.content || ""
  } catch (error) {
    console.error("OpenAI API error:", error)
    throw new Error("AI 리포트 생성에 실패했습니다.")
  }
}