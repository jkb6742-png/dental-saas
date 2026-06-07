// 잘못된 날짜 데이터 수정 스크립트
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixWrongDates() {
  try {
    console.log('🔧 잘못된 날짜 데이터 수정 시작...\n')

    // 1. 일요일에 있는 잘못된 데이터 조회
    const sundayRecords = await prisma.receptionRecord.findMany({
      where: {
        year: 2026,
        month: 5,
        receptionTime: {
          not: null
        }
      },
      select: {
        id: true,
        receptionTime: true,
        patientName: true,
        chartNumber: true,
        waitingTime: true
      }
    })

    console.log(`📊 총 ${sundayRecords.length}건의 2026년 5월 데이터 조회`)

    // 일요일 데이터만 필터링
    const sundayData = sundayRecords.filter(record => {
      if (!record.receptionTime) return false
      const date = new Date(record.receptionTime)
      return date.getDay() === 0 // 0 = 일요일
    })

    console.log(`🚨 일요일에 있는 잘못된 데이터: ${sundayData.length}건`)

    if (sundayData.length > 0) {
      console.log('\n일요일 데이터 상세:')
      sundayData.forEach((record, idx) => {
        const date = new Date(record.receptionTime)
        console.log(`${idx + 1}. ${record.patientName} (${record.chartNumber})`)
        console.log(`   날짜: ${date.toLocaleDateString('ko-KR')} (${['일','월','화','수','목','금','토'][date.getDay()]}요일)`)
        console.log(`   대기시간: ${record.waitingTime}분`)
      })
    }

    // 2. 이 데이터들을 하루 앞으로 이동 (토요일로 수정)
    console.log('\n🔧 일요일 → 토요일로 날짜 수정...')

    for (const record of sundayData) {
      const currentDate = new Date(record.receptionTime)

      // 하루 빼서 토요일로 만들기
      const correctedDate = new Date(currentDate)
      correctedDate.setDate(correctedDate.getDate() - 1)

      console.log(`수정: ${record.patientName} - ${currentDate.toLocaleDateString()} → ${correctedDate.toLocaleDateString()}`)

      await prisma.receptionRecord.update({
        where: { id: record.id },
        data: {
          receptionTime: correctedDate
        }
      })
    }

    console.log(`\n✅ ${sundayData.length}건의 데이터 날짜 수정 완료!`)

    // 3. 수정 후 검증
    console.log('\n🔍 수정 후 검증...')

    const afterRecords = await prisma.receptionRecord.findMany({
      where: {
        year: 2026,
        month: 5
      },
      select: {
        receptionTime: true
      }
    })

    const dayStats = [0, 0, 0, 0, 0, 0, 0] // 일~토
    afterRecords.forEach(record => {
      if (record.receptionTime) {
        const date = new Date(record.receptionTime)
        dayStats[date.getDay()]++
      }
    })

    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    console.log('\n📊 수정 후 요일별 데이터 분포:')
    dayStats.forEach((count, day) => {
      console.log(`${dayNames[day]}요일: ${count}건`)
    })

    if (dayStats[0] === 0) {
      console.log('\n🎉 수정 완료! 일요일 데이터가 0건이 되었습니다.')
    } else {
      console.log(`\n⚠️ 아직 일요일에 ${dayStats[0]}건의 데이터가 남아있습니다.`)
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixWrongDates()