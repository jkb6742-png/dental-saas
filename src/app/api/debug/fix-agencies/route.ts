import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || (session.user as any).role !== 'MASTER') {
      return NextResponse.json({ error: "마스터 권한이 필요합니다" }, { status: 401 })
    }

    console.log('🔧 [FIX_AGENCIES] 에이전시 구조 수정 시작')

    // 1. 평촌이생각치과 전용 에이전시 생성
    const pyeongchonAgency = await prisma.agency.create({
      data: {
        name: "평촌이생각치과",
        slug: `pyeongchon-agency-${Date.now()}`,
        plan: "PROFESSIONAL"
      }
    })

    // 2. 중산사과나무치과 전용 에이전시 생성
    const jungsanAgency = await prisma.agency.create({
      data: {
        name: "중산사과나무치과",
        slug: `jungsan-agency-${Date.now()}`,
        plan: "PROFESSIONAL"
      }
    })

    // 3. 평촌이생각치과를 전용 에이전시로 이동
    await prisma.clinic.update({
      where: { id: "cmpuvi39r0001xsug5vcq2emb" }, // 평촌이생각치과 ID
      data: { agencyId: pyeongchonAgency.id }
    })

    // 4. 중산사과나무치과를 전용 에이전시로 이동
    await prisma.clinic.update({
      where: { id: "cmpuvhwyh0000xsugygix3zmo" }, // 중산사과나무치과 ID
      data: { agencyId: jungsanAgency.id }
    })

    // 5. ethinkdent 사용자를 평촌이생각치과 에이전시로 이동
    await prisma.user.update({
      where: { id: "cmpuxakgs0003qwugm4q36xf4" }, // ethinkdent 사용자 ID
      data: { agencyId: pyeongchonAgency.id }
    })

    // 6. PEI 시트 설정도 함께 업데이트 (있다면)
    const peiSheetConfigs = await prisma.peiSheetConfig.findMany({
      where: {
        OR: [
          { clinicId: "cmpuvi39r0001xsug5vcq2emb" },
          { clinicId: "cmpuvhwyh0000xsugygix3zmo" }
        ]
      }
    })

    console.log('🔧 [FIX_AGENCIES] PEI 설정 발견:', peiSheetConfigs.length + '개')

    // 7. 결과 확인
    const updatedPyeongchonClinic = await prisma.clinic.findUnique({
      where: { id: "cmpuvi39r0001xsug5vcq2emb" },
      include: { agency: true }
    })

    const updatedEthinkdentUser = await prisma.user.findUnique({
      where: { id: "cmpuxakgs0003qwugm4q36xf4" },
      include: { agency: { include: { clinics: true } } }
    })

    return NextResponse.json({
      success: true,
      message: "에이전시 구조가 성공적으로 수정되었습니다",
      result: {
        pyeongchonAgency: {
          id: pyeongchonAgency.id,
          name: pyeongchonAgency.name
        },
        jungsanAgency: {
          id: jungsanAgency.id,
          name: jungsanAgency.name
        },
        updatedClinic: updatedPyeongchonClinic,
        updatedUser: updatedEthinkdentUser,
        peiConfigs: peiSheetConfigs.length
      }
    })

  } catch (error) {
    console.error('[FIX_AGENCIES] 수정 실패:', error)
    return NextResponse.json({
      error: "에이전시 구조 수정 실패",
      details: error.message
    }, { status: 500 })
  }
}