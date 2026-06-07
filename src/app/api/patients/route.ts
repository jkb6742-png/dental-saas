import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { PaginationService, SearchBuilder, SortBuilder } from '@/lib/pagination'

// 환자 데이터 조회 (페이지네이션 적용)
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')

    if (!clinicId) {
      return Response.json({ error: 'clinicId is required' }, { status: 400 })
    }

    // 페이지네이션 파라미터 검증
    const params = PaginationService.validateParams({
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined
    })

    // 검색 조건 구성
    const where = SearchBuilder.buildPatientSearch(params.search, clinicId)

    // 정렬 조건 구성
    const orderBy = SortBuilder.buildPatientSort(params.sortBy, params.sortOrder)

    // 필터 조건 추가
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    if (year) {
      where.year = parseInt(year)
    }
    if (month) {
      where.month = parseInt(month)
    }

    // 병렬로 데이터와 총 개수 조회
    const [patients, total] = await Promise.all([
      prisma.receptionRecord.findMany({
        where,
        orderBy,
        skip: params.offset,
        take: params.limit,
        select: {
          id: true,
          patientName: true,
          chartNumber: true,
          ageGender: true,
          receptionTime: true,
          patientType: true,
          totalRevenue: true,
          insuranceCoverage: true,
          patientPayment: true,
          waitingTime: true,
          doctor: true,
          visitRoute: true,
          year: true,
          month: true
        }
      }),
      prisma.receptionRecord.count({ where })
    ])

    const queryTime = Date.now() - startTime
    const result = PaginationService.createResult(
      patients,
      total,
      params.page,
      params.limit,
      queryTime
    )

    return Response.json(result)

  } catch (error) {
    console.error('Patient API error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 환자 통계 데이터 (요약용)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clinicId, year, month } = body

    if (!clinicId) {
      return Response.json({ error: 'clinicId is required' }, { status: 400 })
    }

    const where: any = { clinicId }
    if (year) where.year = parseInt(year)
    if (month) where.month = parseInt(month)

    // 집계 데이터 조회
    const stats = await prisma.receptionRecord.aggregate({
      where,
      _count: {
        id: true
      },
      _sum: {
        totalRevenue: true,
        insuranceCoverage: true,
        patientPayment: true
      },
      _avg: {
        totalRevenue: true,
        waitingTime: true
      }
    })

    // 환자 유형별 통계
    const patientTypeStats = await prisma.receptionRecord.groupBy({
      by: ['patientType'],
      where,
      _count: {
        id: true
      },
      _sum: {
        totalRevenue: true
      }
    })

    // 의사별 통계
    const doctorStats = await prisma.receptionRecord.groupBy({
      by: ['doctor'],
      where,
      _count: {
        id: true
      },
      _sum: {
        totalRevenue: true
      },
      orderBy: {
        _sum: {
          totalRevenue: 'desc'
        }
      },
      take: 10
    })

    return Response.json({
      summary: {
        totalPatients: stats._count.id,
        totalRevenue: stats._sum.totalRevenue || 0,
        avgRevenue: stats._avg.totalRevenue || 0,
        avgWaitingTime: stats._avg.waitingTime || 0
      },
      patientTypes: patientTypeStats,
      topDoctors: doctorStats
    })

  } catch (error) {
    console.error('Patient stats error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}