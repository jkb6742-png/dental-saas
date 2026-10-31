import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireClinicAccess, logSecurityEvent } from "@/lib/security"
import { sanitizeReportHtml } from "@/lib/reportSanitize"

// POST /api/report-management/reports  (multipart)
//   file(html), clinicId, sectorId, title, month?, memo?
// 카테고리에 HTML 보고서 업로드 (마스터 전용)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const clinicId = formData.get("clinicId") as string
    const sectorId = formData.get("sectorId") as string
    const title = ((formData.get("title") as string) || "").trim()
    const month = ((formData.get("month") as string) || "").trim() || null
    const memo = ((formData.get("memo") as string) || "").trim() || null

    if (!file || !clinicId || !sectorId || !title) {
      return NextResponse.json({ error: "파일, clinicId, sectorId, 제목이 필요합니다" }, { status: 400 })
    }

    const user = await requireClinicAccess(clinicId, "WRITE")
    if ((user as any).role !== "MASTER") {
      return NextResponse.json({ error: "마스터만 보고서를 업로드할 수 있습니다" }, { status: 403 })
    }

    // 카테고리가 이 치과 소속인지 확인
    const sector = await prisma.reportSector.findUnique({ where: { id: sectorId }, select: { clinicId: true } })
    if (!sector || sector.clinicId !== clinicId) {
      return NextResponse.json({ error: "유효하지 않은 카테고리입니다" }, { status: 400 })
    }

    // 파일 검증
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."))
    const isPdf = ext === ".pdf"
    const isHtml = ext === ".html" || ext === ".htm"
    if (!isPdf && !isHtml) {
      return NextResponse.json({ error: "PDF(.pdf) 또는 HTML(.html, .htm) 파일만 업로드 가능합니다" }, { status: 400 })
    }
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "파일 크기는 50MB를 초과할 수 없습니다" }, { status: 400 })
    }

    // 파일 종류별 처리
    let content = ""
    let fileData: Buffer | null = null
    let fileType = "html"

    if (isPdf) {
      const buf = Buffer.from(await file.arrayBuffer())
      // 간단한 PDF 시그니처 검증(%PDF)
      if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
        return NextResponse.json({ error: "올바른 PDF 파일이 아닙니다" }, { status: 400 })
      }
      fileData = buf
      fileType = "pdf"
    } else {
      const raw = await file.text()
      if (!/<!DOCTYPE html>/i.test(raw) && !/<html/i.test(raw) && !/<body/i.test(raw)) {
        return NextResponse.json({ error: "올바른 HTML 파일이 아닙니다" }, { status: 400 })
      }
      content = sanitizeReportHtml(raw)
    }

    const last = await prisma.managedReport.findFirst({
      where: { sectorId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    })

    const report = await prisma.managedReport.create({
      data: {
        clinicId,
        sectorId,
        title,
        month,
        memo,
        content,
        fileType,
        fileName: file.name,
        fileData,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
      select: { id: true, title: true, month: true, memo: true, fileType: true, fileName: true, sortOrder: true, createdAt: true, updatedAt: true, sectorId: true },
    })

    await logSecurityEvent({
      userId: (user as any).id,
      event: "MANAGED_REPORT_UPLOAD",
      clinicId,
      timestamp: new Date(),
      details: { sectorId, title, month, fileName: file.name },
    })

    return NextResponse.json({ success: true, report })
  } catch (error: any) {
    if (error instanceof Error && (error.message.includes("인증") || error.message.includes("권한"))) {
      return NextResponse.json({ error: error.message, code: "AUTH_ERROR" }, { status: 401 })
    }
    console.error("[REPORT_MGMT] 보고서 업로드 실패:", error)
    return NextResponse.json({ error: "보고서 업로드 중 오류가 발생했습니다" }, { status: 500 })
  }
}
