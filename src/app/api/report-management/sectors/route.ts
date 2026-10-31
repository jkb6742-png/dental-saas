import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireClinicAccess } from "@/lib/security"

function authError(error: unknown) {
  if (error instanceof Error && (error.message.includes("인증되지 않은") || error.message.includes("접근 권한이") || error.message.includes("권한"))) {
    return NextResponse.json({ error: error.message, code: "AUTH_ERROR" }, { status: 401 })
  }
  return null
}

// GET /api/report-management/sectors?clinicId=xxx
// 치과의 카테고리(섹터) + 각 카테고리의 보고서 목록(내용 제외) 반환
export async function GET(req: NextRequest) {
  try {
    const clinicId = req.nextUrl.searchParams.get("clinicId")
    if (!clinicId) {
      return NextResponse.json({ error: "clinicId가 필요합니다" }, { status: 400 })
    }

    await requireClinicAccess(clinicId, "READ")

    const sectors = await prisma.reportSector.findMany({
      where: { clinicId },
      orderBy: { sortOrder: "asc" },
      include: {
        reports: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            title: true,
            month: true,
            memo: true,
            fileType: true,
            fileName: true,
            sortOrder: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })

    return NextResponse.json({ sectors })
  } catch (error) {
    const authRes = authError(error)
    if (authRes) return authRes
    console.error("[REPORT_MGMT] 카테고리 조회 실패:", error)
    return NextResponse.json({ error: "카테고리 조회 중 오류가 발생했습니다" }, { status: 500 })
  }
}

// POST /api/report-management/sectors  { clinicId, name }
// 카테고리(섹터) 추가 — 마스터 전용
export async function POST(req: NextRequest) {
  try {
    const { clinicId, name } = await req.json()
    if (!clinicId || !name?.trim()) {
      return NextResponse.json({ error: "clinicId와 이름이 필요합니다" }, { status: 400 })
    }

    const user = await requireClinicAccess(clinicId, "WRITE")
    if ((user as any).role !== "MASTER") {
      return NextResponse.json({ error: "마스터만 카테고리를 추가할 수 있습니다" }, { status: 403 })
    }

    const last = await prisma.reportSector.findFirst({
      where: { clinicId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    })

    const sector = await prisma.reportSector.create({
      data: {
        clinicId,
        name: name.trim(),
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    })

    return NextResponse.json({ success: true, sector })
  } catch (error) {
    const authRes = authError(error)
    if (authRes) return authRes
    console.error("[REPORT_MGMT] 카테고리 생성 실패:", error)
    return NextResponse.json({ error: "카테고리 생성 중 오류가 발생했습니다" }, { status: 500 })
  }
}
