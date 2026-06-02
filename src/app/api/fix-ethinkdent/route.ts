import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    console.log('🔥 [FIX_ETHINKDENT] 확실한 수정 시작')

    // 1단계: 평촌이생각치과 전용 에이전시 생성
    console.log('1단계: 에이전시 생성')
    const newAgency = await prisma.agency.create({
      data: {
        name: "평촌이생각치과 전용",
        slug: `pyeongchon-only-${Date.now()}`,
        plan: "ENTERPRISE" // 기존과 동일한 plan 사용
      }
    })
    console.log('생성된 에이전시:', newAgency)

    // 2단계: ethinkdent 사용자 이동
    console.log('2단계: 사용자 이동')
    const updatedUser = await prisma.user.update({
      where: {
        email: "ethinkdent@gmail.com"
      },
      data: {
        agencyId: newAgency.id
      }
    })
    console.log('업데이트된 사용자:', updatedUser)

    // 3단계: 평촌이생각치과 클리닉 이동
    console.log('3단계: 클리닉 이동')
    const updatedClinic = await prisma.clinic.update({
      where: {
        id: "cmpuvi39r0001xsug5vcq2emb" // 평촌이생각치과 ID
      },
      data: {
        agencyId: newAgency.id
      }
    })
    console.log('업데이트된 클리닉:', updatedClinic)

    // 4단계: 최종 확인
    console.log('4단계: 최종 확인')
    const finalUser = await prisma.user.findUnique({
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
      message: "ethinkdent 계정이 평촌이생각치과 전용으로 완전히 분리되었습니다!",
      steps: {
        step1_newAgency: newAgency,
        step2_updatedUser: updatedUser,
        step3_updatedClinic: updatedClinic,
        step4_finalResult: finalUser
      },
      finalState: {
        user: {
          name: finalUser?.name,
          email: finalUser?.email,
          agencyName: finalUser?.agency?.name,
          availableClinics: finalUser?.agency?.clinics?.map(c => c.name)
        }
      }
    })

  } catch (error) {
    console.error('[FIX_ETHINKDENT] 실패:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}