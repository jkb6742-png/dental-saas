// 페이지네이션 유틸리티
export interface PaginationParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginationResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  meta?: {
    queryTime: number
    cacheHit?: boolean
  }
}

export class PaginationService {
  static validateParams(params: PaginationParams) {
    const page = Math.max(1, parseInt(String(params.page || 1)))
    const limit = Math.max(1, Math.min(100, parseInt(String(params.limit || 20)))) // 최대 100개
    const offset = (page - 1) * limit

    return {
      page,
      limit,
      offset,
      search: params.search?.trim() || undefined,
      sortBy: params.sortBy || 'createdAt',
      sortOrder: params.sortOrder || 'desc' as const
    }
  }

  static createResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    queryTime?: number
  ): PaginationResult<T> {
    const totalPages = Math.ceil(total / limit)

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      meta: queryTime ? { queryTime } : undefined
    }
  }

  // 커서 기반 페이지네이션 (무한 스크롤용)
  static createCursorResult<T extends { id: string; createdAt: Date }>(
    data: T[],
    limit: number,
    hasMore: boolean
  ) {
    const lastItem = data[data.length - 1]
    const nextCursor = hasMore && lastItem ?
      Buffer.from(`${lastItem.createdAt.toISOString()}:${lastItem.id}`).toString('base64') :
      null

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
        count: data.length
      }
    }
  }
}

// 검색 조건 빌더
export class SearchBuilder {
  static buildPatientSearch(search?: string, clinicId?: string) {
    const where: any = {}

    if (clinicId) {
      where.clinicId = clinicId
    }

    if (search) {
      where.OR = [
        { patientName: { contains: search, mode: 'insensitive' } },
        { chartNumber: { contains: search, mode: 'insensitive' } },
        { ageGender: { contains: search, mode: 'insensitive' } }
      ]
    }

    return where
  }

  static buildTreatmentSearch(search?: string, clinicId?: string) {
    const where: any = {}

    if (clinicId) {
      where.clinicId = clinicId
    }

    if (search) {
      where.itemName = { contains: search, mode: 'insensitive' }
    }

    return where
  }

  static buildReviewSearch(search?: string, clinicId?: string) {
    const where: any = {}

    if (clinicId) {
      where.clinicId = clinicId
    }

    if (search) {
      where.OR = [
        { authorName: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ]
    }

    return where
  }
}

// 정렬 조건 빌더
export class SortBuilder {
  static buildPatientSort(sortBy: string, sortOrder: 'asc' | 'desc') {
    const validSortFields = ['receptionTime', 'totalRevenue', 'patientName', 'waitingTime']
    const field = validSortFields.includes(sortBy) ? sortBy : 'receptionTime'

    return { [field]: sortOrder }
  }

  static buildTreatmentSort(sortBy: string, sortOrder: 'asc' | 'desc') {
    const validSortFields = ['revenue', 'patientCount', 'visitCount', 'itemName']
    const field = validSortFields.includes(sortBy) ? sortBy : 'revenue'

    return { [field]: sortOrder }
  }

  static buildReviewSort(sortBy: string, sortOrder: 'asc' | 'desc') {
    const validSortFields = ['reviewDate', 'rating', 'authorName']
    const field = validSortFields.includes(sortBy) ? sortBy : 'reviewDate'

    return { [field]: sortOrder }
  }
}