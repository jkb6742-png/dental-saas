import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증 필요" }, { status: 401 })
    }

    const agencyId = (session.user as any).agencyId
    const role = (session.user as any).role
    const clinicId = (session.user as any).clinicId as string | null
    console.log(`[GET MY CLINICS] role: ${role}, agencyId: ${agencyId}, clinicId: ${clinicId}`)

    // MASTER는 에이전시 전체, 비마스터는 자신의 치과만
    const where =
      role === "MASTER" ? { agencyId } : { id: clinicId ?? "__none__" }

    const clinics = await prisma.clinic.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log(`[GET MY CLINICS] ${clinics.length}개 클리닉 조회됨`)

    return NextResponse.json({
      success: true,
      agencyId,
      clinics,
      count: clinics.length,
      message: `${clinics.length}개의 클리닉을 찾았습니다`
    })

  } catch (error) {
    console.error(`[GET MY CLINICS] 오류:`, error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}