// 실제 데이터가 있는 월 확인 스크립트
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAvailableMonths() {
  try {
    console.log('📅 사용 가능한 월 데이터 확인...\n')

    // 2026년 ReceptionRecord 데이터가 있는 월들 조회
    const monthlyData = await prisma.receptionRecord.groupBy({
      by: ['year', 'month'],
      where: {
        year: 2026
      },
      _count: {
        id: true
      },
      orderBy: [
        { year: 'asc' },
        { month: 'asc' }
      ]
    })

    console.log('📊 2026년 데이터가 있는 월:')
    monthlyData.forEach(item => {
      console.log(`${item.year}년 ${item.month}월: ${item._count.id}건`)
    })

    // 2025년 데이터도 확인
    const monthlyData2025 = await prisma.receptionRecord.groupBy({
      by: ['year', 'month'],
      where: {
        year: 2025
      },
      _count: {
        id: true
      },
      orderBy: [
        { year: 'asc' },
        { month: 'asc' }
      ]
    })

    console.log('\n📊 2025년 데이터가 있는 월:')
    if (monthlyData2025.length > 0) {
      monthlyData2025.forEach(item => {
        console.log(`${item.year}년 ${item.month}월: ${item._count.id}건`)
      })
    } else {
      console.log('2025년 데이터 없음')
    }

    // 사용 가능한 월만 추출
    const availableMonths2026 = monthlyData.map(item => item.month).sort((a, b) => a - b)
    const availableMonths2025 = monthlyData2025.map(item => item.month).sort((a, b) => a - b)

    console.log('\n✅ 결과:')
    console.log(`2025년 사용 가능한 월: [${availableMonths2025.join(', ')}]`)
    console.log(`2026년 사용 가능한 월: [${availableMonths2026.join(', ')}]`)

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAvailableMonths()