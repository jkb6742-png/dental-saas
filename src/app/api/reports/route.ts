import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { requireClinicAccess } from "@/lib/security"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get("clinicId")

    if (!clinicId) {
      return NextResponse.json({ error: "Missing clinicId" }, { status: 400 })
    }

    // 🔒 보안 검증: 클리닉 접근 권한 확인
    await requireClinicAccess(clinicId)

    const reports = await prisma.report.findMany({
      where: { clinicId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 12,
    })

    return NextResponse.json(reports)
  } catch (error) {
    console.error("Error fetching reports:", error)
    return NextResponse.json({
      error: "리포트 목록을 불러오는 중 오류가 발생했습니다."
    }, { status: 500 })
  }
}