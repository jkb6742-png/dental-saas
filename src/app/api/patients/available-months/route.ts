import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const clinicId = url.searchParams.get('clinicId')
    const year = parseInt(url.searchParams.get('year') || '2026')

    if (!clinicId) {
      return NextResponse.json({
        error: 'clinicId가 필요합니다.'
      }, { status: 400 })
    }

    // 해당 클리닉과 년도에서 데이터가 있는 월들 조회
    const monthlyData = await prisma.receptionRecord.groupBy({
      by: ['month'],
      where: {
        clinicId,
        year
      },
      _count: {
        id: true
      },
      orderBy: {
        month: 'asc'
      }
    })

    // 데이터가 있는 월만 추출
    const availableMonths = monthlyData
      .filter(item => item._count.id > 0)
      .map(item => item.month)

    return NextResponse.json({
      success: true,
      data: {
        year,
        availableMonths,
        monthlyData: monthlyData.map(item => ({
          month: item.month,
          recordCount: item._count.id
        }))
      }
    })

  } catch (error) {
    console.error('[사용 가능한 월 조회] 오류:', error)
    return NextResponse.json({
      error: '사용 가능한 월 조회 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}