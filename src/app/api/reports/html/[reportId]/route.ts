import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireClinicAccess, logSecurityEvent } from "@/lib/security"

export async function GET(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const reportId = params.reportId

    if (!reportId) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 })
    }

    // 보고서 조회
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        clinic: {
          select: {
            name: true
          }
        }
      }
    })

    if (!report) {
      return NextResponse.json({ error: "보고서를 찾을 수 없습니다" }, { status: 404 })
    }

    if (!report.content) {
      return NextResponse.json({ error: "보고서 내용이 없습니다" }, { status: 404 })
    }

    // 🔒 보안 검증: 클리닉 접근 권한 확인
    const user = await requireClinicAccess(report.clinicId, 'READ')

    // 보안 이벤트 로깅
    await logSecurityEvent({
      userId: user.id!,
      event: "REPORT_HTML_VIEW",
      clinicId: report.clinicId,
      timestamp: new Date(),
      details: { reportId, year: report.year, month: report.month }
    })

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        clinicId: report.clinicId,
        clinicName: report.clinic.name,
        year: report.year,
        month: report.month,
        content: report.content,
        generatedAt: report.generatedAt,
        fileName: `[${report.clinic.name}] ${report.year}년 ${report.month}월 경영보고서.html`
      }
    })

  } catch (error) {
    console.error("Error fetching report content:", error)

    if (error instanceof Error) {
      if (error.message.includes("인증되지 않은") || error.message.includes("접근 권한이")) {
        return NextResponse.json({
          error: error.message,
          code: "AUTH_ERROR"
        }, { status: 401 })
      }
    }

    return NextResponse.json({
      error: "보고서 조회 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}