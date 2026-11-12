import { NextRequest, NextResponse } from 'next/server'
import { denyClinic, logDataUpload } from "@/lib/requests/access"
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

interface StructuredData {
  dataType: '접수수납' | '연간장부' | '환자정보' | '기타'
  receptionRecords: Array<{
    receptionTime?: string
    status?: string
    ageGenderRaw?: string
    age?: number
    gender?: string
    ageGroup?: string
    insuranceType?: string
    patientType?: string
    waitingMinutes?: number
    reservationTimeRaw?: string
    totalRevenue?: number
    firstVisitDate?: string
    visitRoute?: string
    customerType?: string
    customerType2?: string
    recallType?: string
    rawIncludedData?: any
  }>
  summary: {
    totalRecords?: number
    totalRevenue?: number
    uniquePatients?: number
    dateRange?: {
      start?: string
      end?: string
    }
  }
  chartMapping?: Array<{
    originalIndex: number
    patientKey: string
  }>
}

// 배열을 청크로 나누는 유틸리티
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

export async function POST(request: NextRequest) {
  console.log('🚀 [OPTIMIZED-SAVE] 최적화된 저장 시작')
  const startTime = Date.now()

  try {
    // 인증 확인
    const session = await auth()
    console.log('🔐 [SAVE] 세션 상태:', session ? '✅ 인증됨' : '❌ 미인증')

    if (!session) {
      console.log('❌ [SAVE] 인증 실패 - 401 반환')
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    console.log('👤 [SAVE] 사용자:', session.user?.email)

    // 요청 데이터 파싱
    const requestData = await request.json()
    const { clinicId, structuredData, fileName } = requestData as {
      clinicId: string
      structuredData: StructuredData
      fileName: string
    }

    if (!clinicId || !structuredData) {
      return NextResponse.json({ error: '필수 데이터가 누락되었습니다.' }, { status: 400 })
    }

    const denied = await denyClinic(clinicId)
    if (denied) return denied
    await logDataUpload(clinicId, "DATA_UPLOAD_SAVE", {
      fileName,
      receptionRecords: structuredData.receptionRecords?.length ?? 0,
    })

    console.log(`🚀 처리 시작: ${fileName}, 레코드 수: ${structuredData.receptionRecords?.length || 0}`)

    // =====================================================
    // 최적화된 배치 저장 (N+1 쿼리 문제 해결)
    // =====================================================
    const receptionResult = await saveReceptionRecordsBatch(
      structuredData.receptionRecords || [],
      structuredData.chartMapping || [],
      clinicId
    )

    // =====================================================
    // 비동기 집계 처리 (응답 차단하지 않음)
    // =====================================================
    if (receptionResult.success && structuredData.summary?.dateRange) {
      generateAggregatesBackground(clinicId, structuredData.summary.dateRange)
        .catch(error => console.error('❌ 백그라운드 집계 실패:', error))
    }

    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000

    console.log(`✅ 저장 완료: ${duration}초, ${receptionResult.recordCount}건`)

    return NextResponse.json({
      success: true,
      message: '데이터가 성공적으로 저장되었습니다.',
      saved: {
        patients: receptionResult.recordCount,
        revenue: '백그라운드 처리 중',
        regions: '백그라운드 처리 중',
        ageData: '백그라운드 처리 중'
      },
      fileName,
      clinicId,
      dataType: structuredData.dataType,
      savedAt: new Date().toISOString(),
      performance: {
        duration: `${duration}초`,
        recordsSaved: receptionResult.recordCount,
        method: 'optimized-batch'
      }
    })

  } catch (error) {
    console.error('❌ 최적화된 저장 실패:', error)
    return NextResponse.json({
      error: '데이터 저장 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * 🚀 최적화된 배치 저장 (N+1 쿼리 문제 해결)
 */
async function saveReceptionRecordsBatch(
  receptionRecords: StructuredData['receptionRecords'],
  chartMapping: StructuredData['chartMapping'],
  clinicId: string
): Promise<{ success: boolean; recordCount: number; duration: number }> {

  const batchStartTime = Date.now()
  console.log(`📦 배치 저장 시작: ${receptionRecords.length}건`)

  if (!receptionRecords || receptionRecords.length === 0) {
    return { success: true, recordCount: 0, duration: 0 }
  }

  try {
    // 저장할 데이터 변환
    const recordsToSave = receptionRecords.map((record, index) => {
      const receptionTime = record.receptionTime ? new Date(record.receptionTime) : new Date()
      const firstVisitDate = record.firstVisitDate ? new Date(record.firstVisitDate) : null
      const reservationTime = record.reservationTimeRaw ? new Date(record.reservationTimeRaw) : null
      const patientKey = chartMapping?.find(m => m.originalIndex === index + 1)?.patientKey

      return {
        clinicId,
        year: receptionTime.getFullYear(),
        month: receptionTime.getMonth() + 1,
        receptionTime,
        status: record.status || '',
        chartNumber: patientKey || '',
        patientName: '',
        ageGender: record.ageGenderRaw || '',
        insuranceType: record.insuranceType || '',
        patientType: record.patientType || '',
        waitingMinutes: record.waitingMinutes || 0,
        reservationTime,
        totalRevenue: record.totalRevenue || 0,
        firstVisitDate,
        visitRoute: record.visitRoute || '',
        customerType: record.customerType || '',
        customerType2: record.customerType2 || '',
        recallType: record.recallType || '',
        memo: record.rawIncludedData ? JSON.stringify(record.rawIncludedData) : ''
      }
    })

    let totalInserted = 0

    // 트랜잭션으로 배치 저장
    await prisma.$transaction(async (tx) => {
      // 1. 기존 데이터 정리 (연도별)
      const years = [...new Set(recordsToSave.map(r => r.year))]

      for (const year of years) {
        const deletedCount = await tx.receptionRecord.deleteMany({
          where: { clinicId, year }
        })
        console.log(`🗑️ ${year}년 기존 데이터 삭제: ${deletedCount.count}건`)
      }

      // 2. 배치 저장 (500건씩 청크)
      const chunks = chunkArray(recordsToSave, 500)
      console.log(`📦 ${chunks.length}개 청크로 분할 처리`)

      for (const [index, chunk] of chunks.entries()) {
        const result = await tx.receptionRecord.createMany({
          data: chunk,
          skipDuplicates: true
        })

        totalInserted += result.count
        console.log(`✅ 청크 ${index + 1}/${chunks.length} 완료: ${result.count}건`)
      }
    }, {
      maxWait: 10000,
      timeout: 120000
    })

    const batchEndTime = Date.now()
    const batchDuration = (batchEndTime - batchStartTime) / 1000

    console.log(`✅ 배치 저장 완료: ${totalInserted}건, ${batchDuration}초`)
    return { success: true, recordCount: totalInserted, duration: batchDuration }

  } catch (error) {
    console.error('❌ 배치 저장 실패:', error)
    throw error
  }
}

/**
 * 🔄 백그라운드 집계 생성
 */
async function generateAggregatesBackground(
  clinicId: string,
  dateRange: { start?: string; end?: string }
) {
  console.log(`📊 백그라운드 집계 시작: ${clinicId}`)

  try {
    const startDate = new Date(dateRange.start || '')
    const endDate = new Date(dateRange.end || '')

    // 월별 수익 집계
    const monthlyRevenues = await prisma.receptionRecord.groupBy({
      by: ['year', 'month'],
      where: {
        clinicId,
        receptionTime: { gte: startDate, lte: endDate }
      },
      _sum: { totalRevenue: true },
      _count: { id: true }
    })

    // 배치 Upsert로 수익 데이터 저장
    for (const monthData of monthlyRevenues) {
      await prisma.dailyLedger.upsert({
        where: {
          clinicId_date: {
            clinicId,
            date: new Date(monthData.year, monthData.month - 1, 1)
          }
        },
        update: {
          totalIncome: monthData._sum.totalRevenue || 0,
          netTotal: monthData._sum.totalRevenue || 0,
          updatedAt: new Date()
        },
        create: {
          clinicId,
          date: new Date(monthData.year, monthData.month - 1, 1),
          year: monthData.year,
          month: monthData.month,
          totalIncome: monthData._sum.totalRevenue || 0,
          totalExpense: 0,
          netTotal: monthData._sum.totalRevenue || 0
        }
      })
    }

    // 월별 요약 업데이트
    for (const summary of monthlyRevenues) {
      await prisma.monthlySummary.upsert({
        where: {
          clinicId_year_month: {
            clinicId,
            year: summary.year,
            month: summary.month
          }
        },
        update: {
          totalRevenue: summary._sum.totalRevenue || 0,
          totalPatients: summary._count.id || 0,
          updatedAt: new Date()
        },
        create: {
          clinicId,
          year: summary.year,
          month: summary.month,
          totalRevenue: summary._sum.totalRevenue || 0,
          totalPatients: summary._count.id || 0
        }
      })
    }

    // 캐시 무효화
    try {
      await fetch(`${process.env.NEXTAUTH_URL}/api/excel-upload/refresh-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId })
      })
      console.log('🔄 캐시 무효화 완료')
    } catch (cacheError) {
      console.error('❌ 캐시 무효화 실패:', cacheError)
    }

    console.log(`✅ 백그라운드 집계 완료: ${clinicId}`)

  } catch (error) {
    console.error(`❌ 백그라운드 집계 실패: ${clinicId}`, error)
    throw error
  }
}