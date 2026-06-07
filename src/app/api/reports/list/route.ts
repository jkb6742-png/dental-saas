import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { requireClinicAccess, logSecurityEvent } from "@/lib/security"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')

    if (!clinicId) {
      return NextResponse.json({ error: "Clinic ID is required" }, { status: 400 })
    }

    // 🔒 보안 검증: 클리닉 접근 및 READ 권한 확인
    const user = await requireClinicAccess(clinicId, 'read')

    // 보안 이벤트 로깅
    await logSecurityEvent({
      userId: user.id!,
      event: "REPORT_LIST_ACCESS",
      clinicId,
      timestamp: new Date()
    })

    // 보고서 목록 조회 (최신순)
    const reports = await prisma.report.findMany({
      where: { clinicId },
      include: {
        clinic: {
          select: {
            name: true
          }
        },
        monthlySummary: {
          select: {
            totalRevenue: true,
            workingDays: true
          }
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
      const fileName = `[${report.clinic.name}] ${report.year}년 ${report.month}월 경영보고서.html`
      const newFilePath = path.join(process.cwd(), 'uploads', 'reports', report.clinicId, report.year.toString(), report.month.toString().padStart(2, '0'), fileName)
      const legacyFilePath = `C:\\Users\\jjang\\Desktop\\${fileName}`

      return {
        id: report.id,
        clinicId: report.clinicId,
        clinicName: report.clinic.name,
        year: report.year,
        month: report.month,
        totalRevenue: report.monthlySummary?.totalRevenue,
        workingDays: report.monthlySummary?.workingDays,
        generatedAt: report.generatedAt,
        fileName: fileName,
        filePath: newFilePath,
        legacyFilePath: legacyFilePath // 레거시 호환성
      }
    })

    return NextResponse.json({
      success: true,
      reports: formattedReports
    })

  } catch (error) {
    console.error("Error fetching reports:", error)

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
      error: "리포트 목록 조회 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}