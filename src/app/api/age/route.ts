import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import CacheService, { CACHE_STRATEGIES } from '@/lib/cache'

// 연령별 데이터 조회 (캐싱 적용)
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!clinicId || !year || !month) {
      return Response.json(
        { error: 'clinicId, year, month are required' },
        { status: 400 }
      )
    }

    // 캐시 키 생성
    const cacheKey = CacheService.createKey('age-stats', clinicId, year, month)

    // 캐시에서 조회 시도
    const cached = await CacheService.get(cacheKey)
    if (cached) {
      const queryTime = Date.now() - startTime
      return Response.json({
        ...(cached as any),
        meta: {
          queryTime,
          cacheHit: true
        }
      })
    }

    // 캐시 미스 시 DB에서 조회
    const [yearlyData, monthlyData] = await Promise.all([
      // 연간 데이터
      prisma.ageDist.findMany({
        where: {
          clinicId,
          year: parseInt(year)
        },
        orderBy: [{ month: 'asc' }, { ageGroup: 'asc' }]
      }),

      // 월별 데이터
      prisma.ageDist.findMany({
        where: {
          clinicId,
          year: parseInt(year),
          month: parseInt(month)
        },
        orderBy: { ageGroup: 'asc' }
      })
    ])

    const result = {
      yearlyData,
      monthlyData
    }

    // 캐시에 저장 (5분 TTL)
    await CacheService.set(cacheKey, result, CACHE_STRATEGIES.API_RESPONSE)

    const queryTime = Date.now() - startTime
    return Response.json({
      ...result,
      meta: {
        queryTime,
        cacheHit: false
      }
    })

  } catch (error) {
    console.error('Error fetching age data:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}