import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { requireClinicAccess, logSecurityEvent } from "@/lib/security"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const clinicId = searchParams.get('clinicId')

    if (!clinicId) {
      return NextResponse.json({ error: "Clinic ID is required" }, { status: 400 })
    }

    // 🔒 보안 검증: 클리닉 접근 및 READ 권한 확인
    const user = await requireClinicAccess(clinicId, 'read')

    // 보안 이벤트 로깅
    await logSecurityEvent({
      userId: user.id!,
      event: "PEI_REPORT_LIST_ACCESS",
      clinicId,
      timestamp: new Date()
    })

    // PEI 보고서 목록 조회 (HTML 콘텐츠가 있는 것만, 최신순)
    const reports = await prisma.peiReport.findMany({
      where: {
        clinicId,
        content: {
          not: null
        }
      },
      include: {
        clinic: {
          select: { name: true }
        }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    })

    // 응답 데이터 포맷팅
    const path = require('path')
    const formattedReports = reports.map(report => {
      const fileName = `[${report.clinic.name}] ${report.year}년 ${report.month}월 PEI리포트.html`
      const newFilePath = path.join(process.cwd(), 'uploads', 'pei', clinicId, report.year.toString(), report.month.toString().padStart(2, '0'), fileName)

      return {
        id: report.id,
        clinicId: report.clinicId,
        clinicName: report.clinic.name,
        year: report.year,
        month: report.month,
        generatedAt: report.generatedAt,
        fileName: fileName,
        filePath: newFilePath
      }
    })

    return NextResponse.json({
      success: true,
      reports: formattedReports
    })

  } catch (error) {
    console.error("Error fetching PEI reports:", error)

    if (error instanceof Error) {
      // 인증 관련 오류인 경우
      if (error.message.includes("인증되지 않은") || error.message.includes("접근 권한이")) {
        return NextResponse.json({
          error: error.message,
          code: "AUTH_ERROR"
        }, { status: 401 })
      }
    }

    return NextResponse.json({
      error: "PEI 리포트 목록 조회 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

// 개별 보고서 상세 조회
// 보고서 삭제
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    const { reportId } = await req.json()
    if (!reportId) {
      return NextResponse.json({ error: "reportId가 필요합니다" }, { status: 400 })
    }

    // 보고서 존재 확인
    const existingReport = await prisma.peiReport.findUnique({
      where: { id: reportId }
    })

    if (!existingReport) {
      return NextResponse.json({ error: "보고서를 찾을 수 없습니다" }, { status: 404 })
    }

    // 보고서 삭제
    await prisma.peiReport.delete({
      where: { id: reportId }
    })

    console.log(`[PEI_REPORTS] 보고서 삭제 완료: ${reportId}`)

    return NextResponse.json({
      success: true,
      message: "보고서가 삭제되었습니다"
    })

  } catch (error) {
    console.error("보고서 삭제 실패:", error)
    return NextResponse.json({
      error: "보고서 삭제 중 오류가 발생했습니다"
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    const { reportId } = await req.json()
    if (!reportId) {
      return NextResponse.json({ error: "reportId가 필요합니다" }, { status: 400 })
    }

    const report = await prisma.peiReport.findUnique({
      where: { id: reportId },
      include: {
        clinic: {
          select: { name: true, code: true }
        },
        sheetConfig: {
          select: { sheetUrl: true, lastSyncAt: true }
        },
        generator: {
          select: { name: true, email: true }
        }
      }
    })

    if (!report) {
      return NextResponse.json({ error: "보고서를 찾을 수 없습니다" }, { status: 404 })
    }

    // 분석 결과 파싱 (HTML과 JSON 모두 지원)
    let analysis = null
    if (report.content) {
      if (report.content.trim().startsWith('<!DOCTYPE html>')) {
        // HTML 보고서인 경우 기본 정보만 구성
        analysis = {
          htmlReport: report.content,
          isHtmlFormat: true
        }
      } else {
        try {
          analysis = JSON.parse(report.content)
        } catch (e) {
          console.error("보고서 콘텐츠 파싱 실패:", e)
        }
      }
    }

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        title: report.title,
        year: report.year,
        month: report.month,
        period: `${report.year}년 ${report.month}월`,
        summary: report.summary,
        insights: report.insights,
        recommendations: report.recommendations,
        peiScore: report.peiScore,
        categoryScores: report.categoryScores,
        status: report.status,
        generatedAt: report.generatedAt,
        createdAt: report.createdAt,
        clinic: {
          name: report.clinic.name,
          code: report.clinic.code
        },
        generatedBy: report.generator?.name || '시스템',
        dataSource: {
          sheetUrl: report.sheetConfig?.sheetUrl,
          lastSyncAt: report.sheetConfig?.lastSyncAt
        },
        analysis // GPT 분석 결과 전체
      }
    })

  } catch (error) {
    console.error("보고서 조회 실패:", error)
    return NextResponse.json({
      error: "보고서 조회 중 오류가 발생했습니다"
    }, { status: 500 })
  }
}