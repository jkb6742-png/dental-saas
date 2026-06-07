import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { requireClinicAccess, logSecurityEvent } from "@/lib/security"

export async function DELETE(request: NextRequest) {
  try {
    const { reportId, filePath } = await request.json()

    if (!reportId) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 })
    }

    // 보고서 정보 조회
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        clinic: true
      }
    })

    if (!report) {
      return NextResponse.json({ error: "리포트를 찾을 수 없습니다." }, { status: 404 })
    }

    // 🔒 보안 검증: 클리닉 접근 및 DELETE 권한 확인
    const user = await requireClinicAccess(report.clinicId, 'DELETE')

    // 보안 이벤트 로깅
    await logSecurityEvent({
      userId: user.id!,
      event: "REPORT_DELETION",
      clinicId: report.clinicId,
      timestamp: new Date(),
      details: { reportId, year: report.year, month: report.month }
    })

    // HTML 파일 삭제 (파일 시스템에서)
    if (filePath) {
      try {
        const fs = require('fs').promises
        await fs.unlink(filePath)
      } catch (fileError) {
        console.warn("HTML 파일 삭제 실패:", fileError)
        // 파일 삭제 실패해도 DB에서는 삭제 진행
      }
    }

    // 데이터베이스에서 보고서 삭제
    await prisma.report.delete({
      where: { id: reportId }
    })

    return NextResponse.json({
      success: true,
      message: "리포트가 성공적으로 삭제되었습니다."
    })

  } catch (error) {
    console.error("Error deleting report:", error)

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
      error: "리포트 삭제 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}