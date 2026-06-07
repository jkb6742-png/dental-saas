// 요일별 대기시간 분석 디버깅 스크립트
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugWaitingTimeData() {
  try {
    console.log('🔍 요일별 대기시간 디버깅 시작...\n')

    // 2026년 5월 데이터 조회 (모든 클리닉)
    const receptionRecords = await prisma.receptionRecord.findMany({
      where: {
        year: 2026,
        month: 5
      },
      select: {
        clinicId: true,
        receptionTime: true,
        waitingTime: true,
        patientName: true,
        chartNumber: true
      },
      orderBy: {
        receptionTime: 'asc'
      }
    })

    console.log(`📊 총 ${receptionRecords.length}건의 2026년 5월 데이터 발견\n`)

    if (receptionRecords.length === 0) {
      console.log('❌ 데이터가 없습니다.')
      return
    }

    // 요일별 데이터 분석
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    const weekdayData = {}

    // 각 레코드의 요일 계산 및 분석
    receptionRecords.forEach((record, index) => {
      if (!record.receptionTime) {
        console.log(`⚠️  레코드 ${index + 1}: receptionTime이 null`)
        return
      }

      const date = new Date(record.receptionTime)
      const dayOfWeek = date.getDay() // 0=일요일, 1=월요일, ..., 6=토요일
      const dayName = dayNames[dayOfWeek]

      // 날짜 정보 상세 출력 (처음 10개만)
      if (index < 10) {
        console.log(`📅 레코드 ${index + 1}:`)
        console.log(`   - 원본 receptionTime: ${record.receptionTime}`)
        console.log(`   - 파싱된 날짜: ${date.toLocaleDateString('ko-KR')}`)
        console.log(`   - 요일 (getDay): ${dayOfWeek} (${dayName}요일)`)
        console.log(`   - 대기시간: ${record.waitingTime}분`)
        console.log(`   - 환자: ${record.patientName} (${record.chartNumber})`)
        console.log('')
      }

      // 요일별 집계
      if (!weekdayData[dayName]) {
        weekdayData[dayName] = []
      }
      weekdayData[dayName].push({
        date: date.toLocaleDateString('ko-KR'),
        waitingTime: record.waitingTime,
        patientName: record.patientName,
        originalTime: record.receptionTime
      })
    })

    // 요일별 결과 출력
    console.log('\n📊 요일별 집계 결과:')
    console.log('=====================================')

    for (let i = 0; i <= 6; i++) {
      const dayName = dayNames[i]
      const records = weekdayData[dayName] || []

      console.log(`\n${dayName}요일: ${records.length}건`)

      if (records.length > 0) {
        console.log('   날짜별 상세:')
        records.forEach((record, idx) => {
          if (idx < 5) { // 처음 5개만 표시
            console.log(`   - ${record.date}: ${record.patientName} (대기시간: ${record.waitingTime}분)`)
          }
        })
        if (records.length > 5) {
          console.log(`   - ... 외 ${records.length - 5}건 더`)
        }

        // 일요일에 데이터가 있으면 특별히 조사
        if (i === 0 && records.length > 0) {
          console.log('\n🚨 일요일 데이터 상세 분석:')
          records.forEach(record => {
            console.log(`   원본 시간: ${record.originalTime}`)
            console.log(`   파싱 결과: ${record.date}`)
            console.log('   ---')
          })
        }
      }
    }

    // 2026년 5월 일요일들 확인
    console.log('\n📅 2026년 5월 일요일들:')
    for (let day = 1; day <= 31; day++) {
      try {
        const date = new Date(2026, 4, day) // 월은 0부터 시작
        if (date.getMonth() === 4 && date.getDay() === 0) { // 5월이고 일요일
          console.log(`   - 5월 ${day}일 (일요일)`)
        }
      } catch (e) {
        // 잘못된 날짜는 무시
      }
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugWaitingTimeData()