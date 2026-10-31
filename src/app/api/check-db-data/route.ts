import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    console.log(`🔍 [CHECK-DB] 데이터베이스 데이터 확인 시작`)

    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "로그인 필요" }, { status: 401 })
    }

    const url = new URL(req.url)
    const clinicId = url.searchParams.get('clinicId')

    if (!clinicId) {
      return NextResponse.json({ error: "clinicId 필요" }, { status: 400 })
    }

    console.log(`🔍 클리닉 ${clinicId} 데이터 확인 중...`)

    // 각 테이블별 데이터 개수 확인
    const tableCounts = await Promise.all([
      prisma.dailyLedger.count({ where: { clinicId } }),
      prisma.patientStat.count({ where: { clinicId } }),
      prisma.treatmentStat.count({ where: { clinicId } }),
      prisma.visitRoute.count({ where: { clinicId } }),
      prisma.receptionRecord.count({ where: { clinicId } }),
      prisma.ageDist.count({ where: { clinicId } }),
      prisma.regionDist.count({ where: { clinicId } }),
      prisma.implantStat.count({ where: { clinicId } }),
      prisma.consultationStat.count({ where: { clinicId } }),
      prisma.treatmentPlan.count({ where: { clinicId } }),
      prisma.fileUpload.count({ where: { clinicId } })
    ])

    const [
      dailyLedgers,
      patientStats,
      treatmentStats,
      visitRoutes,
      receptionRecords,
      ageDistributions,
      regionDistributions,
      implantStats,
      consultationStats,
      treatmentPlans,
      fileUploads
    ] = tableCounts

    const totalRecords = tableCounts.reduce((sum, count) => sum + count, 0)

    // 최근 업로드된 파일들
    const recentFiles = await prisma.fileUpload.findMany({
      where: { clinicId },
      orderBy: { uploadedAt: 'desc' },
      take: 5,
      select: {
        fileName: true,
        category: true,
        status: true,
        recordCount: true,
        uploadedAt: true
      }
    })

    // 최근 데이터 생성/수정 시간 확인
    const recentDataCheck = await Promise.all([
      prisma.dailyLedger.findFirst({
        where: { clinicId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      }),
      prisma.receptionRecord.findFirst({
        where: { clinicId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      })
    ])

    const result = {
      success: true,
      clinicId,
      totalRecords,
      tableDetails: {
        dailyLedgers: `${dailyLedgers}개`,
        patientStats: `${patientStats}개`,
        treatmentStats: `${treatmentStats}개`,
        visitRoutes: `${visitRoutes}개`,
        receptionRecords: `${receptionRecords}개`,
        ageDistributions: `${ageDistributions}개`,
        regionDistributions: `${regionDistributions}개`,
        implantStats: `${implantStats}개`,
        consultationStats: `${consultationStats}개`,
        treatmentPlans: `${treatmentPlans}개`,
        fileUploads: `${fileUploads}개`
      },
      recentFiles,
      lastDataUpdate: {
        dailyLedger: recentDataCheck[0]?.createdAt || null,
        receptionRecord: recentDataCheck[1]?.createdAt || null
      }
    }

    console.log(`🔍 [CHECK-DB] 결과:`, result)

    return NextResponse.json(result)

  } catch (error) {
    console.error(`🔍 [CHECK-DB] 오류:`, error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}