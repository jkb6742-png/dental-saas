const { PrismaClient } = require('@prisma/client')

async function migrateToNewStructure() {
  const prisma = new PrismaClient()

  try {
    console.log('🚀 새로운 6개 카테고리 구조로 데이터 마이그레이션 시작...\n')

    const clinicId = await getFirstClinicId(prisma)
    if (!clinicId) {
      console.error('❌ 클리닉 ID를 찾을 수 없습니다.')
      return
    }

    console.log(`📋 클리닉 ID: ${clinicId}\n`)

    // 1. 💰 매출 데이터 마이그레이션
    await migrateRevenueData(prisma, clinicId)

    // 2. 👥 환자정보 데이터 마이그레이션
    await migratePatientData(prisma, clinicId)

    // 3. 🦷 진료별 데이터 마이그레이션
    await migrateTreatmentData(prisma, clinicId)

    // 4. 🛣️ 내원경로 데이터 마이그레이션
    await migrateVisitRouteData(prisma, clinicId)

    // 5. 📍 지역별 데이터 마이그레이션
    await migrateRegionData(prisma, clinicId)

    // 6. 👶👴 연령 데이터 마이그레이션
    await migrateAgeData(prisma, clinicId)

    console.log('\n✅ 모든 데이터 마이그레이션 완료!')

  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

async function getFirstClinicId(prisma) {
  const clinic = await prisma.clinic.findFirst()
  return clinic?.id
}

// 1. 💰 매출 데이터 마이그레이션 (DailyLedger → Revenue)
async function migrateRevenueData(prisma, clinicId) {
  console.log('💰 매출 데이터 마이그레이션 중...')

  // 기존 Revenue 테이블 초기화
  await prisma.revenue.deleteMany({ where: { clinicId } })

  const dailyLedgers = await prisma.dailyLedger.findMany({
    where: { clinicId },
    orderBy: [{ year: 'asc' }, { month: 'asc' }, { date: 'asc' }]
  })

  let migratedCount = 0

  for (const ledger of dailyLedgers) {
    const totalIncome = (ledger.cashIncome || 0) + (ledger.cardIncome || 0) + (ledger.onlineIncome || 0)
    const totalExpense = (ledger.cashExpense || 0) + (ledger.cardExpense || 0)
    const netProfit = totalIncome - totalExpense

    await prisma.revenue.create({
      data: {
        clinicId,
        date: ledger.date,
        year: ledger.year,
        month: ledger.month,
        day: ledger.date.getDate(),
        cashIncome: ledger.cashIncome || 0,
        cardIncome: ledger.cardIncome || 0,
        onlineIncome: ledger.onlineIncome || 0,
        totalIncome,
        totalExpense,
        netProfit
      }
    })

    migratedCount++
  }

  console.log(`   ✅ ${migratedCount}개 일별 매출 데이터 마이그레이션 완료`)
}

// 2. 👥 환자정보 데이터 마이그레이션 (ReceptionRecord → PatientInfo)
async function migratePatientData(prisma, clinicId) {
  console.log('👥 환자정보 데이터 마이그레이션 중...')

  // 기존 PatientInfo 테이블 초기화
  await prisma.patientInfo.deleteMany({ where: { clinicId } })

  const receptionRecords = await prisma.receptionRecord.findMany({
    where: { clinicId },
    orderBy: [{ year: 'asc' }, { month: 'asc' }, { receptionTime: 'asc' }]
  })

  let migratedCount = 0

  for (const record of receptionRecords) {
    // 연령 그룹 계산
    const ageGroup = calculateAgeGroup(record.ageGender)

    // 성별 추출
    const gender = extractGender(record.ageGender)

    // 방문 시간 추출
    const visitTime = record.receptionTime ?
      `${record.receptionTime.getHours().toString().padStart(2, '0')}:${record.receptionTime.getMinutes().toString().padStart(2, '0')}`
      : null

    await prisma.patientInfo.create({
      data: {
        clinicId,
        chartNumber: record.chartNumber || '',
        name: record.patientName || '',
        age: extractAge(record.ageGender),
        gender,
        region: record.visitRoute || '', // 임시로 visitRoute를 region으로 사용
        visitRoute: record.visitRoute || '',
        visitDate: record.receptionTime || new Date(),
        visitTime,
        receptionTime: record.receptionTime,
        visitType: record.patientType || '',
        ageGroup,
        waitingTime: record.waitingTime || 0,
        revenue: record.totalRevenue || 0,
        treatmentType: '일반진료', // 기본값
        year: record.year,
        month: record.month,
        day: record.receptionTime?.getDate() || 1
      }
    })

    migratedCount++
  }

  console.log(`   ✅ ${migratedCount}개 환자정보 데이터 마이그레이션 완료`)
}

// 3. 🦷 진료별 데이터 마이그레이션 (기본 데이터 생성)
async function migrateTreatmentData(prisma, clinicId) {
  console.log('🦷 진료별 데이터 마이그레이션 중...')

  // 기존 TreatmentData 테이블 초기화
  await prisma.treatmentData.deleteMany({ where: { clinicId } })

  // PatientInfo에서 월별 진료별 집계 생성
  const months = [1, 2, 3, 4, 5] // 2026년 1-5월

  for (const month of months) {
    const patientInfos = await prisma.patientInfo.findMany({
      where: { clinicId, year: 2026, month }
    })

    // 진료 타입별 그룹화 (기본적으로 '일반진료'로 설정)
    const treatmentTypes = ['일반진료', '임플란트', '보철', '교정']

    for (const treatmentType of treatmentTypes) {
      const treatmentPatients = patientInfos // 모든 환자를 일반진료로 분류

      if (treatmentPatients.length > 0) {
        const totalRevenue = treatmentPatients.reduce((sum, p) => sum + (p.revenue || 0), 0)
        const avgRevenue = totalRevenue / treatmentPatients.length

        await prisma.treatmentData.create({
          data: {
            clinicId,
            treatmentType,
            year: 2026,
            month,
            patientCount: treatmentType === '일반진료' ? treatmentPatients.length : 0,
            totalRevenue: treatmentType === '일반진료' ? totalRevenue : 0,
            avgRevenue: treatmentType === '일반진료' ? avgRevenue : 0
          }
        })
      }
    }
  }

  console.log(`   ✅ 진료별 데이터 마이그레이션 완료`)
}

// 4. 🛣️ 내원경로 데이터 마이그레이션
async function migrateVisitRouteData(prisma, clinicId) {
  console.log('🛣️ 내원경로 데이터 마이그레이션 중...')

  // 기존 VisitRouteData 테이블 초기화
  await prisma.visitRouteData.deleteMany({ where: { clinicId } })

  const months = [1, 2, 3, 4, 5]

  for (const month of months) {
    const patientInfos = await prisma.patientInfo.findMany({
      where: { clinicId, year: 2026, month }
    })

    // 내원경로별 그룹화
    const routeGroups = {}
    patientInfos.forEach(patient => {
      const route = patient.visitRoute || '기타'
      if (!routeGroups[route]) {
        routeGroups[route] = { new: 0, returning: 0, revenue: 0 }
      }

      if (patient.visitType === '신환') {
        routeGroups[route].new++
      } else {
        routeGroups[route].returning++
      }
      routeGroups[route].revenue += patient.revenue || 0
    })

    // 내원경로별 데이터 저장
    for (const [routeName, data] of Object.entries(routeGroups)) {
      await prisma.visitRouteData.create({
        data: {
          clinicId,
          routeName,
          year: 2026,
          month,
          newPatients: data.new,
          returningPatients: data.returning,
          totalRevenue: data.revenue
        }
      })
    }
  }

  console.log(`   ✅ 내원경로 데이터 마이그레이션 완료`)
}

// 5. 📍 지역별 데이터 마이그레이션
async function migrateRegionData(prisma, clinicId) {
  console.log('📍 지역별 데이터 마이그레이션 중...')

  // 기존 RegionData 테이블 초기화
  await prisma.regionData.deleteMany({ where: { clinicId } })

  const months = [1, 2, 3, 4, 5]

  for (const month of months) {
    const patientInfos = await prisma.patientInfo.findMany({
      where: { clinicId, year: 2026, month }
    })

    const totalPatients = patientInfos.length

    // 지역별 그룹화
    const regionGroups = {}
    patientInfos.forEach(patient => {
      const region = patient.region || '기타'
      regionGroups[region] = (regionGroups[region] || 0) + 1
    })

    // 지역별 데이터 저장
    for (const [region, count] of Object.entries(regionGroups)) {
      const percentage = totalPatients > 0 ? (count / totalPatients) * 100 : 0

      await prisma.regionData.create({
        data: {
          clinicId,
          region,
          year: 2026,
          month,
          patientCount: count,
          percentage
        }
      })
    }
  }

  console.log(`   ✅ 지역별 데이터 마이그레이션 완료`)
}

// 6. 👶👴 연령 데이터 마이그레이션
async function migrateAgeData(prisma, clinicId) {
  console.log('👶👴 연령 데이터 마이그레이션 중...')

  // 기존 AgeData 테이블 초기화
  await prisma.ageData.deleteMany({ where: { clinicId } })

  const months = [1, 2, 3, 4, 5]

  for (const month of months) {
    const patientInfos = await prisma.patientInfo.findMany({
      where: { clinicId, year: 2026, month }
    })

    const totalPatients = patientInfos.length

    // 연령별 그룹화
    const ageGroups = {}
    patientInfos.forEach(patient => {
      const ageGroup = patient.ageGroup || '기타'
      ageGroups[ageGroup] = (ageGroups[ageGroup] || 0) + 1
    })

    // 연령별 데이터 저장
    for (const [ageGroup, count] of Object.entries(ageGroups)) {
      const percentage = totalPatients > 0 ? (count / totalPatients) * 100 : 0

      await prisma.ageData.create({
        data: {
          clinicId,
          ageGroup,
          year: 2026,
          month,
          patientCount: count,
          percentage
        }
      })
    }
  }

  console.log(`   ✅ 연령별 데이터 마이그레이션 완료`)
}

// 유틸리티 함수들
function calculateAgeGroup(ageGender) {
  if (!ageGender) return '기타'

  const ageMatch = ageGender.match(/(\d+)/)
  if (!ageMatch) return '기타'

  const age = parseInt(ageMatch[1])

  if (age < 20) return '10대'
  if (age < 30) return '20대'
  if (age < 40) return '30대'
  if (age < 50) return '40대'
  if (age < 60) return '50대'
  if (age < 70) return '60대'
  return '70대 이상'
}

function extractAge(ageGender) {
  if (!ageGender) return null
  const ageMatch = ageGender.match(/(\d+)/)
  return ageMatch ? parseInt(ageMatch[1]) : null
}

function extractGender(ageGender) {
  if (!ageGender) return null
  if (ageGender.includes('남')) return '남성'
  if (ageGender.includes('여')) return '여성'
  return null
}

// 스크립트 실행
migrateToNewStructure()