import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import CacheService from '@/lib/cache'

// 성능 통계 조회 (관리자 전용)
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const session = await auth()
    if (!session || !['MASTER', 'ADMIN'].includes(session.user?.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 병렬로 모든 통계 수집
    const [cacheStats, dbStats, apiStats] = await Promise.all([
      getCacheStats(),
      getDatabaseStats(),
      getAPIStats()
    ])

    return Response.json({
      cache: cacheStats,
      database: dbStats,
      api: apiStats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Performance stats error:', error)
    return Response.json(
      { error: 'Failed to fetch performance stats' },
      { status: 500 }
    )
  }
}

// 캐시 통계 수집
async function getCacheStats() {
  try {
    return await CacheService.getStats()
  } catch (error) {
    console.error('Cache stats error:', error)
    return {
      redis: null,
      memory: {
        keys: 0,
        hits: 0,
        misses: 0,
        ksize: 0,
        vsize: 0
      }
    }
  }
}

// 데이터베이스 통계 수집
async function getDatabaseStats() {
  try {
    const startTime = Date.now()

    // 간단한 쿼리로 응답시간 측정
    await prisma.user.count()
    const queryTime = Date.now() - startTime

    // 최근 활동 통계
    const [userCount, clinicCount, recentUploads] = await Promise.all([
      prisma.user.count(),
      prisma.clinic.count(),
      prisma.fileUpload.count({
        where: {
          uploadedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 최근 24시간
          }
        }
      })
    ])

    // 느린 쿼리 개수 (임의로 계산 - 실제로는 로그에서 수집해야 함)
    const slowQueries = Math.floor(Math.random() * 5)

    return {
      averageQueryTime: queryTime,
      slowQueries,
      connectionCount: await getActiveConnections(),
      totalUsers: userCount,
      totalClinics: clinicCount,
      recentUploads
    }

  } catch (error) {
    console.error('Database stats error:', error)
    return {
      averageQueryTime: 0,
      slowQueries: 0,
      connectionCount: 0,
      totalUsers: 0,
      totalClinics: 0,
      recentUploads: 0
    }
  }
}

// API 통계 수집 (실제 환경에서는 별도 모니터링 시스템 사용)
async function getAPIStats() {
  try {
    // 실제 환경에서는 APM(Application Performance Monitoring) 도구나
    // 로그 분석을 통해 수집해야 하는 데이터입니다.
    // 여기서는 예시 데이터를 반환합니다.

    // 최근 1시간 동안의 API 호출 로그 (예시)
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)

    // 실제로는 별도의 API 로그 테이블이나 모니터링 시스템에서 가져와야 함
    const sampleResponseTimes = [120, 85, 95, 110, 78, 145, 92, 105, 88, 130]
    const averageResponseTime = Math.round(
      sampleResponseTimes.reduce((a, b) => a + b, 0) / sampleResponseTimes.length
    )

    const requestsPerMinute = Math.floor(Math.random() * 50) + 20 // 20-70 요청/분
    const errorRate = Math.random() * 2 // 0-2% 오류율

    return {
      averageResponseTime,
      requestsPerMinute,
      errorRate,
      totalRequests: requestsPerMinute * 60, // 시간당 예상 요청수
      last24Hours: {
        requests: requestsPerMinute * 60 * 24,
        errors: Math.floor(requestsPerMinute * 60 * 24 * errorRate / 100)
      }
    }

  } catch (error) {
    console.error('API stats error:', error)
    return {
      averageResponseTime: 0,
      requestsPerMinute: 0,
      errorRate: 0,
      totalRequests: 0,
      last24Hours: {
        requests: 0,
        errors: 0
      }
    }
  }
}

// 활성 데이터베이스 연결 수 확인
async function getActiveConnections(): Promise<number> {
  try {
    // PostgreSQL의 경우
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)
      FROM pg_stat_activity
      WHERE state = 'active'
    `

    return Number(result[0]?.count || 0)
  } catch (error) {
    // 권한이 없거나 쿼리 실행 실패 시 기본값 반환
    return 1
  }
}

// 캐시 워밍업 (관리자 기능)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== 'MASTER') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, clinicId } = body

    if (action === 'warmup') {
      if (!clinicId) {
        return Response.json({ error: 'clinicId is required for warmup' }, { status: 400 })
      }

      await CacheService.warmup(clinicId)
      return Response.json({ message: 'Cache warmup completed', clinicId })
    }

    if (action === 'clear') {
      const pattern = clinicId ? `*${clinicId}*` : '*'
      const deletedKeys = await CacheService.invalidate(pattern)
      return Response.json({ message: 'Cache cleared', deletedKeys })
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Performance admin error:', error)
    return Response.json(
      { error: 'Failed to execute performance action' },
      { status: 500 }
    )
  }
}

// 실시간 성능 모니터링을 위한 SSE (Server-Sent Events)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !['MASTER', 'ADMIN'].includes(session.user?.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SSE 설정
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        // 5초마다 성능 데이터 전송
        const interval = setInterval(async () => {
          try {
            const [cacheStats, dbStats, apiStats] = await Promise.all([
              getCacheStats(),
              getDatabaseStats(),
              getAPIStats()
            ])

            const data = {
              cache: cacheStats,
              database: dbStats,
              api: apiStats,
              timestamp: new Date().toISOString()
            }

            const message = `data: ${JSON.stringify(data)}\n\n`
            controller.enqueue(encoder.encode(message))
          } catch (error) {
            console.error('SSE performance error:', error)
            controller.error(error)
          }
        }, 5000)

        // 연결 해제 시 인터벌 정리
        return () => clearInterval(interval)
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (error) {
    console.error('SSE setup error:', error)
    return Response.json(
      { error: 'Failed to setup real-time monitoring' },
      { status: 500 }
    )
  }
}