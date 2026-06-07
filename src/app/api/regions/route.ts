import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import CacheService, { CACHE_STRATEGIES } from '@/lib/cache'

// 지역별 데이터 조회 (캐싱 적용)
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
    const cacheKey = CacheService.createKey('region-stats', clinicId, year, month)

    // 캐시에서 조회 시도
    const cached = await CacheService.get(cacheKey)
    if (cached) {
      const queryTime = Date.now() - startTime
      return Response.json({
        ...cached,
        meta: {
          queryTime,
          cacheHit: true
        }
      })
    }

    // 캐시 미스 시 DB에서 조회
    const [yearlyData, monthlyData] = await Promise.all([
      // 연간 데이터
      prisma.regionDist.findMany({
        where: {
          clinicId,
          year: parseInt(year)
        },
        orderBy: [{ month: 'asc' }, { region: 'asc' }]
      }),

      // 월별 데이터
      prisma.regionDist.findMany({
        where: {
          clinicId,
          year: parseInt(year),
          month: parseInt(month)
        },
        orderBy: { totalPatients: 'desc' }
      })
    ])

    // 사용 가능한 년도/월 조합 (캐시된 값 사용)
    const availableDataCacheKey = CacheService.createKey('region-available-data', clinicId)
    let availableData = await CacheService.get(availableDataCacheKey)

    if (!availableData) {
      availableData = await prisma.regionDist.findMany({
        where: { clinicId },
        select: { year: true, month: true },
        distinct: ['year', 'month'],
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
      })

      // 사용 가능한 데이터는 덜 자주 변경되므로 더 길게 캐시
      await CacheService.set(availableDataCacheKey, availableData, CACHE_STRATEGIES.DAILY_STATS)
    }

    const result = {
      yearlyData,
      monthlyData,
      availableData
    }

    // 결과를 캐시에 저장
    await CacheService.set(cacheKey, result, CACHE_STRATEGIES.MONTHLY_STATS)

    const queryTime = Date.now() - startTime

    return Response.json({
      ...result,
      meta: {
        queryTime,
        cacheHit: false
      }
    })

  } catch (error) {
    console.error('Region API error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 지역별 통계 요약 (실시간 업데이트가 필요한 데이터)
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { clinicId, year, month } = body

    if (!clinicId) {
      return Response.json({ error: 'clinicId is required' }, { status: 400 })
    }

    // 실시간 통계는 짧은 캐시 적용
    const cacheKey = CacheService.createKey('region-summary', clinicId, year || 'current', month || 'current')
    const cached = await CacheService.get(cacheKey)

    if (cached) {
      const queryTime = Date.now() - startTime
      return Response.json({
        ...cached,
        meta: { queryTime, cacheHit: true }
      })
    }

    const where: any = { clinicId }
    if (year) where.year = parseInt(year)
    if (month) where.month = parseInt(month)

    // 집계 통계 조회
    const [totalStats, regionRanking, monthlyTrend] = await Promise.all([
      // 전체 통계
      prisma.regionDist.aggregate({
        where,
        _sum: {
          totalPatients: true,
          newPatients: true,
          returningPatients: true
        },
        _count: {
          region: true
        }
      }),

      // 지역별 순위 (상위 10개)
      prisma.regionDist.findMany({
        where,
        orderBy: { totalPatients: 'desc' },
        take: 10,
        select: {
          region: true,
          totalPatients: true,
          newPatients: true,
          returningPatients: true
        }
      }),

      // 월별 추이 (최근 6개월)
      prisma.regionDist.groupBy({
        by: ['year', 'month'],
        where: {
          clinicId,
          // 최근 6개월 데이터만
          OR: Array.from({ length: 6 }, (_, i) => {
            const date = new Date()
            date.setMonth(date.getMonth() - i)
            return {
              year: date.getFullYear(),
              month: date.getMonth() + 1
            }
          })
        },
        _sum: {
          totalPatients: true,
          newPatients: true
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
      })
    ])

    const result = {
      summary: {
        totalPatients: totalStats._sum.totalPatients || 0,
        totalNewPatients: totalStats._sum.newPatients || 0,
        totalReturningPatients: totalStats._sum.returningPatients || 0,
        regionCount: totalStats._count.region,
        newPatientRate: totalStats._sum.totalPatients ?
          ((totalStats._sum.newPatients || 0) / totalStats._sum.totalPatients * 100) : 0
      },
      topRegions: regionRanking,
      monthlyTrend: monthlyTrend.map(item => ({
        period: `${item.year}-${String(item.month).padStart(2, '0')}`,
        totalPatients: item._sum.totalPatients || 0,
        newPatients: item._sum.newPatients || 0
      }))
    }

    // 요약 데이터는 짧은 시간 캐시
    await CacheService.set(cacheKey, result, CACHE_STRATEGIES.API_RESPONSE)

    const queryTime = Date.now() - startTime

    return Response.json({
      ...result,
      meta: { queryTime, cacheHit: false }
    })

  } catch (error) {
    console.error('Region summary error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 캐시 무효화 (데이터 업데이트 시 호출)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')

    if (!clinicId) {
      return Response.json({ error: 'clinicId is required' }, { status: 400 })
    }

    // 관련 캐시 모두 무효화
    const patterns = [
      `region-stats:${clinicId}:*`,
      `region-summary:${clinicId}:*`,
      `region-available-data:${clinicId}`,
      `dashboard:${clinicId}`
    ]

    let totalDeleted = 0
    for (const pattern of patterns) {
      const deleted = await CacheService.invalidate(pattern)
      totalDeleted += deleted
    }

    return Response.json({
      message: 'Cache invalidated successfully',
      deletedKeys: totalDeleted
    })

  } catch (error) {
    console.error('Cache invalidation error:', error)
    return Response.json(
      { error: 'Cache invalidation failed' },
      { status: 500 }
    )
  }
}