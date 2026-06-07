import Redis from 'ioredis'
import NodeCache from 'node-cache'

// 캐시 전략 정의
export const CACHE_STRATEGIES = {
  // 자주 변하지 않는 데이터 (24시간)
  CLINIC_SETTINGS: 24 * 60 * 60,
  USER_PROFILE: 24 * 60 * 60,

  // 일별 통계 (4시간)
  DAILY_STATS: 4 * 60 * 60,

  // 월별 통계 (2시간)
  MONTHLY_STATS: 2 * 60 * 60,

  // 실시간 대시보드 (10분)
  DASHBOARD: 10 * 60,

  // API 응답 캐시 (5분)
  API_RESPONSE: 5 * 60,

  // 검색 결과 (3분)
  SEARCH_RESULTS: 3 * 60,

  // 사용자 세션 (30분)
  USER_SESSION: 30 * 60,
} as const

// Redis 클라이언트 (선택적)
let redisClient: Redis | null = null

try {
  if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // 연결 에러 시 로그만 기록하고 계속 진행
      onError: (error) => {
        console.warn('Redis connection error:', error.message)
      }
    })
  }
} catch (error) {
  console.warn('Redis initialization failed:', error)
  redisClient = null
}

// 메모리 캐시 (Redis 백업용)
const memoryCache = new NodeCache({
  stdTTL: 300, // 기본 5분
  checkperiod: 60, // 1분마다 만료된 키 정리
  useClones: false, // 성능 향상
  maxKeys: 10000 // 최대 키 개수
})

export interface CacheOptions {
  ttl?: number
  useMemoryFallback?: boolean
  serializer?: {
    stringify: (value: any) => string
    parse: (value: string) => any
  }
}

export class CacheService {
  private static defaultSerializer = {
    stringify: JSON.stringify,
    parse: JSON.parse
  }

  // 캐시에서 데이터 조회
  static async get<T>(
    key: string,
    options: CacheOptions = {}
  ): Promise<T | null> {
    const { useMemoryFallback = true, serializer = this.defaultSerializer } = options

    try {
      // Redis 우선 시도
      if (redisClient?.status === 'ready') {
        const value = await redisClient.get(key)
        if (value !== null) {
          return serializer.parse(value) as T
        }
      }

      // Redis 실패 시 메모리 캐시 사용
      if (useMemoryFallback) {
        const value = memoryCache.get<T>(key)
        if (value !== undefined) {
          return value
        }
      }

      return null
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error)

      // Redis 에러 시 메모리 캐시 시도
      if (useMemoryFallback) {
        try {
          const value = memoryCache.get<T>(key)
          return value !== undefined ? value : null
        } catch {
          return null
        }
      }

      return null
    }
  }

  // 캐시에 데이터 저장
  static async set(
    key: string,
    value: any,
    ttlSeconds: number = CACHE_STRATEGIES.API_RESPONSE,
    options: CacheOptions = {}
  ): Promise<boolean> {
    const { useMemoryFallback = true, serializer = this.defaultSerializer } = options

    let success = false

    try {
      // Redis에 저장 시도
      if (redisClient?.status === 'ready') {
        await redisClient.setex(key, ttlSeconds, serializer.stringify(value))
        success = true
      }

      // 메모리 캐시에도 저장 (백업 및 빠른 조회용)
      if (useMemoryFallback) {
        memoryCache.set(key, value, ttlSeconds)
        success = true
      }

      return success
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error)

      // Redis 실패 시 메모리 캐시라도 저장
      if (useMemoryFallback) {
        try {
          memoryCache.set(key, value, ttlSeconds)
          return true
        } catch {
          return false
        }
      }

      return false
    }
  }

  // 캐시 무효화 (패턴 매칭 지원)
  static async invalidate(pattern: string): Promise<number> {
    let deletedCount = 0

    try {
      // Redis에서 삭제
      if (redisClient?.status === 'ready') {
        const keys = await redisClient.keys(pattern)
        if (keys.length > 0) {
          deletedCount += await redisClient.del(...keys)
        }
      }

      // 메모리 캐시에서 삭제 (패턴 매칭)
      const memoryKeys = memoryCache.keys()
      const matchingKeys = memoryKeys.filter(key =>
        this.matchPattern(key, pattern)
      )

      for (const key of matchingKeys) {
        memoryCache.del(key)
        deletedCount++
      }

      return deletedCount
    } catch (error) {
      console.error(`Cache invalidate error for pattern ${pattern}:`, error)
      return 0
    }
  }

  // 특정 키 삭제
  static async delete(key: string): Promise<boolean> {
    try {
      let deleted = false

      // Redis에서 삭제
      if (redisClient?.status === 'ready') {
        const result = await redisClient.del(key)
        deleted = result > 0
      }

      // 메모리 캐시에서 삭제
      const memoryDeleted = memoryCache.del(key)

      return deleted || memoryDeleted
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error)
      return false
    }
  }

  // 캐시 통계
  static async getStats(): Promise<{
    redis: any
    memory: {
      keys: number
      hits: number
      misses: number
      ksize: number
      vsize: number
    }
  }> {
    try {
      const redisStats = redisClient?.status === 'ready'
        ? await redisClient.info('memory')
        : null

      const memoryStats = memoryCache.getStats()

      return {
        redis: redisStats,
        memory: memoryStats
      }
    } catch (error) {
      console.error('Cache stats error:', error)
      return {
        redis: null,
        memory: memoryCache.getStats()
      }
    }
  }

  // 패턴 매칭 헬퍼
  private static matchPattern(text: string, pattern: string): boolean {
    const regex = new RegExp(
      pattern
        .replace(/\*/g, '.*')  // * → .*
        .replace(/\?/g, '.')   // ? → .
    )
    return regex.test(text)
  }

  // 캐시 키 생성 헬퍼
  static createKey(...parts: (string | number)[]): string {
    return parts
      .map(part => String(part).replace(/:/g, '_'))
      .join(':')
  }

  // 캐시 워밍업 (자주 사용되는 데이터 미리 로드)
  static async warmup(clinicId: string): Promise<void> {
    try {
      console.log(`Starting cache warmup for clinic ${clinicId}`)

      // 병렬로 자주 사용되는 데이터 로드
      const warmupTasks = [
        // 최근 3개월 월별 통계
        this.warmupMonthlyStats(clinicId),
        // 주요 대시보드 데이터
        this.warmupDashboardData(clinicId),
        // 사용자 설정
        this.warmupUserSettings(clinicId)
      ]

      await Promise.allSettled(warmupTasks)
      console.log(`Cache warmup completed for clinic ${clinicId}`)
    } catch (error) {
      console.error(`Cache warmup failed for clinic ${clinicId}:`, error)
    }
  }

  // 월별 통계 워밍업
  private static async warmupMonthlyStats(clinicId: string) {
    const now = new Date()
    const tasks = []

    for (let i = 0; i < 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1

      tasks.push(
        this.set(
          this.createKey('monthly-stats', clinicId, year, month),
          { prewarmed: true },
          CACHE_STRATEGIES.MONTHLY_STATS
        )
      )
    }

    await Promise.all(tasks)
  }

  // 대시보드 데이터 워밍업
  private static async warmupDashboardData(clinicId: string) {
    await this.set(
      this.createKey('dashboard', clinicId),
      { prewarmed: true },
      CACHE_STRATEGIES.DASHBOARD
    )
  }

  // 사용자 설정 워밍업
  private static async warmupUserSettings(clinicId: string) {
    await this.set(
      this.createKey('clinic-settings', clinicId),
      { prewarmed: true },
      CACHE_STRATEGIES.CLINIC_SETTINGS
    )
  }
}

// 캐시된 함수 데코레이터
export function cached(
  keyPrefix: string,
  ttl: number = CACHE_STRATEGIES.API_RESPONSE
) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const key = CacheService.createKey(keyPrefix, ...args)

      // 캐시에서 조회
      const cached = await CacheService.get(key)
      if (cached !== null) {
        return cached
      }

      // 캐시 미스 시 실제 함수 실행
      const result = await method.apply(this, args)

      // 결과를 캐시에 저장
      await CacheService.set(key, result, ttl)

      return result
    }

    return descriptor
  }
}

// 사용 예제
export class CachedDataService {
  @cached('region-stats', CACHE_STRATEGIES.MONTHLY_STATS)
  static async getRegionStats(clinicId: string, year: number, month: number) {
    // 실제 DB 조회 로직
    return { clinicId, year, month, data: [] }
  }

  @cached('age-stats', CACHE_STRATEGIES.MONTHLY_STATS)
  static async getAgeStats(clinicId: string, year: number, month: number) {
    // 실제 DB 조회 로직
    return { clinicId, year, month, data: [] }
  }
}

// 캐시 관리 유틸리티
export const CacheManager = {
  // 데이터 변경 시 관련 캐시 무효화
  async invalidateRelated(clinicId: string, dataType: string) {
    const patterns = [
      `*${clinicId}*${dataType}*`,
      `dashboard:${clinicId}`,
      `monthly-stats:${clinicId}:*`
    ]

    for (const pattern of patterns) {
      await CacheService.invalidate(pattern)
    }
  },

  // 주기적 캐시 정리
  async cleanup() {
    try {
      // 만료된 키 통계 확인
      const stats = await CacheService.getStats()
      console.log('Cache stats before cleanup:', stats)

      // Redis에서 만료된 키는 자동 정리됨
      // 메모리 캐시는 NodeCache가 자동으로 정리

    } catch (error) {
      console.error('Cache cleanup error:', error)
    }
  }
}

export default CacheService