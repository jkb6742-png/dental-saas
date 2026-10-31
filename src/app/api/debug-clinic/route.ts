import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  console.log(`[DEBUG CLINIC] 클리닉 디버깅 시작`)

  try {
    const url = new URL(req.url)
    const clinicId = url.searchParams.get('clinicId')

    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증 필요" }, { status: 401 })
    }

    const agencyId = (session.user as any).agencyId
    console.log(`[DEBUG CLINIC] 사용자 agencyId: ${agencyId}`)

    if (clinicId) {
      // 특정 클리닉 정보 조회
      const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        include: { agency: { select: { id: true, name: true, slug: true } } }
      })

      console.log(`[DEBUG CLINIC] 클리닉 정보:`, clinic)

      return NextResponse.json({
        success: true,
        clinicId,
        userAgencyId: agencyId,
        clinic: clinic ? {
          id: clinic.id,
          name: clinic.name,
          agencyId: clinic.agencyId,
          agencyName: clinic.agency.name,
          matches: clinic.agencyId === agencyId
        } : null,
        message: clinic
          ? `클리닉 ${clinic.name}은 ${clinic.agency.name} 소속입니다`
          : "클리닉을 찾을 수 없습니다"
      })
    } else {
      // 사용자 agency의 모든 클리닉 조회
      const userClinics = await prisma.clinic.findMany({
        where: { agencyId },
        select: { id: true, name: true }
      })

      console.log(`[DEBUG CLINIC] 사용자 클리닉들:`, userClinics)

      return NextResponse.json({
        success: true,
        userAgencyId: agencyId,
        availableClinics: userClinics,
        message: `${userClinics.length}개의 클리닉을 찾았습니다`
      })
    }

  } catch (error) {
    console.error(`[DEBUG CLINIC] 오류:`, error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}