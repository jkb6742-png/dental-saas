import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 임시: 테스트용 대기시간 데이터 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clinicId } = body

    console.log(`[대기시간수정] 시작 - 클리닉: ${clinicId}`)

    if (!clinicId) {
      return NextResponse.json({
        error: 'clinicId가 필요합니다.'
      }, { status: 400 })
    }

    // 현재 대기시간이 null인 레코드들 조회
    const nullWaitingRecords = await prisma.receptionRecord.findMany({
      where: {
        clinicId,
        waitingTime: null
      },
      select: {
        id: true,
        patientType: true
      }
    })

    console.log(`[대기시간수정] null 레코드: ${nullWaitingRecords.length}개`)

    // 임시 대기시간 생성 (현실적인 값)
    let updatedCount = 0

    for (const record of nullWaitingRecords) {
      // 신환: 15-45분, 구환: 5-25분 랜덤 생성
      const isNewPatient = record.patientType?.includes('신환')
      const minWait = isNewPatient ? 15 : 5
      const maxWait = isNewPatient ? 45 : 25

      const waitingTime = Math.floor(Math.random() * (maxWait - minWait + 1)) + minWait

      await prisma.receptionRecord.update({
        where: { id: record.id },
        data: { waitingTime }
      })

      updatedCount++

      // 진행상황 로깅 (100개마다)
      if (updatedCount % 100 === 0) {
        console.log(`[대기시간수정] 진행: ${updatedCount}개 업데이트`)
      }
    }

    console.log(`[대기시간수정] 완료 - 총 ${updatedCount}개 레코드 업데이트`)

    return NextResponse.json({
      success: true,
      message: `${updatedCount}개 레코드의 대기시간을 업데이트했습니다.`,
      details: {
        totalUpdated: updatedCount,
        rule: '신환: 15-45분, 구환: 5-25분 랜덤 생성'
      }
    })

  } catch (error) {
    console.error('[대기시간수정] 오류:', error)
    return NextResponse.json({
      error: '대기시간 수정 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}