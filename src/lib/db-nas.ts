// NAS 환경용 데이터베이스 최적화
import { prisma } from '@/lib/db'

// NAS 환경용 DB 설정
export const NAS_DB_CONFIG = {
  // 연결 풀 최적화 (NAS 리소스 절약)
  maxConnections: 5, // NAS는 동시 연결 수 제한
  connectionTimeout: 10000, // 10초
  queryTimeout: 15000, // 15초

  // 배치 처리 설정
  batchSize: 100, // 한 번에 처리할 레코드 수
  bulkInsertSize: 50, // 대량 삽입 시 청크 크기

  // 페이지네이션 기본값
  defaultPageSize: 20,
  maxPageSize: 50, // NAS 메모리 고려하여 제한
}

export class NASDatabase {
  // 메모리 효율적인 페이지네이션
  static async getPaginatedData<T>(
    query: any,
    page: number = 1,
    limit: number = NAS_DB_CONFIG.defaultPageSize
  ): Promise<{
    data: T[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasNext: boolean
      hasPrev: boolean
    }
  }> {
    // 제한값 적용
    const safeLimit = Math.min(limit, NAS_DB_CONFIG.maxPageSize)
    const offset = (page - 1) * safeLimit

    try {
      // 총 개수와 데이터를 병렬로 조회 (효율성)
      const [data, total] = await Promise.all([
        query.skip(offset).take(safeLimit),
        query.count ? query.count() : 0
      ])

      const totalPages = Math.ceil(total / safeLimit)

      return {
        data,
        pagination: {
          page,
          limit: safeLimit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    } catch (error) {
      console.error('Pagination error:', error)
      throw error
    }
  }

  // 배치 처리 (대량 데이터 효율적 처리)
  static async processBatch<T>(
    items: T[],
    processor: (batch: T[]) => Promise<void>,
    batchSize: number = NAS_DB_CONFIG.batchSize
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      await processor(batch)

      // NAS 과부하 방지를 위한 짧은 대기
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
  }

  // 스트리밍 데이터 처리 (메모리 절약)
  static async streamProcess<T>(
    query: any,
    processor: (item: T) => Promise<void>,
    chunkSize: number = 100
  ): Promise<void> {
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const chunk = await query.skip(offset).take(chunkSize)

      if (chunk.length === 0) {
        hasMore = false
        break
      }

      // 청크 단위로 처리
      for (const item of chunk) {
        await processor(item)
      }

      offset += chunkSize
      hasMore = chunk.length === chunkSize

      // NAS 부하 방지
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  // 경량화된 통계 조회
  static async getLightweightStats(clinicId: string, year?: number, month?: number) {
    const where: any = { clinicId }
    if (year) where.year = year
    if (month) where.month = month

    // 필요한 통계만 선택적 조회
    const [
      patientCount,
      revenueSum,
      regionCount,
      ageGroupCount
    ] = await Promise.all([
      prisma.receptionRecord.count({ where }),

      prisma.receptionRecord.aggregate({
        where,
        _sum: { totalRevenue: true },
        _avg: { totalRevenue: true }
      }),

      prisma.regionDist.count({
        where: {
          clinicId,
          ...(year && { year }),
          ...(month && { month })
        }
      }),

      prisma.ageDist.count({
        where: {
          clinicId,
          ...(year && { year }),
          ...(month && { month })
        }
      })
    ])

    return {
      patients: {
        total: patientCount,
        avgRevenue: revenueSum._avg.totalRevenue || 0,
        totalRevenue: revenueSum._sum.totalRevenue || 0
      },
      regions: regionCount,
      ageGroups: ageGroupCount,
      period: { year, month }
    }
  }

  // Top N 조회 (메모리 효율적)
  static async getTopRegions(clinicId: string, limit: number = 10, year?: number, month?: number) {
    const where: any = { clinicId }
    if (year) where.year = year
    if (month) where.month = month

    return await prisma.regionDist.findMany({
      where,
      select: {
        region: true,
        totalPatients: true,
        newPatients: true,
        returningPatients: true
      },
      orderBy: { totalPatients: 'desc' },
      take: Math.min(limit, 20) // 최대 20개로 제한
    })
  }

  // 압축된 월별 추이 데이터
  static async getCompactMonthlyTrend(clinicId: string, months: number = 6) {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(endDate.getMonth() - months)

    return await prisma.monthlySummary.findMany({
      where: {
        clinicId,
        year: { gte: startDate.getFullYear() },
        month: { gte: startDate.getMonth() + 1 }
      },
      select: {
        year: true,
        month: true,
        totalRevenue: true,
        newPatients: true,
        totalPatients: true
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      take: months
    })
  }

  // NAS 리소스를 고려한 검색
  static async searchPatients(
    clinicId: string,
    searchTerm: string,
    page: number = 1,
    limit: number = 20
  ) {
    const safeLimit = Math.min(limit, 30) // 검색은 더 제한적으로

    const where = {
      clinicId,
      OR: [
        { patientName: { contains: searchTerm, mode: 'insensitive' as const } },
        { chartNumber: { contains: searchTerm, mode: 'insensitive' as const } }
      ]
    }

    return await this.getPaginatedData(
      prisma.receptionRecord.findMany({
        where,
        select: {
          id: true,
          patientName: true,
          chartNumber: true,
          ageGender: true,
          receptionTime: true,
          totalRevenue: true,
          doctor: true
        },
        orderBy: { receptionTime: 'desc' }
      }),
      page,
      safeLimit
    )
  }

  // 연결 상태 확인
  static async checkHealth() {
    try {
      const start = Date.now()
      await prisma.$queryRaw`SELECT 1`
      const queryTime = Date.now() - start

      // 활성 연결 수 확인 (PostgreSQL)
      const connections = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) FROM pg_stat_activity WHERE state = 'active'
      `.catch(() => [{ count: BigInt(0) }])

      return {
        status: 'healthy',
        queryTime,
        activeConnections: Number(connections[0]?.count || 0),
        timestamp: new Date()
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      }
    }
  }

  // 느린 쿼리 감지 (NAS에서는 더 민감하게)
  static async monitorSlowQueries() {
    const slowQueryThreshold = 1000 // 1초 이상을 느린 쿼리로 간주

    // 실제 환경에서는 pg_stat_statements 확장 사용
    try {
      const slowQueries = await prisma.$queryRaw<Array<{
        query: string
        mean_exec_time: number
        calls: number
      }>>`
        SELECT
          query,
          mean_exec_time,
          calls
        FROM pg_stat_statements
        WHERE mean_exec_time > ${slowQueryThreshold}
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `.catch(() => [])

      return slowQueries
    } catch {
      return []
    }
  }
}

// NAS용 쿼리 빌더
export class NASQueryBuilder {
  // 효율적인 필드 선택
  static selectEssentialFields(tableName: string) {
    const fieldMap: Record<string, string[]> = {
      receptionRecord: ['id', 'patientName', 'chartNumber', 'receptionTime', 'totalRevenue'],
      regionDist: ['region', 'totalPatients', 'newPatients', 'returningPatients'],
      ageDist: ['ageGroup', 'totalPatients', 'newPatients', 'returningPatients'],
      monthlySummary: ['year', 'month', 'totalRevenue', 'newPatients', 'totalPatients']
    }

    return fieldMap[tableName] || ['id']
  }

  // 날짜 범위 최적화
  static buildDateRange(year?: number, month?: number) {
    if (!year && !month) return {}

    const where: any = {}
    if (year) where.year = year
    if (month) where.month = month

    return where
  }

  // NAS 친화적 정렬 (인덱스 활용)
  static buildOrderBy(sortBy?: string, order: 'asc' | 'desc' = 'desc') {
    const indexedFields = [
      'createdAt', 'receptionTime', 'totalRevenue',
      'totalPatients', 'year', 'month'
    ]

    const field = sortBy && indexedFields.includes(sortBy) ? sortBy : 'createdAt'
    return { [field]: order }
  }
}

export default NASDatabase