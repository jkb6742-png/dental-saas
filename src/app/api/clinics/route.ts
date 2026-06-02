import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { generateUniqueClinicCode, isValidClinicCode } from "@/lib/utils/clinicCodeGenerator"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const agencyId = (session.user as any).agencyId

  try {
    const clinics = await prisma.clinic.findMany({
      where: { agencyId },
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
