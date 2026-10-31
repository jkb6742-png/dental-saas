import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireClinicAccess } from "@/lib/security"

// POST /api/report-management/reports/reorder  { clinicId, sectorId, orderedIds: string[] }
// 한 카테고리 내 보고서 순서 일괄 변경 (마스터 전용)
export async function POST(req: NextRequest) {
  try {
    const { clinicId, sectorId, orderedIds } = await req.json()
    if (!clinicId || !sectorId || !Array.isArray(orderedIds)) {
      return NextResponse.json({ error: "clinicId, sectorId, orderedIds가 필요합니다" }, { status: 400 })
    }

    const user = await requireClinicAccess(clinicId, "WRITE")
    if ((user as any).role !== "MASTER") {
      return NextResponse.json({ error: "마스터만 순서를 변경할 수 있습니다" }, { status: 403 })
    }

    await prisma.$transaction(
      orderedIds.map((id: string, index: number) =>
        prisma.managedReport.updateMany({
          where: { id, clinicId, sectorId },
          data: { sortOrder: index },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && (error.message.includes("인증") || error.message.includes("권한"))) {
      return NextResponse.json({ error: error.message, code: "AUTH_ERROR" }, { status: 401 })
    }
    console.error("[REPORT_MGMT] 보고서 순서변경 실패:", error)
    return NextResponse.json({ error: "순서 변경 중 오류가 발생했습니다" }, { status: 500 })
  }
}
