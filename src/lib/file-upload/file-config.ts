// 파일 업로드 설정 및 명명 규칙

export enum FileCategory {
  MONTHLY_LEDGER = 'MONTHLY_LEDGER',
  ANNUAL_LEDGER = 'ANNUAL_LEDGER',
  TREATMENT_STATS = 'TREATMENT_STATS',
  IMPLANT_STATS = 'IMPLANT_STATS',
  COMPREHENSIVE_PATIENTS = 'COMPREHENSIVE_PATIENTS', // 신환+구환 통합
  AGE_DISTRIBUTION = 'AGE_DISTRIBUTION',
  REGION_DISTRIBUTION = 'REGION_DISTRIBUTION',
  DAILY_PATIENTS = 'DAILY_PATIENTS',
  VISIT_ROUTES = 'VISIT_ROUTES'
}

export enum FileStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DUPLICATE = 'DUPLICATE'
}

// 파일 카테고리별 메타데이터
export interface FileCategoryConfig {
  key: FileCategory
  name: string
  description: string
  isMonthly: boolean
  standardFileName: (year: number, month?: number) => string
  exampleFileName: string
  requiredColumns: string[]
  allowedExtensions: string[]
}

export const FILE_CATEGORIES: Record<FileCategory, FileCategoryConfig> = {
  [FileCategory.MONTHLY_LEDGER]: {
    key: FileCategory.MONTHLY_LEDGER,
    name: '월간장부',
    description: '매월 매출, 수입, 지출 데이터',
    isMonthly: true,
    standardFileName: (year, month) => `${year}년${month}월월간장부.xlsx`,
    exampleFileName: '2026년5월월간장부.xlsx',
    requiredColumns: ['날짜', '현금수입', '카드수입', '보험청구', '현금지출', '카드지출'],
    allowedExtensions: ['.xlsx', '.xls']
  },

  [FileCategory.ANNUAL_LEDGER]: {
    key: FileCategory.ANNUAL_LEDGER,
    name: '연간장부',
    description: '연간 종합 매출 데이터',
    isMonthly: false,
    standardFileName: (year) => `${year}년연간장부.xlsx`,
    exampleFileName: '2026년연간장부.xlsx',
    requiredColumns: ['월', '총매출', '순이익'],
    allowedExtensions: ['.xlsx', '.xls']
  },

  [FileCategory.TREATMENT_STATS]: {
    key: FileCategory.TREATMENT_STATS,
    name: '수가별통계',
    description: '진료항목별 통계 데이터',
    isMonthly: true,
    standardFileName: (year, month) => `${year}년${String(month).padStart(2, '0')}월진료항목별통계.xlsx`,
    exampleFileName: '2026년05월진료항목별통계.xlsx',
    requiredColumns: ['항목명', '환자수', '내원수', '진료비'],
    allowedExtensions: ['.xlsx', '.xls']
  },

  [FileCategory.IMPLANT_STATS]: {
    key: FileCategory.IMPLANT_STATS,
    name: '임플란트수술통계',
    description: '임플란트 수술 통계 데이터',
    isMonthly: true,
    standardFileName: (year, month) => `${year}년${String(month).padStart(2, '0')}월임플란트수술통계.xlsx`,
    exampleFileName: '2026년05월임플란트수술통계.xlsx',
    requiredColumns: ['픽스처명', '수술수', '사용수'],
    allowedExtensions: ['.xlsx', '.xls']
  },

  [FileCategory.COMPREHENSIVE_PATIENTS]: {
    key: FileCategory.COMPREHENSIVE_PATIENTS,
    name: '전체접수수납',
    description: '신환+구환 통합 접수수납목록 데이터 (연간)',
    isMonthly: false,
    standardFileName: (year) => `${year}년전체접수수납목록.xlsx`,
    exampleFileName: '2026년전체접수수납목록.xlsx',
    requiredColumns: [
      '접수시각', '차트번호', '이름', '연령성별', '신구',
      '총진료비', '공단부담', '본인부담', '비급여',
      '카드수납', '현금수납', '기타(온라인)', '내원경로'
    ],
    allowedExtensions: ['.xlsx', '.xls']
  },

  [FileCategory.AGE_DISTRIBUTION]: {
    key: FileCategory.AGE_DISTRIBUTION,
    name: '연령별분포',
    description: '내원환자 연령별 분포 데이터',
    isMonthly: true,
    standardFileName: (year, month) => `${year}년${String(month).padStart(2, '0')}월내원환자연령분포.xlsx`,
    exampleFileName: '2026년05월내원환자연령분포.xlsx',
    requiredColumns: ['연령대', '총환자수', '구환수', '신환수'],
    allowedExtensions: ['.xlsx', '.xls']
  },

  [FileCategory.REGION_DISTRIBUTION]: {
    key: FileCategory.REGION_DISTRIBUTION,
    name: '지역별분포',
    description: '내원환자 지역별 분포 데이터',
    isMonthly: true,
    standardFileName: (year, month) => `${year}년${String(month).padStart(2, '0')}월내원환자지역별분포.xlsx`,
    exampleFileName: '2026년05월내원환자지역별분포.xlsx',
    requiredColumns: ['지역명', '총환자수', '구환수', '신환수'],
    allowedExtensions: ['.xlsx', '.xls']
  },

  [FileCategory.DAILY_PATIENTS]: {
    key: FileCategory.DAILY_PATIENTS,
    name: '일별접수환자수',
    description: '일별 접수환자수 통계 데이터',
    isMonthly: true,
    standardFileName: (year, month) => `${year}년${String(month).padStart(2, '0')}월일별접수환자수.xlsx`,
    exampleFileName: '2026년05월일별접수환자수.xlsx',
    requiredColumns: ['날짜', '근무일수', '신환수', '총내원수'],
    allowedExtensions: ['.xlsx', '.xls']
  },

  [FileCategory.VISIT_ROUTES]: {
    key: FileCategory.VISIT_ROUTES,
    name: '내원경로분포',
    description: '내원환자 내원경로 분포 데이터',
    isMonthly: true,
    standardFileName: (year, month) => `${year}년${String(month).padStart(2, '0')}월내원환자내원경로분포.xlsx`,
    exampleFileName: '2026년05월내원환자내원경로분포.xlsx',
    requiredColumns: ['내원경로', '총내원자수', '구환수', '신환수'],
    allowedExtensions: ['.xlsx', '.xls']
  }
}

// 월별 필수 파일 체크리스트
export const getMonthlyRequiredFiles = (year: number, month: number): string[] => {
  return Object.values(FILE_CATEGORIES)
    .filter(config => config.isMonthly)
    .map(config => config.standardFileName(year, month))
}

// 연간 필수 파일 체크리스트
export const getAnnualRequiredFiles = (year: number): string[] => {
  return Object.values(FILE_CATEGORIES)
    .filter(config => !config.isMonthly)
    .map(config => config.standardFileName(year))
}

// 파일명으로 카테고리 감지
export const detectFileCategory = (fileName: string): FileCategory | null => {
  const lowerFileName = fileName.toLowerCase()

  console.log(`🔍 파일명 분석: "${fileName}" → "${lowerFileName}"`)

  // 🔥 연간장부 강화된 감지 (정확한 패턴 매칭)
  if (lowerFileName.includes('연간장부') ||
      lowerFileName.match(/\d{4}연간장부/) ||
      lowerFileName.match(/연간.*장부/) ||
      lowerFileName.match(/annual.*ledger/)) {
    console.log(`✅ 연간장부 감지 - "${fileName}"`)
    return FileCategory.ANNUAL_LEDGER
  }

  // 월간장부는 연간장부가 아닌 경우에만
  if (lowerFileName.includes('월간장부') && !lowerFileName.includes('연간')) {
    console.log(`✅ 월간장부 감지 - "${fileName}"`)
    return FileCategory.MONTHLY_LEDGER
  }
  if (lowerFileName.includes('진료항목별통계') || lowerFileName.includes('수가별')) {
    console.log(`✅ 진료항목별통계 감지`)
    return FileCategory.TREATMENT_STATS
  }
  if (lowerFileName.includes('임플란트수술통계')) {
    console.log(`✅ 임플란트수술통계 감지`)
    return FileCategory.IMPLANT_STATS
  }
  if (lowerFileName.includes('전체접수수납목록')) {
    console.log(`✅ 전체접수수납목록 감지`)
    return FileCategory.COMPREHENSIVE_PATIENTS
  }
  if (lowerFileName.includes('연령분포') || lowerFileName.includes('연령별')) {
    console.log(`✅ 연령별분포 감지 - 연령분포: ${lowerFileName.includes('연령분포')}, 연령별: ${lowerFileName.includes('연령별')}`)
    return FileCategory.AGE_DISTRIBUTION
  }
  if (lowerFileName.includes('지역분포') || lowerFileName.includes('지역별')) {
    console.log(`✅ 지역별분포 감지`)
    return FileCategory.REGION_DISTRIBUTION
  }
  if (lowerFileName.includes('일별접수환자수') || lowerFileName.includes('접수환자수')) {
    console.log(`✅ 일별접수환자수 감지`)
    return FileCategory.DAILY_PATIENTS
  }
  if (lowerFileName.includes('내원경로분포') || lowerFileName.includes('내원경로')) {
    console.log(`✅ 내원경로분포 감지`)
    return FileCategory.VISIT_ROUTES
  }

  console.log(`❌ 카테고리 감지 실패 - 지원하지 않는 파일명`)
  return null
}

// 파일명에서 연도/월 추출
export const extractDateFromFileName = (fileName: string): { year: number, month?: number } | null => {
  // 2026년5월 형태
  const monthMatch = fileName.match(/(\d{4})년(\d{1,2})월/)
  if (monthMatch) {
    return {
      year: parseInt(monthMatch[1]),
      month: parseInt(monthMatch[2])
    }
  }

  // 2026년 형태 (연간)
  const yearMatch = fileName.match(/(\d{4})년/)
  if (yearMatch) {
    return {
      year: parseInt(yearMatch[1])
    }
  }

  return null
}

// 파일 크기 제한 (bytes)
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// 허용된 MIME 타입
export const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel' // .xls
]