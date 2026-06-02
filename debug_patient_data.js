const { PrismaClient } = require('@prisma/client')

async function checkPatientData() {
  const prisma = new PrismaClient()

  try {
    console.log('=== 환자 데이터 확인 ===')

    // 1. PatientStat 테이블 데이터 확인
    const patientStats = await prisma.patientStat.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { date: 'desc' }],
      take: 10
    })

    console.log('\n📊 PatientStat 테이블 (최근 10개):')
    console.log('총 개수:', await prisma.patientStat.count())
    patientStats.forEach((stat, index) => {
      console.log(`${index + 1}. ${stat.year}년 ${stat.month}월 ${new Date(stat.date).getDate()}일`)
      console.log(`   신환: ${stat.newPatients}, 총방문: ${stat.totalVisits}, 예약: ${stat.totalAppointments}`)
      console.log(`   일평균신환: ${stat.avgDailyNewPatients}, 근무일: ${stat.workingDays}`)
      console.log(`   clinicId: ${stat.clinicId}`)
    })

    // 2. MonthlySummary 테이블 데이터 확인
    const monthlySummaries = await prisma.monthlySummary.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 5
    })

    console.log('\n📈 MonthlySummary 테이블 (최근 5개):')
    console.log('총 개수:', await prisma.monthlySummary.count())
    monthlySummaries.forEach((summary, index) => {
      console.log(`${index + 1}. ${summary.year}년 ${summary.month}월`)
      console.log(`   신환: ${summary.newPatients}, 총환자: ${summary.totalPatients}`)
      console.log(`   신환수익: ${summary.newPatientRevenue}, 총수익: ${summary.totalRevenue}`)
      console.log(`   clinicId: ${summary.clinicId}`)
    })

    // 3. Clinic 정보 확인
    const clinics = await prisma.clinic.findMany({
      select: { id: true, name: true, code: true }
    })

    console.log('\n🏥 Clinic 목록:')
    clinics.forEach(clinic => {
      console.log(`ID: ${clinic.id}, 이름: ${clinic.name}, 코드: ${clinic.code}`)
    })

    // 4. 특정 clinic의 데이터 확인
    if (clinics.length > 0) {
      const firstClinicId = clinics[0].id
      console.log(`\n🔍 첫 번째 클리닉 (${firstClinicId}) 상세 데이터:`)

      const clinicPatientStats = await prisma.patientStat.findMany({
        where: { clinicId: firstClinicId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { date: 'desc' }],
        take: 5
      })

      console.log('PatientStat 개수:', clinicPatientStats.length)
      clinicPatientStats.forEach(stat => {
        console.log(`  ${stat.date} - 신환: ${stat.newPatients}`)
      })

      const clinicSummaries = await prisma.monthlySummary.findMany({
        where: { clinicId: firstClinicId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 3
      })

      console.log('MonthlySummary 개수:', clinicSummaries.length)
      clinicSummaries.forEach(summary => {
        console.log(`  ${summary.year}년 ${summary.month}월 - 신환: ${summary.newPatients}`)
      })
    }

  } catch (error) {
    console.error('데이터 확인 중 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPatientData()