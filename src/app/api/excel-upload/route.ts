import { NextRequest, NextResponse } from 'next/server'
import { denyClinic, logDataUpload } from "@/lib/requests/access"
import { auth } from '@/auth'
import * as XLSX from 'xlsx'
import OpenAI from 'openai'
import { createHash } from 'crypto'

// OpenAI GPT 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// 제외할 컬럼명들 (헤더명 기준)
const EXCLUDE_COLUMN_NAMES = [
  '차트번호', '이름', '본인확인', '진료시작', '진료완료', '담당의사', '담당직원', '체어',
  '전화번호', '진료 / 예약내역', '진료의사', '집계의사', '수납자', '공단부담', '본인부담',
  '비급여', '부가세', '할인액', '카드수납', '현금수납', '기타(온라인)', '현영발행',
  '건생비', '당일미수', '총미수금', '메모', '고객성향'
]

// 표준 필드 매핑
const STANDARD_FIELD_MAPPING = {
  '접수시각': 'receptionTime',
  '상태': 'status',
  '연령성별': 'ageGenderRaw',
  '보험구분': 'insuranceType',
  '신구': 'patientType',
  '대기': 'waitingMinutes',
  '예약시각': 'reservationTimeRaw',
  '총진료비': 'totalRevenue',
  '최초내원': 'firstVisitDate',
  '내원경로': 'visitRoute',
  '고객구분': 'customerType',
  '고객구분2': 'customerType2',
  '리콜구분': 'recallType'
}

// 차트번호 해시 생성
function createPatientKey(clinicId: string, chartNumber: string): string {
  return createHash('sha256').update(clinicId + chartNumber).digest('hex')
}

// 직접 엑셀 데이터 파싱 함수
function parseExcelDataDirectly(
  filteredData: any[][],
  chartMapping: Array<{originalIndex: number, patientKey: string}>,
  clinicId: string
) {
  if (!filteredData || filteredData.length <= 1) {
    throw new Error('처리할 데이터가 없습니다.')
  }

  const headers = filteredData[0] || []
  const dataRows = filteredData.slice(1)

  console.log('📋 헤더:', headers)
  console.log('📊 데이터 행 수:', dataRows.length)

  // 헤더 인덱스 매핑
  const headerMap: Record<string, number> = {}
  headers.forEach((header: string, index: number) => {
    if (header && typeof header === 'string') {
      headerMap[header.trim()] = index
    }
  })

  console.log('🔍 헤더 매핑:', headerMap)

  const receptionRecords: any[] = []
  let totalRevenue = 0
  let minDate: Date | null = null
  let maxDate: Date | null = null

  dataRows.forEach((row, rowIndex) => {
    try {
      if (!Array.isArray(row)) return

      // 원본 데이터 보존
      const rawIncludedData: Record<string, any> = {}
      headers.forEach((header: string, colIndex: number) => {
        if (header && row[colIndex] !== undefined) {
          rawIncludedData[header] = row[colIndex]
        }
      })

      // 표준 필드 매핑
      const record: any = {
        rawIncludedData
      }

      // 접수시각 처리
      const receptionTimeIndex = headers.findIndex(h =>
        h && (h.includes('접수') && h.includes('시각')) || h.includes('접수일시')
      )
      if (receptionTimeIndex >= 0 && row[receptionTimeIndex]) {
        const receptionTime = parseDateTime(row[receptionTimeIndex])
        record.receptionTime = receptionTime?.toISOString()
        if (receptionTime) {
          if (!minDate || receptionTime < minDate) minDate = receptionTime
          if (!maxDate || receptionTime > maxDate) maxDate = receptionTime
        }
      }

      // 상태
      const statusIndex = headers.findIndex(h => h && h.includes('상태'))
      if (statusIndex >= 0) {
        record.status = String(row[statusIndex] || '')
      }

      // 연령성별 처리
      const ageGenderIndex = headers.findIndex(h =>
        h && (h.includes('연령') || h.includes('성별'))
      )
      if (ageGenderIndex >= 0) {
        const ageGenderRaw = String(row[ageGenderIndex] || '')
        record.ageGenderRaw = ageGenderRaw

        // 연령과 성별 분리
        const ageMatch = ageGenderRaw.match(/(\d+)/)
        const age = ageMatch ? parseInt(ageMatch[1]) : 0
        record.age = age

        const genderMatch = ageGenderRaw.match(/[남여MF]/)
        record.gender = genderMatch ? (genderMatch[0] === '남' || genderMatch[0] === 'M' ? '남' : '여') : ''

        record.ageGroup = age > 0 ? `${Math.floor(age / 10) * 10}대` : '미상'
      }

      // 보험구분
      const insuranceIndex = headers.findIndex(h => h && h.includes('보험'))
      if (insuranceIndex >= 0) {
        record.insuranceType = String(row[insuranceIndex] || '')
      }

      // 신구 (신환/구환)
      const patientTypeIndex = headers.findIndex(h => h && h.includes('신구'))
      if (patientTypeIndex >= 0) {
        record.patientType = String(row[patientTypeIndex] || '')
      }

      // 대기시간
      const waitingIndex = headers.findIndex(h => h && h.includes('대기'))
      if (waitingIndex >= 0) {
        record.waitingMinutes = parseNumber(row[waitingIndex])
      }

      // 예약시각
      const reservationIndex = headers.findIndex(h =>
        h && (h.includes('예약') && h.includes('시각'))
      )
      if (reservationIndex >= 0) {
        record.reservationTimeRaw = String(row[reservationIndex] || '')
      }

      // 총진료비
      const revenueIndex = headers.findIndex(h =>
        h && (h.includes('총') && h.includes('진료비')) || h.includes('총액')
      )
      if (revenueIndex >= 0) {
        const revenue = parseNumber(row[revenueIndex])
        record.totalRevenue = revenue
        totalRevenue += revenue
      }

      // 최초내원
      const firstVisitIndex = headers.findIndex(h =>
        h && (h.includes('최초') && h.includes('내원'))
      )
      if (firstVisitIndex >= 0 && row[firstVisitIndex]) {
        const firstVisitDate = parseDateTime(row[firstVisitIndex])
        record.firstVisitDate = firstVisitDate?.toISOString()?.split('T')[0]
      }

      // 내원경로
      const visitRouteIndex = headers.findIndex(h =>
        h && (h.includes('내원') && h.includes('경로'))
      )
      if (visitRouteIndex >= 0) {
        record.visitRoute = String(row[visitRouteIndex] || '')
      }

      // 고객구분
      const customerTypeIndex = headers.findIndex(h =>
        h && h.includes('고객구분') && !h.includes('2')
      )
      if (customerTypeIndex >= 0) {
        record.customerType = String(row[customerTypeIndex] || '')
      }

      // 고객구분2
      const customerType2Index = headers.findIndex(h =>
        h && h.includes('고객구분2')
      )
      if (customerType2Index >= 0) {
        record.customerType2 = String(row[customerType2Index] || '')
      }

      // 리콜구분
      const recallTypeIndex = headers.findIndex(h =>
        h && h.includes('리콜')
      )
      if (recallTypeIndex >= 0) {
        record.recallType = String(row[recallTypeIndex] || '')
      }

      receptionRecords.push(record)

    } catch (error) {
      console.error(`❌ 행 ${rowIndex + 1} 파싱 오류:`, error)
    }
  })

  const summary = {
    totalRecords: receptionRecords.length,
    totalRevenue,
    uniquePatients: chartMapping.length, // 차트번호 해시 기준
    dateRange: {
      start: minDate?.toISOString()?.split('T')[0],
      end: maxDate?.toISOString()?.split('T')[0]
    }
  }

  return {
    dataType: '접수수납' as const,
    receptionRecords,
    summary,
    chartMapping
  }
}

// 유틸리티 함수들
function parseDateTime(value: any): Date | null {
  if (!value) return null

  try {
    // Excel 날짜 시리얼 번호 처리
    if (typeof value === 'number') {
      return new Date((value - 25569) * 86400 * 1000)
    }

    // 문자열 날짜 처리
    if (typeof value === 'string') {
      return new Date(value)
    }

    return null
  } catch {
    return null
  }
}

function parseNumber(value: any): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }
  return 0
}

// 헤더명 기반 필터링 함수
function filterExcelData(rawData: any[], clinicId: string) {
  if (!rawData || rawData.length === 0) {
    return { filteredData: [], chartMapping: [], excludedInfo: [] }
  }

  const headers = rawData[0] || []
  console.log('🔍 원본 헤더:', headers)

  // 헤더명 기준으로 제외할 인덱스 찾기
  const excludeIndices: number[] = []
  const chartNumberIndex = headers.findIndex((header: string) =>
    header && (header.includes('차트') || header.includes('번호'))
  )

  headers.forEach((header: string, index: number) => {
    if (header && EXCLUDE_COLUMN_NAMES.some(excludeName =>
      header.includes(excludeName) || excludeName.includes(header.trim())
    )) {
      excludeIndices.push(index)
    }
  })

  // fallback: 원본 컬럼 문자 기준 (C,D,H,J,K...)
  const fallbackExcludeIndices = [2, 3, 7, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 36]

  console.log('🔍 헤더명 기준 제외 인덱스:', excludeIndices)
  console.log('🔍 차트번호 인덱스:', chartNumberIndex)

  // 차트번호 매핑 생성 (해시 처리)
  const chartMapping: Array<{originalIndex: number, patientKey: string}> = []

  // 데이터 필터링
  const filteredData = rawData.map((row, rowIndex) => {
    if (!Array.isArray(row)) return row

    // 차트번호 해시 처리
    if (rowIndex > 0 && chartNumberIndex >= 0 && row[chartNumberIndex]) {
      const patientKey = createPatientKey(clinicId, String(row[chartNumberIndex]))
      chartMapping.push({
        originalIndex: rowIndex,
        patientKey
      })
    }

    // 제외할 컬럼들 필터링 (헤더명 우선, fallback으로 문자 기준)
    const finalExcludeIndices = excludeIndices.length > 0 ? excludeIndices : fallbackExcludeIndices

    return row.filter((cell, index) => !finalExcludeIndices.includes(index))
  })

  const excludedInfo = {
    headerBasedExcludes: excludeIndices,
    fallbackExcludes: excludeIndices.length === 0 ? fallbackExcludeIndices : [],
    chartNumberIndex,
    excludedHeaders: excludeIndices.map(i => headers[i]).filter(Boolean)
  }

  return { filteredData, chartMapping, excludedInfo }
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // FormData에서 파일 추출
    const formData = await request.formData()
    const file = formData.get('file') as File
    const clinicId = formData.get('clinicId') as string

    if (!file) {
      return NextResponse.json({ error: '파일이 선택되지 않았습니다.' }, { status: 400 })
    }

    if (!clinicId) {
      return NextResponse.json({ error: '클리닉 ID가 없습니다.' }, { status: 400 })
    }

    // 담당 치과 확인(본문이 multipart 라 프록시가 clinicId 를 볼 수 없다)
    const denied = await denyClinic(clinicId)
    if (denied) return denied
    await logDataUpload(clinicId, "DATA_UPLOAD_PARSE", { fileName: file.name, size: file.size })

    // 파일 확장자 확인
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls'].includes(fileExtension || '')) {
      return NextResponse.json({ error: '엑셀 파일만 업로드 가능합니다.' }, { status: 400 })
    }

    // 파일을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 엑셀 파일 파싱
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // JSON으로 변환
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: '엑셀 파일에 데이터가 없습니다.' }, { status: 400 })
    }

    console.log('📊 원본 데이터 크기:', rawData.length, 'x', rawData[0]?.length || 0)

    // 헤더명 기반 데이터 필터링
    const { filteredData, chartMapping, excludedInfo } = filterExcelData(rawData, clinicId)

    console.log('📊 필터링된 데이터 크기:', filteredData.length, 'x', filteredData[0]?.length || 0)
    console.log('🔍 제외된 정보:', excludedInfo)
    console.log('👥 차트번호 매핑 수:', chartMapping.length)

    // 직접 엑셀 데이터 파싱 (GPT 없이)
    console.log('🔧 직접 데이터 파싱 시작...')

    const structuredData = parseExcelDataDirectly(filteredData, chartMapping, clinicId)

    console.log('✅ 직접 파싱 완료:', {
      recordCount: structuredData.receptionRecords.length,
      totalRevenue: structuredData.summary.totalRevenue
    })

    // 파싱 결과 검증
    if (!structuredData.receptionRecords || structuredData.receptionRecords.length === 0) {
      throw new Error('파싱된 접수수납 레코드가 없습니다.')
    }

    console.log('데이터 분석 완료:', {
      dataType: structuredData.dataType,
      patientCount: structuredData.patients?.length,
      revenueCount: structuredData.revenue?.length
    })

    // 0건 저장 검증
    const recordCount = structuredData.receptionRecords?.length || 0
    if (recordCount === 0) {
      return NextResponse.json({
        error: '처리된 접수수납 레코드가 0건입니다. 데이터를 확인해주세요.',
        details: '유효한 데이터 행이 없거나 형식이 올바르지 않습니다.',
        rawDataCount: rawData.length,
        filteredDataCount: filteredData.length
      }, { status: 400 })
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      clinicId,
      rawDataCount: rawData.length,
      filteredDataCount: filteredData.length,
      processedRecords: recordCount,
      excludedInfo,
      chartMappingCount: chartMapping.length,
      structuredData: {
        ...structuredData,
        chartMapping // 차트번호 해시 매핑 정보 추가
      },
      processedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('엑셀 업로드 처리 오류:', error)
    return NextResponse.json({
      error: '파일 처리 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: '엑셀 업로드 API',
    methods: ['POST'],
    requiredFields: ['file', 'clinicId']
  })
}