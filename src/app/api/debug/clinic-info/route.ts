import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "로그인 필요" }, { status: 401 })
    }

    // URL에서 clinicId 파라미터 가져오기
    const url = new URL(request.url)
    const clinicId = url.searchParams.get("clinicId")

    if (!clinicId) {
      return NextResponse.json({ error: "clinicId 파라미터가 필요합니다" }, { status: 400 })
    }

    // 해당 clinic이 존재하는지 확인
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      include: {
        agency: true,
        reviewConfigs: true
      }
    })

    if (!clinic) {
      return NextResponse.json({ error: "치과를 찾을 수 없습니다" }, { status: 404 })
    }

    return NextResponse.json({
      clinic: {
        id: clinic.id,
        name: clinic.name,
        code: clinic.code,
        agency: clinic.agency.name
      },
      reviewConfigs: clinic.reviewConfigs.map(config => ({
        id: config.id,
        source: config.source,
        placeName: config.placeName,
        isActive: config.isActive,
        lastSyncAt: config.lastSyncAt
      }))
    })

  } catch (error: any) {
    return NextResponse.json({
      error: "치과 정보 조회 실패",
      details: error.message
    }, { status: 500 })
  }
}