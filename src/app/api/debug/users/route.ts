import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        agencyId: true,
        createdAt: true,
        agency: {
          select: {
            name: true,
            slug: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20 // 최근 20개만
    })

    const agencies = await prisma.agency.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            clinics: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      users,
      agencies,
      totalUsers: users.length,
      totalAgencies: agencies.length
    })
  } catch (error) {
    console.error("Error fetching debug users:", error)
    return NextResponse.json({
      error: "사용자 정보를 가져오는 중 오류가 발생했습니다.",
      detail: error.message
    }, { status: 500 })
  }
}