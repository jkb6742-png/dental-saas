import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { generateUniqueClinicCode, isValidClinicCode } from "@/lib/utils/clinicCodeGenerator"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const agencyId = (session.user as any).agencyId
  const role = (session.user as any).role
  const clinicId = (session.user as any).clinicId as string | null

  try {
    // MASTER는 에이전시 전체, 비마스터는 자신의 치과만
    const clinics = await prisma.clinic.findMany({
      where: role === "MASTER" ? { agencyId } : { id: clinicId ?? "__none__" },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(clinics)
  } catch (error) {
    console.error("Error fetching clinics:", error)
    return NextResponse.json({
      error: "치과 목록을 가져오는 중 오류가 발생했습니다."
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const agencyId = (session.user as any).agencyId
  const { name, code: providedCode } = await req.json()

  if (!name) {
    return NextResponse.json({ error: "치과 이름이 필요합니다" }, { status: 400 })
  }

  if (!agencyId) {
    return NextResponse.json({ error: "대행사 정보가 없습니다. 관리자에게 문의하세요." }, { status: 400 })
  }

  // Verify that the agency exists
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId }
  })

  if (!agency) {
    return NextResponse.json({ error: "존재하지 않는 대행사입니다. 관리자에게 문의하세요." }, { status: 400 })
  }

  let finalCode: string

  try {
    if (providedCode) {
      // Manual code provided - validate and check uniqueness
      const sanitizedCode = providedCode.toLowerCase().replace(/\s+/g, "-")

      if (!isValidClinicCode(sanitizedCode)) {
        return NextResponse.json({
          error: "유효하지 않은 코드 형식입니다. 한글, 영문, 숫자, 하이픈만 사용 가능합니다."
        }, { status: 400 })
      }

      // Check if code already exists in the agency
      const existingClinic = await prisma.clinic.findFirst({
        where: { agencyId, code: sanitizedCode },
      })

      if (existingClinic) {
        return NextResponse.json({
          error: "이미 사용 중인 코드입니다. 다른 코드를 선택해주세요."
        }, { status: 400 })
      }

      finalCode = sanitizedCode
    } else {
      // Auto-generate code from name
      finalCode = await generateUniqueClinicCode(agencyId, name)
    }

    const clinic = await prisma.clinic.create({
      data: {
        name: name.trim(),
        code: finalCode,
        agencyId
      },
    })

    return NextResponse.json(clinic)
  } catch (error) {
    console.error("Error creating clinic:", error)
    return NextResponse.json({
      error: "치과 생성 중 오류가 발생했습니다."
    }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  console.log('🗑️ [DELETE] 치과 삭제 요청 시작')

  try {
    const session = await auth()
    console.log('🔐 [DELETE] 세션 확인:', session ? '인증됨' : '인증 안됨')

    if (!session) {
      console.log('❌ [DELETE] 인증 실패')
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    console.log('👤 [DELETE] 사용자 권한:', userRole)

    // MASTER 권한만 치과 삭제 가능
    if (userRole !== 'MASTER') {
      console.log('❌ [DELETE] 권한 부족:', userRole)
      return NextResponse.json({ error: "치과 삭제 권한이 없습니다." }, { status: 403 })
    }

    const { clinicId } = await req.json()
    console.log('🏥 [DELETE] 삭제 요청 치과 ID:', clinicId)

    if (!clinicId) {
      console.log('❌ [DELETE] 치과 ID 누락')
      return NextResponse.json({ error: "치과 ID가 필요합니다." }, { status: 400 })
    }

    // 먼저 치과가 존재하는지 확인
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: {
        id: true,
        name: true,
        code: true
      }
    })

    if (!clinic) {
      return NextResponse.json({ error: "존재하지 않는 치과입니다." }, { status: 404 })
    }

    console.log(`치과 삭제 시도: ${clinic.name} (${clinic.code})`)

    // Prisma의 cascade 기능을 활용하여 clinic만 삭제
    // schema.prisma에서 onDelete: Cascade가 설정된 관계들이 자동으로 삭제됨
    await prisma.clinic.delete({
      where: { id: clinicId }
    })

    console.log(`✅ 치과 삭제 완료: ${clinic.name}`)

    return NextResponse.json({
      success: true,
      message: `치과 '${clinic.name}'가 성공적으로 삭제되었습니다.`,
      deletedClinic: clinic.name
    })

  } catch (error) {
    console.error("❌ [DELETE] 치과 삭제 오류:", error)
    return NextResponse.json({
      error: "치과 삭제 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
