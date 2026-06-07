// 완전한 데이터 정리 스크립트
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function completeCleanup() {
  try {
    console.log('🧹 완전한 데이터 정리 시작...\n')

    // 1. 먼저 현재 상태 확인
    const beforeRecord = await prisma.receptionRecord.count()
    const beforeFile = await prisma.fileUpload.count()
    console.log(`정리 전 - 접수기록: ${beforeRecord}개, 파일: ${beforeFile}개\n`)

    // 2. 트랜잭션으로 모든 데이터 완전 삭제
    console.log('🗑️ 모든 업로드 데이터 삭제 중...')

    const result = await prisma.$transaction(async (tx) => {
      // 모든 테이블 순서대로 삭제 (외래키 제약 고려)
      const results = {}

      results.peiReport = await tx.peiReport.deleteMany({})
      results.monthlySummary = await tx.monthlySummary.deleteMany({})
      results.receptionRecord = await tx.receptionRecord.deleteMany({})
      results.dailyLedger = await tx.dailyLedger.deleteMany({})
      results.patientStat = await tx.patientStat.deleteMany({})
      results.treatmentStat = await tx.treatmentStat.deleteMany({})
      results.visitRoute = await tx.visitRoute.deleteMany({})
      results.treatmentPlan = await tx.treatmentPlan.deleteMany({})
      results.implantStat = await tx.implantStat.deleteMany({})
      results.consultationStat = await tx.consultationStat.deleteMany({})
      results.ageDist = await tx.ageDist.deleteMany({})
      results.regionDist = await tx.regionDist.deleteMany({})
      results.fileUpload = await tx.fileUpload.deleteMany({})
      results.uploadLog = await tx.uploadLog.deleteMany({})

      return results
    })

    // 3. 삭제 결과 출력
    console.log('\n삭제된 데이터:')
    console.log('=====================================')
    console.log(`📊 PEI보고서: ${result.peiReport.count}개`)
    console.log(`📈 월별집계: ${result.monthlySummary.count}개`)
    console.log(`🏥 접수기록: ${result.receptionRecord.count}개`)
    console.log(`📅 일별장부: ${result.dailyLedger.count}개`)
    console.log(`👥 환자통계: ${result.patientStat.count}개`)
    console.log(`💊 진료통계: ${result.treatmentStat.count}개`)
    console.log(`🛤️ 내원경로: ${result.visitRoute.count}개`)
    console.log(`📋 치료계획: ${result.treatmentPlan.count}개`)
    console.log(`🦷 임플란트: ${result.implantStat.count}개`)
    console.log(`💬 상담통계: ${result.consultationStat.count}개`)
    console.log(`🎂 연령분포: ${result.ageDist.count}개`)
    console.log(`🗺️ 지역분포: ${result.regionDist.count}개`)
    console.log(`📁 파일업로드: ${result.fileUpload.count}개`)
    console.log(`📝 업로드로그: ${result.uploadLog.count}개`)

    const totalDeleted = Object.values(result).reduce((sum, item) => sum + item.count, 0)
    console.log(`\n🗑️ 총 삭제된 데이터: ${totalDeleted.toLocaleString()}개`)

    // 4. 정리 후 상태 확인
    const afterRecord = await prisma.receptionRecord.count()
    const afterFile = await prisma.fileUpload.count()
    console.log(`\n정리 후 - 접수기록: ${afterRecord}개, 파일: ${afterFile}개`)

    if (afterRecord === 0 && afterFile === 0) {
      console.log('\n✅ 데이터 정리 완료! 모든 데이터가 삭제되었습니다.')
      console.log('🎉 이제 새로운 파일을 업로드할 수 있습니다.')
    } else {
      console.log('\n⚠️ 일부 데이터가 남아있을 수 있습니다.')
    }

  } catch (error) {
    console.error('❌ 데이터 정리 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

completeCleanup()