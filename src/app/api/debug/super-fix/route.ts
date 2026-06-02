import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    // ethinkdent 사용자 정보 확인
    const user = await prisma.user.findUnique({
      where: { email: "ethinkdent@gmail.com" },
      include: {
        agency: {
          include: {
            clinics: true
          }
        }
      }
    })

    return NextResponse.json({
      user: {
        id: user?.id,
        name: user?.name,
        email: user?.email,
        agencyId: user?.agencyId,
        agency: {
          id: user?.agency?.id,
          name: user?.agency?.name,
          clinics: user?.agency?.clinics?.map(c => ({
            id: c.id,
            name: c.name
          }))
        }
      }
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('🔥 [SUPER_FIX] 슈퍼 강력 수정 시작')

    // 1. 모든 관련 데이터 삭제 후 재생성
    await prisma.$transaction(async (tx) => {
      // 평촌이생각치과 전용 에이전시 생성/업데이트
      const pyeongchonAgency = await tx.agency.upsert({
        where: { name: "평촌이생각치과 에이전시" },
        update: {},
        create: {
          name: "평촌이생각치과 에이전시",
          slug: `pyeongchon-${Date.now()}`,
          plan: "PROFESSIONAL"
        }
      })

      // ethinkdent 사용자 강제 업데이트
      await tx.user.updateMany({
        where: { email: "ethinkdent@gmail.com" },
        data: {
          agencyId: pyeongchonAgency.id,
          updatedAt: new Date() // 강제 업데이트 시간 변경
        }
      })

      // 평촌이생각치과 클리닉 강제 업데이트
      await tx.clinic.updateMany({
        where: {
          OR: [
            { name: "평촌이생각치과" },
            { name: { contains: "평촌" } },
            { code: { contains: "평촌" } }
          ]
        },
        data: {
          agencyId: pyeongchonAgency.id,
          updatedAt: new Date()
        }
      })
    })

    // 2. 결과 확인
    const updatedUser = await prisma.user.findUnique({
      where: { email: "ethinkdent@gmail.com" },
      include: {
        agency: {
          include: {
            clinics: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: "슈퍼 강력 수정 완료",
      timestamp: new Date().toISOString(),
      result: updatedUser
    })

  } catch (error) {
    console.error('[SUPER_FIX] 실패:', error)
    return NextResponse.json({
      error: "슈퍼 수정 실패",
      details: error.message
    }, { status: 500 })
  }
}