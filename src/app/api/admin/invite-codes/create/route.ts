import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    // 마스터 계정만 접근 가능
    if (!session || (session.user as any).role !== 'MASTER') {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
    }

    const { clinicId, description, maxUses, expiresInMonths } = await req.json()

    if (!clinicId || !maxUses || !expiresInMonths) {
      return NextResponse.json({ error: "필수 정보가 누락되었습니다" }, { status: 400 })
    }

    // 치과 존재 확인
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      include: { agency: true }
    })

    if (!clinic) {
      return NextResponse.json({ error: "유효하지 않은 치과입니다" }, { status: 400 })
    }

    // 마스터 에이전시의 치과인지 확인
    if (clinic.agency.name !== "Master Agency") {
      return NextResponse.json({ error: "해당 치과에 대한 권한이 없습니다" }, { status: 400 })
    }

    // 고유한 코드 생성
    let code: string
    let attempts = 0
    const maxAttempts = 10

    do {
      attempts++
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      code = ''
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }

      const existing = await prisma.inviteCode.findUnique({
        where: { code }
      })

      if (!existing) break

      if (attempts >= maxAttempts) {
        return NextResponse.json({ error: "코드 생성에 실패했습니다" }, { status: 500 })
      }
    } while (true)

    // 만료일 계산 (개월 단위)
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + parseInt(expiresInMonths))

    // 초대 코드 생성
    const inviteCode = await prisma.inviteCode.create({
      data: {
        code,
        clinicId,
        createdBy: (session.user as any).id,
        maxUses: parseInt(maxUses),
        description: description || null,
        expiresAt,
        isActive: true,
      },
      include: {
        clinic: {
          include: {
            agency: true
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          }
        }
      }
    })

    // 보안 로그 기록
    await prisma.securityLog.create({
      data: {
        userId: (session.user as any).id,
        event: 'INVITE_CODE_CREATED',
        clinicId: clinicId,
        agencyId: clinic.agencyId,
        details: {
          code: code,
          clinicName: clinic.name,
          clinicCode: clinic.code,
          agencyName: clinic.agency.name,
          maxUses: parseInt(maxUses),
          expiresInMonths: parseInt(expiresInMonths),
          expiresAt: expiresAt.toISOString(),
          description: description,
          createdBy: (session.user as any).email,
        },
        severity: 'MEDIUM',
      }
    })

    return NextResponse.json({
      success: true,
      message: `초대 코드 ${code}가 생성되었습니다`,
      code: inviteCode
    })

  } catch (error) {
    console.error('초대 코드 생성 오류:', error)
    return NextResponse.json({ error: "코드 생성 중 오류가 발생했습니다" }, { status: 500 })
  }
}