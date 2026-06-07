import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')
    const limit = parseInt(searchParams.get('limit') || '50')

    console.log('로그 API 호출:', { clinicId, limit })

    if (!clinicId) {
      return NextResponse.json({ error: '클리닉 ID가 필요합니다.' }, { status: 400 })
    }

    // 클리닉 존재 여부 확인
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId }
    })

    if (!clinic) {
      return NextResponse.json({ error: '클리닉을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 임시로 빈 배열 반환 (테이블 이슈 해결 전까지)
    try {
      const logs = await prisma.uploadLog.findMany({
        where: { clinicId },
        orderBy: { createdAt: 'desc' },
        take: limit
      })

      console.log('로그 조회 완료:', { count: logs.length })
      return NextResponse.json({ logs })

    } catch (dbError) {
      console.warn('UploadLog 테이블 조회 실패, 빈 목록 반환:', dbError)
      // 테이블이 없거나 오류 시 빈 배열 반환
      return NextResponse.json({ logs: [] })
    }

  } catch (error) {
    console.error('업로드 로그 조회 상세 오류:', error)
    return NextResponse.json({
      error: '로그 조회 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}