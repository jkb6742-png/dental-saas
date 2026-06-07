import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 마스터 권한 확인
    const userRole = (session.user as any).role
    if (userRole !== 'MASTER') {
      return NextResponse.json({ error: '마스터 권한이 필요합니다' }, { status: 403 })
    }

    console.log('🗑️ 데이터 초기화 시작...')

    // 모든 엑셀 업로드 관련 데이터 삭제 (트랜잭션으로 안전하게)
    await prisma.$transaction(async (tx) => {
      // PEI 보고서 삭제
      const deletedPei = await tx.peiReport.deleteMany({})
      console.log(`📊 PEI 보고서 ${deletedPei.count}개 삭제`)

      // 월별 집계 데이터 삭제
      const deletedSummary = await tx.monthlySummary.deleteMany({})
      console.log(`📈 월별 집계 ${deletedSummary.count}개 삭제`)

      // 접수 기록 삭제
      const deletedRecords = await tx.receptionRecord.deleteMany({})
      console.log(`🏥 접수 기록 ${deletedRecords.count}개 삭제`)

      // 일별 장부 삭제
      const deletedDaily = await tx.dailyLedger.deleteMany({})
      console.log(`📅 일별 장부 ${deletedDaily.count}개 삭제`)

      // 환자 통계 삭제
      const deletedPatients = await tx.patientStat.deleteMany({})
      console.log(`👥 환자 통계 ${deletedPatients.count}개 삭제`)

      // 진료항목 통계 삭제
      const deletedTreatments = await tx.treatmentStat.deleteMany({})
      console.log(`💊 진료항목 ${deletedTreatments.count}개 삭제`)

      // 내원경로 삭제
      const deletedRoutes = await tx.visitRoute.deleteMany({})
      console.log(`🛤️ 내원경로 ${deletedRoutes.count}개 삭제`)

      // 치료계획 삭제
      const deletedPlans = await tx.treatmentPlan.deleteMany({})
      console.log(`📋 치료계획 ${deletedPlans.count}개 삭제`)

      // 임플란트 통계 삭제
      const deletedImplants = await tx.implantStat.deleteMany({})
      console.log(`🦷 임플란트 ${deletedImplants.count}개 삭제`)

      // 상담 통계 삭제
      const deletedConsult = await tx.consultationStat.deleteMany({})
      console.log(`💬 상담통계 ${deletedConsult.count}개 삭제`)

      // 연령별 분포 삭제
      const deletedAge = await tx.ageDist.deleteMany({})
      console.log(`🎂 연령분포 ${deletedAge.count}개 삭제`)

      // 지역별 분포 삭제
      const deletedRegion = await tx.regionDist.deleteMany({})
      console.log(`🗺️ 지역분포 ${deletedRegion.count}개 삭제`)

      // 업로드 파일 정보 삭제
      const deletedFiles = await tx.fileUpload.deleteMany({})
      console.log(`📁 파일업로드 ${deletedFiles.count}개 삭제`)

      // 업로드 로그 삭제
      const deletedLogs = await tx.uploadLog.deleteMany({})
      console.log(`📝 업로드로그 ${deletedLogs.count}개 삭제`)

      // 목표 데이터는 유지 (선택적)
      // const deletedGoals = await tx.revenueGoal.deleteMany({})
      // console.log(`🎯 목표 설정 ${deletedGoals.count}개 삭제`)
    })

    console.log('✅ 데이터 초기화 완료!')

    return NextResponse.json({
      success: true,
      message: '모든 엑셀 데이터가 삭제되었습니다. 새로운 데이터를 업로드할 수 있습니다.',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 데이터 초기화 실패:', error)
    return NextResponse.json({
      error: '데이터 초기화 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 현재 데이터 상태 확인 (모든 테이블)
    const [
      peiCount,
      summaryCount,
      recordCount,
      goalCount,
      dailyCount,
      patientCount,
      treatmentCount,
      routeCount,
      planCount,
      implantCount,
      consultCount,
      ageCount,
      regionCount,
      fileCount,
      logCount
    ] = await Promise.all([
      prisma.peiReport.count(),
      prisma.monthlySummary.count(),
      prisma.receptionRecord.count(),
      prisma.revenueGoal.count(),
      prisma.dailyLedger.count(),
      prisma.patientStat.count(),
      prisma.treatmentStat.count(),
      prisma.visitRoute.count(),
      prisma.treatmentPlan.count(),
      prisma.implantStat.count(),
      prisma.consultationStat.count(),
      prisma.ageDist.count(),
      prisma.regionDist.count(),
      prisma.fileUpload.count(),
      prisma.uploadLog.count()
    ])

    return NextResponse.json({
      currentData: {
        peiReports: peiCount,
        monthlySummaries: summaryCount,
        receptionRecords: recordCount,
        dailyLedgers: dailyCount,
        patientStats: patientCount,
        treatmentStats: treatmentCount,
        visitRoutes: routeCount,
        treatmentPlans: planCount,
        implantStats: implantCount,
        consultationStats: consultCount,
        ageDists: ageCount,
        regionDists: regionCount,
        fileUploads: fileCount,
        uploadLogs: logCount,
        revenueGoals: goalCount
      },
      totalDataRows: peiCount + summaryCount + recordCount + dailyCount + patientCount + treatmentCount + routeCount + planCount + implantCount + consultCount + ageCount + regionCount + fileCount + logCount,
      message: 'POST 요청으로 모든 엑셀 업로드 데이터를 삭제할 수 있습니다.'
    })

  } catch (error) {
    return NextResponse.json({
      error: '데이터 조회 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}