import { NextRequest, NextResponse } from 'next/server'
import { denyClinic } from "@/lib/requests/access"
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { clinicId } = await request.json()

    if (!clinicId) {
      return NextResponse.json({ error: '클리닉 ID가 필요합니다.' }, { status: 400 })
    }

    const denied = await denyClinic(clinicId)
    if (denied) return denied

    // 모든 대시보드 페이지 캐시 무효화
    const pathsToRevalidate = [
      `/dashboard/${clinicId}`,
      `/dashboard/${clinicId}/patients`,
      `/dashboard/${clinicId}/age`,
      `/dashboard/${clinicId}/regions`,
      `/dashboard/${clinicId}/revenue`,
      `/dashboard/${clinicId}/treatments`,
      `/dashboard/${clinicId}/routes`,
      `/dashboard/${clinicId}/reports`
    ]

    console.log('캐시 무효화 시작:', pathsToRevalidate)

    // Next.js 캐시 무효화
    pathsToRevalidate.forEach(path => {
      try {
        revalidatePath(path)
        console.log(`✅ 캐시 무효화 성공: ${path}`)
      } catch (error) {
        console.error(`❌ 캐시 무효화 실패: ${path}`, error)
      }
    })

    return NextResponse.json({
      success: true,
      message: '캐시가 성공적으로 무효화되었습니다.',
      revalidatedPaths: pathsToRevalidate,
      clinicId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('캐시 무효화 오류:', error)
    return NextResponse.json({
      error: '캐시 무효화 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}