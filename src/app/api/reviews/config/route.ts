import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

// 리뷰 설정 생성/수정
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { clinicId, source, placeName, placeId, placeUrl } = await request.json()

    if (!clinicId || !source) {
      return NextResponse.json({ error: "Missing required fields: clinicId, source" }, { status: 400 })
    }

    if (!placeName) {
      return NextResponse.json({ error: "업체명은 필수입니다" }, { status: 400 })
    }

    // 네이버 리뷰의 경우 placeUrl 필수, 구글 리뷰의 경우 placeId 필수
    if (source === "NAVER") {
      if (!placeUrl) {
        return NextResponse.json({ error: "네이버 플레이스 URL은 필수입니다" }, { status: 400 })
      }

      // 네이버 URL 형식 검증
      if (!placeUrl.includes('map.naver.com')) {
        return NextResponse.json({ error: "올바른 네이버 지도 URL 형식이 아닙니다 (예: https://map.naver.com/p/...)" }, { status: 400 })
      }
    }

    if (source === "GOOGLE") {
      if (!placeId) {
        return NextResponse.json({ error: "Google Place ID는 필수입니다" }, { status: 400 })
      }

      // Google Place ID 형식 검증 (보통 ChIJ로 시작)
      if (!placeId.startsWith('ChIJ') && !placeId.startsWith('EI') && !placeId.startsWith('GhIJ')) {
        return NextResponse.json({ error: "올바른 Google Place ID 형식이 아닙니다 (예: ChIJ...)" }, { status: 400 })
      }
    }

    console.log(`💾 ${source} 리뷰 설정 저장 시도:`, {
      clinicId,
      placeName,
      placeId: placeId || 'N/A',
      placeUrl: placeUrl || 'N/A'
    })

    // 기존 설정이 있는지 확인
    const existingConfig = await prisma.reviewConfig.findFirst({
      where: {
        clinicId,
        source
      }
    })

    let config
    if (existingConfig) {
      // 기존 설정 업데이트
      config = await prisma.reviewConfig.update({
        where: { id: existingConfig.id },
        data: {
          placeName,
          placeId,
          placeUrl,
          isActive: true,
          updatedAt: new Date(),
        },
      })
    } else {
      // 새 설정 생성
      config = await prisma.reviewConfig.create({
        data: {
          clinicId,
          source,
          placeName,
          placeId,
          placeUrl,
          isActive: true,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: `${source} 리뷰 설정이 저장되었습니다`,
      config
    })
  } catch (error: any) {
    console.error("Review config error:", error)

    // Prisma 에러에 따른 구체적인 에러 메시지
    if (error.code === 'P2002') {
      return NextResponse.json({
        error: "이미 설정된 리뷰 소스입니다"
      }, { status: 409 })
    }

    if (error.code === 'P2003') {
      return NextResponse.json({
        error: "유효하지 않은 치과 ID입니다"
      }, { status: 400 })
    }

    return NextResponse.json({
      error: "리뷰 설정 저장 중 오류가 발생했습니다",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}

// 리뷰 설정 조회
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const clinicId = url.searchParams.get("clinicId")

    if (!clinicId) {
      return NextResponse.json({ error: "Missing clinicId" }, { status: 400 })
    }

    const configs = await prisma.reviewConfig.findMany({
      where: { clinicId },
      orderBy: { source: "asc" },
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error("Review config fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}