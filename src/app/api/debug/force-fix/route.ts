import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    console.log('🔧 [FORCE_FIX] 강제 수정 시작')

    // 1. 평촌이생각치과 전용 에이전시 생성
    const pyeongchonAgency = await prisma.agency.upsert({
      where: { slug: "pyeongchon-agency" },
      update: {},
      create: {
        name: "평촌이생각치과 에이전시",
        slug: "pyeongchon-agency",
        plan: "PROFESSIONAL"
      }
    })

    // 2. ethinkdent 사용자를 평촌이생각치과 에이전시로 이동
    const updatedUser = await prisma.user.update({
      where: { email: "ethinkdent@gmail.com" },
      data: { agencyId: pyeongchonAgency.id }
    })

    // 3. 평촌이생각치과를 전용 에이전시로 이동
    const updatedClinic = await prisma.clinic.update({
      where: { name: "평촌이생각치과" },
      data: { agencyId: pyeongchonAgency.id }
    })

    // 4. 결과 확인
    const finalCheck = await prisma.user.findUnique({
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
      message: "ethinkdent 계정이 평촌이생각치과 전용으로 수정되었습니다",
      result: {
        user: {
          name: updatedUser.name,
          email: updatedUser.email,
          newAgencyId: updatedUser.agencyId
        },
        agency: {
          name: pyeongchonAgency.name,
          clinics: finalCheck?.agency?.clinics?.map(c => ({
            id: c.id,
            name: c.name
          }))
        }
      }
    })

  } catch (error) {
    console.error('[FORCE_FIX] 강제 수정 실패:', error)
    return NextResponse.json({
      error: "강제 수정 실패",
      details: error.message
    }, { status: 500 })
  }
}