// 현재 데이터 상태 확인 스크립트
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDataStatus() {
  try {
    console.log('📊 현재 데이터 상태 확인...\n')

    // 모든 테이블의 데이터 개수 확인
    const [
      peiCount,
      summaryCount,
      recordCount,
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
      logCount,
      clinicCount,
      userCount
    ] = await Promise.all([
      prisma.peiReport.count(),
      prisma.monthlySummary.count(),
      prisma.receptionRecord.count(),
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
      prisma.uploadLog.count(),
      prisma.clinic.count(),
      prisma.user.count()
    ])

    console.log('📋 테이블별 데이터 개수:')
    console.log('=====================================')
    console.log(`🏥 클리닉: ${clinicCount}개`)
    console.log(`👤 사용자: ${userCount}개`)
    console.log(`📊 PEI보고서: ${peiCount}개`)
    console.log(`📈 월별집계: ${summaryCount}개`)
    console.log(`🏥 접수기록: ${recordCount}개`)
    console.log(`📅 일별장부: ${dailyCount}개`)
    console.log(`👥 환자통계: ${patientCount}개`)
    console.log(`💊 진료통계: ${treatmentCount}개`)
    console.log(`🛤️ 내원경로: ${routeCount}개`)
    console.log(`📋 치료계획: ${planCount}개`)
    console.log(`🦷 임플란트: ${implantCount}개`)
    console.log(`💬 상담통계: ${consultCount}개`)
    console.log(`🎂 연령분포: ${ageCount}개`)
    console.log(`🗺️ 지역분포: ${regionCount}개`)
    console.log(`📁 파일업로드: ${fileCount}개`)
    console.log(`📝 업로드로그: ${logCount}개`)

    // 총 데이터 개수
    const totalData = peiCount + summaryCount + recordCount + dailyCount +
                     patientCount + treatmentCount + routeCount + planCount +
                     implantCount + consultCount + ageCount + regionCount +
                     fileCount + logCount

    console.log(`\n📊 총 데이터 개수: ${totalData.toLocaleString()}개`)

    // ReceptionRecord 중복 확인 (같은 환자, 같은 날짜)
    if (recordCount > 0) {
      console.log('\n🔍 중복 데이터 확인...')

      const duplicateCheck = await prisma.receptionRecord.groupBy({
        by: ['clinicId', 'year', 'month', 'chartNumber', 'patientName'],
        _count: {
          id: true
        },
        having: {
          id: {
            _count: {
              gt: 1
            }
          }
        }
      })

      if (duplicateCheck.length > 0) {
        console.log(`🚨 중복 데이터 발견: ${duplicateCheck.length}개 그룹`)
        duplicateCheck.slice(0, 5).forEach((item, idx) => {
          console.log(`   ${idx + 1}. ${item.patientName} (${item.chartNumber}) - ${item._count.id}건 중복`)
        })
        if (duplicateCheck.length > 5) {
          console.log(`   ... 외 ${duplicateCheck.length - 5}개 더`)
        }
      } else {
        console.log('✅ 중복 데이터 없음')
      }
    }

    // 최근 업로드 기록 확인
    if (logCount > 0) {
      console.log('\n📝 최근 업로드 기록:')
      const recentLogs = await prisma.uploadLog.findMany({
        orderBy: {
          createdAt: 'desc'
        },
        take: 5,
        select: {
          id: true,
          filename: true,
          fileType: true,
          recordCount: true,
          createdAt: true
        }
      })

      recentLogs.forEach((log, idx) => {
        const date = log.createdAt.toLocaleDateString('ko-KR')
        const time = log.createdAt.toLocaleTimeString('ko-KR')
        console.log(`   ${idx + 1}. ${log.filename} (${log.fileType}) - ${log.recordCount}건 - ${date} ${time}`)
      })
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDataStatus()