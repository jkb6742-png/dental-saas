import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

// 마스터가 월별 현금매출을 입력/수정. 총매출에 가산됨.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
  }
  if ((session.user as any).role !== "MASTER") {
    return NextResponse.json({ error: "마스터 권한이 필요합니다." }, { status: 403 })
  }

  const { clinicId, year, month, amount } = await req.json().catch(() => ({}))
  if (!clinicId || !year || !month || amount == null) {
    return NextResponse.json({ error: "필수값이 누락되었습니다." }, { status: 400 })
  }
  const amt = Number(amount)
  if (Number.isNaN(amt) || amt < 0) {
    return NextResponse.json({ error: "금액이 올바르지 않습니다." }, { status: 400 })
  }

  // 치과가 마스터의 에이전시 소속인지 확인
  const clinic = await prisma.clinic.findFirst({
    where: { id: clinicId, agencyId: (session.user as any).agencyId },
    select: { id: true },
  })
  if (!clinic) {
    return NextResponse.json({ error: "치과를 찾을 수 없습니다." }, { status: 404 })
  }

  const saved = await prisma.cashRevenue.upsert({
    where: { clinicId_year_month: { clinicId, year: Number(year), month: Number(month) } },
    update: { amount: amt },
    create: { clinicId, year: Number(year), month: Number(month), amount: amt },
  })

  return NextResponse.json({ success: true, amount: saved.amount })
}
