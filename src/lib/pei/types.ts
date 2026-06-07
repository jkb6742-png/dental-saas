// PEI 보고서 관련 타입 정의

export interface PeiExcelRow {
  timestamp: string
  gender: string
  age: string
  doctor: string
  ratings: { [key: string]: any }
  positiveComment: string
  negativeComment: string
}

export interface PeiStandardItem {
  key: string
  name: string
  description: string
}

// 표준 평가 항목
export const STANDARD_ITEMS: PeiStandardItem[] = [
  { key: 'phone_response', name: '전화 및 온라인 응대', description: '전화/카카오톡 응대' },
  { key: 'reception_service', name: '접수 수납 응대', description: '접수·수납 데스크 응대' },
  { key: 'consultation_service', name: '치료 상담 응대', description: '치료 상담(상담 직원)' },
  { key: 'doctor_consultation', name: '의료진 진료 상담', description: '의사 진료에 대한 상담' },
  { key: 'clinical_staff_service', name: '진료실 직원 만족도', description: '치위생사 응대' },
  { key: 'doctor_service', name: '의료진 진료 응대', description: '진료 시 의사 응대' },
  { key: 'facility_satisfaction', name: '시설 만족도', description: '시설·주차' },
  { key: 'parking_facility', name: '주차 시설', description: '주차 편의성' },
  { key: 'website_usability', name: '홈페이지', description: '홈페이지 이용 편의' },
  { key: 'waiting_time', name: '진료 대기시간', description: '대기시간' },
  { key: 'recommendation_intent', name: '지인 권유 의향', description: '추천 의향' }
]

export interface ItemMapping {
  standardKey: string
  excelColumn: string
  columnIndex: number
}

export interface PeiAnalysisResult {
  surveyMonth: string
  responseCount: number
  genderDistribution: { male: number, female: number }
  ageDistribution: string
  itemScores: { [key: string]: number }
  overallScore: number
  statusBadge: 'excellent' | 'good' | 'needsImprovement'
  previousMonthComparison?: {
    month: string
    scores: { [key: string]: number }
    overallScore: number
    changes: { [key: string]: number }
    overallChange: number
  }
  doctorComments: DoctorComments[]
  staffComments: StaffComments
  facilityComments: FacilityComments
  namedStaffMembers: string[]
}

export interface DoctorComments {
  name: string
  specialty?: string
  responseCount: number
  positiveComments: string[]
  negativeComments: string[]
}

export interface StaffComments {
  positiveComments: string[]
  negativeComments: string[]
}

export interface FacilityComments {
  positiveComments: string[]
  negativeComments: string[]
}

export interface ReportMetadata {
  clinicName: string
  year: number
  month: number
  reportDate: string
}

// 평점 환산 규칙
export const RATING_CONVERSION = {
  '매우 그렇다': 5,
  '그렇다': 4,
  '보통이다': 3,
  '그렇지 않다': 2,
  '전혀 그렇지 않다': 1
} as const

// 제외할 무의미 응답
export const MEANINGLESS_RESPONSES = [
  '없음', '없어요', '없습니다', 'x', 'X', '-', '.', '만족', '좋습니다', 'perfect',
  '', ' ', 'N/A', 'n/a', 'na', 'NA'
]

// 상태 배지 기준
export const STATUS_THRESHOLDS = {
  excellent: 4.85,
  good: 4.50
} as const