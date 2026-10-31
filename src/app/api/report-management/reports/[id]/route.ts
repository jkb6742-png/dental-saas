import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireClinicAccess } from "@/lib/security"

function authError(error: unknown) {
  if (error instanceof Error && (error.message.includes("인증") || error.message.includes("권한"))) {
    return NextResponse.json({ error: error.message, code: "AUTH_ERROR" }, { status: 401 })
  }
  return null
}

// GET /api/report-management/reports/[id]        -> iframe용 원본 HTML
// GET /api/report-management/reports/[id]?download=html -> 파일 다운로드
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const download = req.nextUrl.searchParams.get("download")

    const report = await prisma.managedReport.findUnique({
      where: { id },
      include: { clinic: { select: { name: true } } },
    })
    if (!report) return NextResponse.json({ error: "보고서를 찾을 수 없습니다" }, { status: 404 })

    await requireClinicAccess(report.clinicId, "READ")

    const wantDownload = download === "html" || download === "1" || download === "pdf"

    // PDF: 바이너리 그대로 반환
    if (report.fileType === "pdf" && report.fileData) {
      const ext = ".pdf"
      const headers: Record<string, string> = {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${wantDownload ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(`[${report.clinic.name}] ${report.title}${report.month ? ` ${report.month}` : ""}${ext}`)}`,
      }
      return new NextResponse(new Uint8Array(report.fileData), { status: 200, headers })
    }

    // HTML: 원본 텍스트 반환
    const headers: Record<string, string> = {
      "Content-Type": "text/html; charset=utf-8",
    }
    if (wantDownload) {
      const safeName = `[${report.clinic.name}] ${report.title}${report.month ? ` ${report.month}` : ""}.html`
      headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`
    }

    return new NextResponse(report.content, { status: 200, headers })
  } catch (error) {
    const authRes = authError(error)
    if (authRes) return authRes
    console.error("[REPORT_MGMT] 보고서 조회 실패:", error)
    return NextResponse.json({ error: "보고서 조회 중 오류가 발생했습니다" }, { status: 500 })
  }
}

// PATCH /api/report-management/reports/[id]  { title?, month?, memo?, sectorId? }  (마스터 전용)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const report = await prisma.managedReport.findUnique({ where: { id }, select: { clinicId: true } })
    if (!report) return NextResponse.json({ error: "보고서를 찾을 수 없습니다" }, { status: 404 })

    const user = await requireClinicAccess(report.clinicId, "WRITE")
    if ((user as any).role !== "MASTER") {
      return NextResponse.json({ error: "마스터만 수정할 수 있습니다" }, { status: 403 })
    }

    const data: Record<string, any> = {}
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim()
    if (typeof body.month === "string") data.month = body.month.trim() || null
    if (typeof body.memo === "string") data.memo = body.memo.trim() || null
    if (typeof body.sectorId === "string" && body.sectorId) {
      const target = await prisma.reportSector.findUnique({ where: { id: body.sectorId }, select: { clinicId: true } })
      if (!target || target.clinicId !== report.clinicId) {
        return NextResponse.json({ error: "유효하지 않은 카테고리입니다" }, { status: 400 })
      }
      data.sectorId = body.sectorId
    }

    const updated = await prisma.managedReport.update({
      where: { id },
      data,
      select: { id: true, title: true, month: true, memo: true, sortOrder: true, sectorId: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({ success: true, report: updated })
  } catch (error) {
    const authRes = authError(error)
    if (authRes) return authRes
    console.error("[REPORT_MGMT] 보고서 수정 실패:", error)
    return NextResponse.json({ error: "보고서 수정 중 오류가 발생했습니다" }, { status: 500 })
  }
}

// DELETE /api/report-management/reports/[id]  (마스터 전용)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const report = await prisma.managedReport.findUnique({ where: { id }, select: { clinicId: true } })
    if (!report) return NextResponse.json({ error: "보고서를 찾을 수 없습니다" }, { status: 404 })

    const user = await requireClinicAccess(report.clinicId, "DELETE")
    if ((user as any).role !== "MASTER") {
      return NextResponse.json({ error: "마스터만 삭제할 수 있습니다" }, { status: 403 })
    }

    await prisma.managedReport.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const authRes = authError(error)
    if (authRes) return authRes
    console.error("[REPORT_MGMT] 보고서 삭제 실패:", error)
    return NextResponse.json({ error: "보고서 삭제 중 오류가 발생했습니다" }, { status: 500 })
  }
}
