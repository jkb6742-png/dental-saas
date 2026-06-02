import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    console.log("🔍 리뷰 시스템 디버깅 시작...")

    // 1. 인증 확인
    const session = await auth()
    console.log("👤 세션 상태:", !!session, session?.user?.email)

    if (!session) {
      return NextResponse.json({ error: "인증되지 않음" }, { status: 401 })
    }

    // 2. 사용자의 clinicId 확인
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email || "" },
      include: {
        agency: {
          include: {
            clinics: true
          }
        }
      }
    })

    console.log("🏥 사용자 정보:", {
      userId: user?.id,
      email: user?.email,
      agencyId: user?.agencyId,
      clinics: user?.agency?.clinics?.map(c => ({ id: c.id, name: c.name }))
    })

    if (!user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없음" }, { status: 404 })
    }

    // 3. 첫 번째 clinic을 사용해서 테스트
    const clinic = user.agency?.clinics?.[0]
    if (!clinic) {
      return NextResponse.json({ error: "치과가 없음" }, { status: 404 })
    }

    console.log("🏥 선택된 치과:", { id: clinic.id, name: clinic.name })

    // 4. ReviewConfig 테이블 확인
    const existingConfigs = await prisma.reviewConfig.findMany({
      where: { clinicId: clinic.id }
    })

    console.log("⚙️ 기존 리뷰 설정:", existingConfigs)

    // 5. 테스트 설정 생성 시도
    const testConfig = {
      clinicId: clinic.id,
      source: "NAVER" as const,
      placeName: "테스트치과",
      placeUrl: "https://map.naver.com/p/test"
    }

    console.log("🧪 테스트 설정 데이터:", testConfig)

    // 먼저 기존 설정 확인
    const existing = await prisma.reviewConfig.findFirst({
      where: {
        clinicId: testConfig.clinicId,
        source: testConfig.source
      }
    })

    console.log("📋 기존 테스트 설정:", existing)

    return NextResponse.json({
      success: true,
      debug: {
        session: !!session,
        userEmail: session.user?.email,
        userId: user.id,
        clinic: { id: clinic.id, name: clinic.name },
        existingConfigs: existingConfigs.length,
        testConfig,
        existingTestConfig: existing
      }
    })

  } catch (error: any) {
    console.error("❌ 디버깅 에러:", error)
    return NextResponse.json({
      error: "디버깅 중 오류 발생",
      details: error.message,
      code: error.code
    }, { status: 500 })
  }
}