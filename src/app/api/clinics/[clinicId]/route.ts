import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

// 개별 치과 삭제를 위한 별도 엔드포인트
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ clinicId: string }> }) {
  console.log('🗑️ [DELETE] 치과 삭제 요청 시작')

  try {
    const { clinicId } = await params
    console.log('🏥 [DELETE] 삭제 요청 치과 ID:', clinicId)

    const session = await auth()
    console.log('🔐 [DELETE] 세션 확인:', session ? '인증됨' : '인증 안됨')

    if (!session) {
      console.log('❌ [DELETE] 인증 실패')
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
    }

    const userRole = (session.user as any).role
    console.log('👤 [DELETE] 사용자 권한:', userRole)

    // MASTER 권한만 치과 삭제 가능
    if (userRole !== 'MASTER') {
      console.log('❌ [DELETE] 권한 부족:', userRole)
      return NextResponse.json({ error: "치과 삭제 권한이 없습니다." }, { status: 403 })
    }

    if (!clinicId) {
      console.log('❌ [DELETE] 치과 ID 누락')
      return NextResponse.json({ error: "치과 ID가 필요합니다." }, { status: 400 })
    }

    // 치과 존재 확인
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: {
        id: true,
        name: true,
        code: true
      }
    })

    console.log('🔍 [DELETE] 치과 확인:', clinic ? `${clinic.name} (${clinic.code})` : '존재하지 않음')

    if (!clinic) {
      return NextResponse.json({ error: "존재하지 않는 치과입니다." }, { status: 404 })
    }

    console.log(`🗑️ [DELETE] 치과 삭제 시작: ${clinic.name}`)

    // 치과 삭제 (Cascade로 관련 데이터 자동 삭제)
    await prisma.clinic.delete({
      where: { id: clinicId }
    })

    console.log(`✅ [DELETE] 치과 삭제 완료: ${clinic.name}`)

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