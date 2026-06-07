import crypto from 'crypto'
import * as XLSX from 'xlsx'
import { FileCategory, detectFileCategory, extractDateFromFileName, FILE_CATEGORIES } from './file-config'

// 파일 체크섬 계산
export const calculateFileChecksum = (buffer: Buffer): string => {
  return crypto.createHash('md5').update(buffer).digest('hex')
}

// 파일명 검증
export const validateFileName = (fileName: string): {
  isValid: boolean
  category?: FileCategory
  year?: number
  month?: number
  suggestedName?: string
  errors: string[]
} => {
  const errors: string[] = []

  // 확장자 체크
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
  if (!['.xlsx', '.xls'].includes(ext)) {
    errors.push('Excel 파일(.xlsx, .xls)만 업로드 가능합니다.')
  }

  // 카테고리 감지
  const category = detectFileCategory(fileName)
  if (!category) {
    errors.push('파일명에서 카테고리를 감지할 수 없습니다.')
    return { isValid: false, errors }
  }

  // 날짜 추출
  const dateInfo = extractDateFromFileName(fileName)
  if (!dateInfo) {
    errors.push('파일명에서 연도/월 정보를 찾을 수 없습니다.')
    return { isValid: false, category, errors }
  }

  const config = FILE_CATEGORIES[category]

  // 월별 파일인데 월 정보가 없는 경우
  if (config.isMonthly && !dateInfo.month) {
    errors.push(`${config.name}은 월별 파일이므로 월 정보가 필요합니다.`)
  }

  // 연간 파일인데 월 정보가 있는 경우
  if (!config.isMonthly && dateInfo.month) {
    errors.push(`${config.name}은 연간 파일이므로 월 정보가 불필요합니다.`)
  }

  // 표준 파일명 생성
  const suggestedName = config.standardFileName(dateInfo.year, dateInfo.month)

  return {
    isValid: errors.length === 0,
    category,
    year: dateInfo.year,
    month: dateInfo.month,
    suggestedName,
    errors
  }
}

// Excel 파일 파싱
export const parseExcelFile = (buffer: Buffer): {
  success: boolean
  data?: any[][]
  columns?: string[]
  rowCount?: number
  error?: string
} => {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const firstSheetName = workbook.SheetNames[0]

    if (!firstSheetName) {
      return { success: false, error: '시트를 찾을 수 없습니다.' }
    }

    const worksheet = workbook.Sheets[firstSheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

    if (jsonData.length === 0) {
      return { success: false, error: '파일에 데이터가 없습니다.' }
    }

    // 첫 번째 행을 컬럼명으로 사용
    const columns = jsonData[0] as string[]
    const data = jsonData.slice(1) // 헤더 제외한 데이터

    return {
      success: true,
      data,
      columns: columns.map(col => String(col).trim()),
      rowCount: data.length
    }
  } catch (error) {
    return {
      success: false,
      error: `파일 파싱 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    }
  }
}

// 컬럼 검증
export const validateColumns = (columns: string[], requiredColumns: string[]): {
  isValid: boolean
  missingColumns: string[]
  suggestions: string[]
} => {
  const normalizedColumns = columns.map(col =>
    col.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[()]/g, '')
  )

  const normalizedRequired = requiredColumns.map(col =>
    col.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[()]/g, '')
  )

  const missingColumns: string[] = []
  const suggestions: string[] = []

  for (const required of normalizedRequired) {
    const found = normalizedColumns.some(col =>
      col.includes(required) || required.includes(col)
    )

    if (!found) {
      const originalRequired = requiredColumns[normalizedRequired.indexOf(required)]
      missingColumns.push(originalRequired)

      // 유사한 컬럼명 찾기
      const similar = columns.find(col => {
        const normalized = col.toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '')
        return normalized.includes(required.substring(0, 2)) || required.includes(normalized.substring(0, 2))
      })

      if (similar) {
        suggestions.push(`'${originalRequired}' 대신 '${similar}'를 의도하셨나요?`)
      }
    }
  }

  return {
    isValid: missingColumns.length === 0,
    missingColumns,
    suggestions
  }
}

// 데이터 검증
export const validateFileData = (data: any[][], columns: string[], category: FileCategory): {
  isValid: boolean
  errors: string[]
  warnings: string[]
  validRowCount: number
} => {
  const errors: string[] = []
  const warnings: string[] = []
  let validRowCount = 0

  if (data.length === 0) {
    errors.push('파일에 데이터가 없습니다.')
    return { isValid: false, errors, warnings, validRowCount: 0 }
  }

  // 카테고리별 특수 검증 로직
  switch (category) {
    case FileCategory.MONTHLY_LEDGER:
      validRowCount = validateMonthlyLedgerData(data, columns, errors, warnings)
      break

    case FileCategory.COMPREHENSIVE_PATIENTS:
      validRowCount = validatePatientData(data, columns, errors, warnings)
      break

    case FileCategory.TREATMENT_STATS:
      validRowCount = validateTreatmentStatsData(data, columns, errors, warnings)
      break

    default:
      validRowCount = validateGenericData(data, columns, errors, warnings)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validRowCount
  }
}

// 월간장부 데이터 검증
const validateMonthlyLedgerData = (data: any[][], columns: string[], errors: string[], warnings: string[]): number => {
  let validRows = 0

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    // 날짜 컬럼 확인
    const dateCol = row[0]
    if (!dateCol) {
      warnings.push(`${i + 2}행: 날짜가 없습니다.`)
      continue
    }

    // 숫자 컬럼들 검증 (현금수입, 카드수입 등)
    let hasNumericData = false
    for (let j = 1; j < row.length; j++) {
      const value = row[j]
      if (value !== null && value !== undefined && value !== '' && !isNaN(Number(value))) {
        hasNumericData = true
        break
      }
    }

    if (!hasNumericData) {
      warnings.push(`${i + 2}행: 수치 데이터가 없습니다.`)
      continue
    }

    validRows++
  }

  if (validRows === 0) {
    errors.push('유효한 데이터 행이 없습니다.')
  }

  return validRows
}

// 환자 데이터 검증
const validatePatientData = (data: any[][], columns: string[], errors: string[], warnings: string[]): number => {
  let validRows = 0

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    // 환자명과 차트번호 중 하나는 있어야 함
    const hasPatientInfo = row.some(cell => cell && String(cell).trim().length > 0)

    if (!hasPatientInfo) {
      warnings.push(`${i + 2}행: 환자 정보가 없습니다.`)
      continue
    }

    validRows++
  }

  if (validRows === 0) {
    errors.push('유효한 환자 데이터가 없습니다.')
  }

  return validRows
}

// 진료통계 데이터 검증
const validateTreatmentStatsData = (data: any[][], columns: string[], errors: string[], warnings: string[]): number => {
  let validRows = 0

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    // 항목명이 있어야 함
    const itemName = row[0]
    if (!itemName || String(itemName).trim().length === 0) {
      warnings.push(`${i + 2}행: 항목명이 없습니다.`)
      continue
    }

    validRows++
  }

  if (validRows === 0) {
    errors.push('유효한 진료항목 데이터가 없습니다.')
  }

  return validRows
}

// 일반 데이터 검증
const validateGenericData = (data: any[][], columns: string[], errors: string[], warnings: string[]): number => {
  let validRows = 0

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    // 첫 번째 컬럼에 데이터가 있으면 유효한 행으로 간주
    if (row[0] && String(row[0]).trim().length > 0) {
      validRows++
    }
  }

  if (validRows === 0) {
    errors.push('유효한 데이터 행이 없습니다.')
  }

  return validRows
}