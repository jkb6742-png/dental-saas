import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userRole = (session.user as any).role

    // 현재 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        agency: {
          include: {
            clinics: {
              orderBy: { createdAt: "asc" }
            }
          }
        }
      }
    })

    // 모든 에이전시와 치과 조회 (비교용)
    const allAgencies = await prisma.agency.findMany({
      include: {
        clinics: true,
        users: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json({
      currentUser: {
        id: user?.id,
        name: user?.name,
        email: user?.email,
        role: user?.role,
        agencyId: user?.agencyId,
        sessionInfo: {
          name: session.user?.name,
          email: session.user?.email,
          role: userRole,
          agencyId: (session.user as any).agencyId,
          agencyName: (session.user as any).agencyName
        }
      },
      userAgency: user?.agency,
      allAgencies: allAgencies
    })

  } catch (error) {
    console.error("사용자 정보 조회 실패:", error)
    return NextResponse.json({
      error: "조회 중 오류가 발생했습니다",
      details: error.message
    }, { status: 500 })
  }
}