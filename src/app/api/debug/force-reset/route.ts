import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    console.log('🗑️ 강제 데이터 초기화 시작...')

    // 트랜잭션으로 모든 엑셀 업로드 관련 데이터 삭제
    const result = await prisma.$transaction(async (tx) => {
      // 1. PEI 보고서 삭제
      const deletedPei = await tx.peiReport.deleteMany({})
      console.log(`📊 PEI 보고서 ${deletedPei.count}개 삭제`)

      // 2. 월별 집계 삭제
      const deletedSummary = await tx.monthlySummary.deleteMany({})
      console.log(`📈 월별 집계 ${deletedSummary.count}개 삭제`)

      // 3. 접수 기록 삭제
      const deletedRecords = await tx.receptionRecord.deleteMany({})
      console.log(`🏥 접수 기록 ${deletedRecords.count}개 삭제`)

      // 4. 일별 장부 삭제
      const deletedDaily = await tx.dailyLedger.deleteMany({})
      console.log(`📅 일별 장부 ${deletedDaily.count}개 삭제`)

      // 5. 환자 통계 삭제
      const deletedPatients = await tx.patientStat.deleteMany({})
      console.log(`👥 환자 통계 ${deletedPatients.count}개 삭제`)

      // 6. 진료항목 통계 삭제
      const deletedTreatments = await tx.treatmentStat.deleteMany({})
      console.log(`💊 진료항목 ${deletedTreatments.count}개 삭제`)

      // 7. 내원경로 삭제
      const deletedRoutes = await tx.visitRoute.deleteMany({})
      console.log(`🛤️ 내원경로 ${deletedRoutes.count}개 삭제`)

      // 8. 치료계획 삭제
      const deletedPlans = await tx.treatmentPlan.deleteMany({})
      console.log(`📋 치료계획 ${deletedPlans.count}개 삭제`)

      // 9. 임플란트 통계 삭제
      const deletedImplants = await tx.implantStat.deleteMany({})
      console.log(`🦷 임플란트 ${deletedImplants.count}개 삭제`)

      // 10. 상담 통계 삭제
      const deletedConsult = await tx.consultationStat.deleteMany({})
      console.log(`💬 상담통계 ${deletedConsult.count}개 삭제`)

      // 11. 연령별 분포 삭제
      const deletedAge = await tx.ageDist.deleteMany({})
      console.log(`🎂 연령분포 ${deletedAge.count}개 삭제`)

      // 12. 지역별 분포 삭제
      const deletedRegion = await tx.regionDist.deleteMany({})
      console.log(`🗺️ 지역분포 ${deletedRegion.count}개 삭제`)

      // 13. 업로드 파일 정보 삭제
      const deletedFiles = await tx.fileUpload.deleteMany({})
      console.log(`📁 파일업로드 ${deletedFiles.count}개 삭제`)

      // 14. 업로드 로그 삭제
      const deletedLogs = await tx.uploadLog.deleteMany({})
      console.log(`📝 업로드로그 ${deletedLogs.count}개 삭제`)

      return {
        deletedPei: deletedPei.count,
        deletedSummary: deletedSummary.count,
        deletedRecords: deletedRecords.count,
        deletedDaily: deletedDaily.count,
        deletedPatients: deletedPatients.count,
        deletedTreatments: deletedTreatments.count,
        deletedRoutes: deletedRoutes.count,
        deletedPlans: deletedPlans.count,
        deletedImplants: deletedImplants.count,
        deletedConsult: deletedConsult.count,
        deletedAge: deletedAge.count,
        deletedRegion: deletedRegion.count,
        deletedFiles: deletedFiles.count,
        deletedLogs: deletedLogs.count
      }
    })

    // 삭제 후 상태 확인
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

    console.log('✅ 강제 데이터 초기화 완료!')

    return Response.json(`
<!DOCTYPE html>
<html>
<head>
<title>데이터 초기화 완료</title>
<style>
body { font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px; }
.success { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0; }
.before { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 15px; margin: 20px 0; }
.after { background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 5px; padding: 15px; margin: 20px 0; }
.btn { background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
</style>
</head>
<body>
<h1>🎉 데이터 초기화 완료!</h1>

<div class="success">
  <h3>✅ 삭제 완료</h3>
  <ul>
    <li>PEI 보고서: ${result.deletedPei}개</li>
    <li>월별 집계: ${result.deletedSummary}개</li>
    <li>접수 기록: ${result.deletedRecords}개</li>
    <li>일별 장부: ${result.deletedDaily}개</li>
    <li>환자 통계: ${result.deletedPatients}개</li>
    <li>진료항목: ${result.deletedTreatments}개</li>
    <li>내원경로: ${result.deletedRoutes}개</li>
    <li>치료계획: ${result.deletedPlans}개</li>
    <li>임플란트: ${result.deletedImplants}개</li>
    <li>상담통계: ${result.deletedConsult}개</li>
    <li>연령분포: ${result.deletedAge}개</li>
    <li>지역분포: ${result.deletedRegion}개</li>
    <li>파일업로드: ${result.deletedFiles}개</li>
    <li>업로드로그: ${result.deletedLogs}개</li>
  </ul>
</div>

<div class="after">
  <h3>📊 현재 상태 (완전 초기화 후)</h3>
  <ul>
    <li>PEI 보고서: ${peiCount}개</li>
    <li>월별 집계: ${summaryCount}개</li>
    <li>접수 기록: ${recordCount}개</li>
    <li>일별 장부: ${dailyCount}개</li>
    <li>환자 통계: ${patientCount}개</li>
    <li>진료항목: ${treatmentCount}개</li>
    <li>내원경로: ${routeCount}개</li>
    <li>치료계획: ${planCount}개</li>
    <li>임플란트: ${implantCount}개</li>
    <li>상담통계: ${consultCount}개</li>
    <li>연령분포: ${ageCount}개</li>
    <li>지역분포: ${regionCount}개</li>
    <li>파일업로드: ${fileCount}개</li>
    <li>업로드로그: ${logCount}개</li>
    <li><strong>목표 설정: ${goalCount}개 (보존됨)</strong></li>
  </ul>
</div>

<div style="margin-top: 30px;">
  <a href="/dashboard" class="btn">대시보드로 이동</a>
  <a href="/dashboard/clinic-1/upload" class="btn">엑셀 업로드</a>
</div>

<script>
console.log('완전 데이터 초기화 완료:', ${JSON.stringify({
  deleted: result,
  current: {
    peiCount, summaryCount, recordCount, goalCount,
    dailyCount, patientCount, treatmentCount, routeCount,
    planCount, implantCount, consultCount, ageCount,
    regionCount, fileCount, logCount
  }
})});
</script>

</body>
</html>
`, {
      headers: { 'Content-Type': 'text/html' }
    })

  } catch (error) {
    console.error('❌ 강제 초기화 실패:', error)
    return NextResponse.json({
      error: '데이터 초기화 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}