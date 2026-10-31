import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/auth"

// GET /api/report-management/init-db
// 보고서 관리 테이블(ReportSector, ManagedReport)을 멱등 생성한다.
// Dockerfile이 자동 마이그레이션을 하지 않으므로(standalone node server.js)
// NAS 배포 후 마스터가 1회 호출. 이미 존재하면 아무 변화 없음.
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }
    if ((session.user as any).role !== "MASTER") {
      return NextResponse.json({ error: "마스터만 실행할 수 있습니다" }, { status: 403 })
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ReportSector" (
        "id" TEXT PRIMARY KEY,
        "clinicId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ReportSector_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON UPDATE CASCADE ON DELETE CASCADE
      );
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ReportSector_clinicId_idx" ON "ReportSector"("clinicId");`)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ManagedReport" (
        "id" TEXT PRIMARY KEY,
        "clinicId" TEXT NOT NULL,
        "sectorId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "month" TEXT,
        "memo" TEXT,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ManagedReport_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT "ManagedReport_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "ReportSector"("id") ON UPDATE CASCADE ON DELETE CASCADE
      );
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ManagedReport_clinicId_idx" ON "ManagedReport"("clinicId");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ManagedReport_sectorId_idx" ON "ManagedReport"("sectorId");`)

    // PDF 업로드 지원 컬럼 (기존 배포분에 없으면 추가 — 멱등)
    await prisma.$executeRawUnsafe(`ALTER TABLE "ManagedReport" ADD COLUMN IF NOT EXISTS "fileType" TEXT NOT NULL DEFAULT 'html';`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "ManagedReport" ADD COLUMN IF NOT EXISTS "fileName" TEXT;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "ManagedReport" ADD COLUMN IF NOT EXISTS "fileData" BYTEA;`)

    const sectors = await prisma.reportSector.count()
    const reports = await prisma.managedReport.count()

    return NextResponse.json({ success: true, message: "보고서 관리 테이블 준비 완료", sectors, reports })
  } catch (error: any) {
    console.error("[REPORT_MGMT] init-db 실패:", error)
    return NextResponse.json({ error: "테이블 초기화 실패", details: error?.message }, { status: 500 })
  }
}
