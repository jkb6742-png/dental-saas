const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkData() {
  try {
    console.log('=== ReceptionRecord 테이블 확인 ===')

    // 전체 레코드 수
    const totalCount = await prisma.receptionRecord.count()
    console.log(`전체 ReceptionRecord 수: ${totalCount}`)

    if (totalCount === 0) {
      console.log('❌ ReceptionRecord 테이블이 비어있습니다!')
      return
    }

    // 2026년 5월 데이터 확인
    const may2026Count = await prisma.receptionRecord.count({
      where: {
        receptionTime: {
          gte: new Date(2026, 4, 1), // 2026년 5월 1일
          lt: new Date(2026, 5, 1)   // 2026년 6월 1일
        }
      }
    })
    console.log(`2026년 5월 레코드 수: ${may2026Count}`)

    // 최근 10개 레코드 확인
    const recentRecords = await prisma.receptionRecord.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        receptionTime: true,
        patientType: true,
        totalRevenue: true,
        clinicId: true
      }
    })

    console.log('\n=== 최근 10개 레코드 ===')
    recentRecords.forEach((record, index) => {
      console.log(`${index + 1}. ${record.receptionTime.toISOString().slice(0, 10)} | ${record.patientType} | ${record.totalRevenue?.toLocaleString()}원 | Clinic: ${record.clinicId}`)
    })

    // 2026년 5월 데이터가 있다면 상세 확인
    if (may2026Count > 0) {
      const may2026Data = await prisma.receptionRecord.findMany({
        where: {
          receptionTime: {
            gte: new Date(2026, 4, 1),
            lt: new Date(2026, 5, 1)
          }
        },
        select: {
          receptionTime: true,
          patientType: true,
          totalRevenue: true,
          clinicId: true
        }
      })

      const totalRevenue = may2026Data.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)
      const newPatients = may2026Data.filter(r => r.patientType === '신환').length
      const newPatientRevenue = may2026Data
        .filter(r => r.patientType === '신환')
        .reduce((sum, r) => sum + (r.totalRevenue || 0), 0)

      console.log('\n=== 2026년 5월 통계 ===')
      console.log(`총 매출: ${totalRevenue.toLocaleString()}원`)
      console.log(`신환 수: ${newPatients}명`)
      console.log(`신환 매출: ${newPatientRevenue.toLocaleString()}원`)
      console.log(`신환 객단가: ${newPatients > 0 ? Math.round(newPatientRevenue / newPatients).toLocaleString() : 0}원`)
    }

  } catch (error) {
    console.error('데이터 확인 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkData()