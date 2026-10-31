import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireClinicAccess } from "@/lib/security"

function authError(error: unknown) {
  if (error instanceof Error && (error.message.includes("인증되지 않은") || error.message.includes("접근 권한이") || error.message.includes("권한"))) {
    return NextResponse.json({ error: error.message, code: "AUTH_ERROR" }, { status: 401 })
  }
  return null
}

// PATCH /api/report-management/sectors/[id]  { name }  — 카테고리 이름 변경 (마스터 전용)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: "이름이 필요합니다" }, { status: 400 })
    }

    const sector = await prisma.reportSector.findUnique({ where: { id }, select: { clinicId: true } })
    if (!sector) return NextResponse.json({ error: "카테고리를 찾을 수 없습니다" }, { status: 404 })

    const user = await requireClinicAccess(sector.clinicId, "WRITE")
    if ((user as any).role !== "MASTER") {
      return NextResponse.json({ error: "마스터만 수정할 수 있습니다" }, { status: 403 })
    }

    const updated = await prisma.reportSector.update({ where: { id }, data: { name: name.trim() } })
    return NextResponse.json({ success: true, sector: updated })
  } catch (error) {
    const authRes = authError(error)
    if (authRes) return authRes
    console.error("[REPORT_MGMT] 카테고리 수정 실패:", error)
    return NextResponse.json({ error: "카테고리 수정 중 오류가 발생했습니다" }, { status: 500 })
  }
}

// DELETE /api/report-management/sectors/[id]  — 카테고리 삭제(하위 보고서 cascade, 마스터 전용)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const sector = await prisma.reportSector.findUnique({ where: { id }, select: { clinicId: true } })
    if (!sector) return NextResponse.json({ error: "카테고리를 찾을 수 없습니다" }, { status: 404 })

    const user = await requireClinicAccess(sector.clinicId, "DELETE")
    if ((user as any).role !== "MASTER") {
      return NextResponse.json({ error: "마스터만 삭제할 수 있습니다" }, { status: 403 })
    }

    await prisma.reportSector.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const authRes = authError(error)
    if (authRes) return authRes
    console.error("[REPORT_MGMT] 카테고리 삭제 실패:", error)
    return NextResponse.json({ error: "카테고리 삭제 중 오류가 발생했습니다" }, { status: 500 })
  }
}
