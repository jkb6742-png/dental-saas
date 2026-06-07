import {
  PeiExcelRow,
  PeiAnalysisResult,
  DoctorComments,
  StaffComments,
  FacilityComments,
  ItemMapping,
  STANDARD_ITEMS,
  STATUS_THRESHOLDS,
  MEANINGLESS_RESPONSES
} from './types'

export class PeiDataAnalyzer {
  private rows: PeiExcelRow[]
  private targetYear: number
  private targetMonth: number
  private previousData?: PeiExcelRow[]

  constructor(rows: PeiExcelRow[], year: number, month: number, previousData?: PeiExcelRow[]) {
    this.rows = rows
    this.targetYear = year
    this.targetMonth = month
    this.previousData = previousData
  }

  /**
   * 전체 분석 실행
   */
  analyze(): PeiAnalysisResult {
    // 실제 데이터의 연월 감지
    const dataMonths = this.detectDataMonths(this.rows)
    console.log('📅 감지된 데이터 기간:', dataMonths)

    // 해당 월 데이터만 필터링
    let targetMonthData = this.filterByMonth(this.rows, this.targetYear, this.targetMonth)

    // 데이터가 없으면 첫 번째 실제 데이터 기간을 사용
    if (targetMonthData.length === 0 && dataMonths.length > 0) {
      console.log(`⚠️ ${this.targetYear}년 ${this.targetMonth}월 데이터가 없습니다. 실제 데이터: ${dataMonths[0].year}년 ${dataMonths[0].month}월 사용`)

      this.targetYear = dataMonths[0].year
      this.targetMonth = dataMonths[0].month
      targetMonthData = this.filterByMonth(this.rows, this.targetYear, this.targetMonth)
    }

    if (targetMonthData.length === 0) {
      throw new Error(`엑셀 파일에서 유효한 날짜가 포함된 데이터를 찾을 수 없습니다. 감지된 기간: ${dataMonths.map(d => `${d.year}년 ${d.month}월`).join(', ') || '없음'}`)
    }

    console.log(`📊 분석 대상: ${this.targetYear}년 ${this.targetMonth}월 (${targetMonthData.length}개 응답)`)

    // 기본 통계
    const responseCount = targetMonthData.length
    const genderDistribution = this.analyzeGenderDistribution(targetMonthData)
    const ageDistribution = this.analyzeAgeDistribution(targetMonthData)

    // 항목별 점수 계산
    const itemScores = this.calculateItemScores(targetMonthData)
    const overallScore = this.calculateOverallScore(itemScores)
    const statusBadge = this.determineStatusBadge(overallScore)

    // 전월 비교
    const previousMonthComparison = this.calculatePreviousComparison()

    // 주관식 의견 분석
    const doctorComments = this.analyzeDoctorComments(targetMonthData)
    const staffComments = this.analyzeStaffComments(targetMonthData)
    const facilityComments = this.analyzeFacilityComments(targetMonthData)
    const namedStaffMembers = this.extractNamedStaff(targetMonthData)

    return {
      surveyMonth: `${this.targetYear}.${String(this.targetMonth).padStart(2, '0')}`,
      responseCount,
      genderDistribution,
      ageDistribution,
      itemScores,
      overallScore: Math.round(overallScore * 100) / 100, // 소수점 2자리
      statusBadge,
      previousMonthComparison,
      doctorComments,
      staffComments,
      facilityComments,
      namedStaffMembers
    }
  }

  /**
   * 실제 데이터에 있는 연월 감지
   */
  private detectDataMonths(rows: PeiExcelRow[]): { year: number, month: number, count: number }[] {
    const monthCounts = new Map<string, { year: number, month: number, count: number }>()

    rows.forEach(row => {
      if (!row.timestamp) return

      try {
        const date = new Date(row.timestamp)
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear()
          const month = date.getMonth() + 1
          const key = `${year}-${month}`

          if (monthCounts.has(key)) {
            monthCounts.get(key)!.count++
          } else {
            monthCounts.set(key, { year, month, count: 1 })
          }
        }
      } catch {
        // 날짜 파싱 실패시 문자열로 시도
        const dateMatch = row.timestamp.match(/(\d{4})[/-](\d{1,2})/)
        if (dateMatch) {
          const year = parseInt(dateMatch[1])
          const month = parseInt(dateMatch[2])
          const key = `${year}-${month}`

          if (monthCounts.has(key)) {
            monthCounts.get(key)!.count++
          } else {
            monthCounts.set(key, { year, month, count: 1 })
          }
        }
      }
    })

    return Array.from(monthCounts.values())
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year // 년도 내림차순
        return b.month - a.month // 월 내림차순
      })
  }

  /**
   * 월별 데이터 필터링
   */
  private filterByMonth(rows: PeiExcelRow[], year: number, month: number): PeiExcelRow[] {
    return rows.filter(row => {
      if (!row.timestamp) return false

      try {
        const date = new Date(row.timestamp)
        return date.getFullYear() === year && date.getMonth() + 1 === month
      } catch {
        // 날짜 파싱 실패시 문자열로 시도
        const dateMatch = row.timestamp.match(/(\d{4})-(\d{1,2})/)
        if (dateMatch) {
          return parseInt(dateMatch[1]) === year && parseInt(dateMatch[2]) === month
        }
        return false
      }
    })
  }

  /**
   * 성별 분포 분석
   */
  private analyzeGenderDistribution(data: PeiExcelRow[]): { male: number, female: number } {
    const male = data.filter(row => row.gender === '남성').length
    const female = data.filter(row => row.gender === '여성').length

    return { male, female }
  }

  /**
   * 연령 분포 분석
   */
  private analyzeAgeDistribution(data: PeiExcelRow[]): string {
    const ageGroups = {
      '10대': 0,
      '20대': 0,
      '30대': 0,
      '40대': 0,
      '50대': 0,
      '60대': 0,
      '70대 이상': 0
    }

    data.forEach(row => {
      const ageStr = row.age
      if (!ageStr) return

      const ageNum = parseInt(ageStr.replace(/[^0-9]/g, ''))
      if (ageNum < 20) ageGroups['10대']++
      else if (ageNum < 30) ageGroups['20대']++
      else if (ageNum < 40) ageGroups['30대']++
      else if (ageNum < 50) ageGroups['40대']++
      else if (ageNum < 60) ageGroups['50대']++
      else if (ageNum < 70) ageGroups['60대']++
      else ageGroups['70대 이상']++
    })

    // 가장 많은 연령대 찾기
    const maxGroup = Object.entries(ageGroups)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])

    if (maxGroup.length === 0) return '연령 정보 없음'
    if (maxGroup.length === 1) return `${maxGroup[0][0]} 중심`

    return `${maxGroup[0][0]}~${maxGroup[1][0]} 중심`
  }

  /**
   * 항목별 점수 계산
   */
  private calculateItemScores(data: PeiExcelRow[]): { [key: string]: number } {
    const scores: { [key: string]: number } = {}

    STANDARD_ITEMS.forEach(item => {
      const validRatings = data
        .map(row => row.ratings[item.key])
        .filter(rating => rating !== null && rating !== undefined && !isNaN(rating))

      if (validRatings.length === 0) {
        scores[item.key] = 0
      } else {
        const sum = validRatings.reduce((acc, rating) => acc + rating, 0)
        scores[item.key] = Math.round((sum / validRatings.length) * 100) / 100
      }
    })

    return scores
  }

  /**
   * 종합 점수 계산 (항목 평균들의 단순 평균)
   */
  private calculateOverallScore(itemScores: { [key: string]: number }): number {
    const validScores = Object.values(itemScores).filter(score => score > 0)
    if (validScores.length === 0) return 0

    const sum = validScores.reduce((acc, score) => acc + score, 0)
    return sum / validScores.length
  }

  /**
   * 상태 배지 결정
   */
  private determineStatusBadge(overallScore: number): 'excellent' | 'good' | 'needsImprovement' {
    if (overallScore >= STATUS_THRESHOLDS.excellent) return 'excellent'
    if (overallScore >= STATUS_THRESHOLDS.good) return 'good'
    return 'needsImprovement'
  }

  /**
   * 전월 비교 계산
   */
  private calculatePreviousComparison() {
    if (!this.previousData) return undefined

    const prevYear = this.targetMonth === 1 ? this.targetYear - 1 : this.targetYear
    const prevMonth = this.targetMonth === 1 ? 12 : this.targetMonth - 1

    const previousMonthData = this.filterByMonth(this.previousData, prevYear, prevMonth)
    if (previousMonthData.length === 0) return undefined

    const prevItemScores = this.calculateItemScores(previousMonthData)
    const prevOverallScore = this.calculateOverallScore(prevItemScores)

    const currentItemScores = this.calculateItemScores(
      this.filterByMonth(this.rows, this.targetYear, this.targetMonth)
    )
    const currentOverallScore = this.calculateOverallScore(currentItemScores)

    // 증감 계산
    const changes: { [key: string]: number } = {}
    STANDARD_ITEMS.forEach(item => {
      const prev = prevItemScores[item.key] || 0
      const curr = currentItemScores[item.key] || 0
      changes[item.key] = Math.round((curr - prev) * 100) / 100
    })

    const overallChange = Math.round((currentOverallScore - prevOverallScore) * 100) / 100

    return {
      month: `${prevYear}.${String(prevMonth).padStart(2, '0')}`,
      scores: prevItemScores,
      overallScore: Math.round(prevOverallScore * 100) / 100,
      changes,
      overallChange
    }
  }

  /**
   * 의료진별 주관식 의견 분석
   */
  private analyzeDoctorComments(data: PeiExcelRow[]): DoctorComments[] {
    const doctorComments: { [key: string]: DoctorComments } = {}

    data.forEach(row => {
      const doctor = row.doctor || '기타'
      if (!doctorComments[doctor]) {
        doctorComments[doctor] = {
          name: doctor,
          responseCount: 0,
          positiveComments: [],
          negativeComments: []
        }
      }

      doctorComments[doctor].responseCount++

      // 긍정적 의견
      if (row.positiveComment && this.isValidComment(row.positiveComment)) {
        doctorComments[doctor].positiveComments.push(row.positiveComment)
      }

      // 부정적 의견
      if (row.negativeComment && this.isValidComment(row.negativeComment)) {
        doctorComments[doctor].negativeComments.push(row.negativeComment)
      }
    })

    return Object.values(doctorComments).filter(dc => dc.responseCount > 0)
  }

  /**
   * 스탭 관련 주관식 의견 분석
   */
  private analyzeStaffComments(data: PeiExcelRow[]): StaffComments {
    const positiveComments: string[] = []
    const negativeComments: string[] = []

    data.forEach(row => {
      // 스탭 관련 키워드가 포함된 의견 필터링
      if (row.positiveComment && this.containsStaffKeywords(row.positiveComment)) {
        positiveComments.push(row.positiveComment)
      }

      if (row.negativeComment && this.containsStaffKeywords(row.negativeComment)) {
        negativeComments.push(row.negativeComment)
      }
    })

    return { positiveComments, negativeComments }
  }

  /**
   * 시설 관련 주관식 의견 분석
   */
  private analyzeFacilityComments(data: PeiExcelRow[]): FacilityComments {
    const positiveComments: string[] = []
    const negativeComments: string[] = []

    data.forEach(row => {
      // 시설 관련 키워드가 포함된 의견 필터링
      if (row.positiveComment && this.containsFacilityKeywords(row.positiveComment)) {
        positiveComments.push(row.positiveComment)
      }

      if (row.negativeComment && this.containsFacilityKeywords(row.negativeComment)) {
        negativeComments.push(row.negativeComment)
      }
    })

    return { positiveComments, negativeComments }
  }

  /**
   * 이름이 언급된 직원 추출
   */
  private extractNamedStaff(data: PeiExcelRow[]): string[] {
    const namedStaff = new Set<string>()
    const namePatterns = [
      /([가-힣]{2,3})\s*(선생님|님|씨)/g,
      /([가-힣]{2,3})\s*(치위생사|간호사|직원)/g
    ]

    data.forEach(row => {
      const allComments = [row.positiveComment, row.negativeComment].join(' ')

      namePatterns.forEach(pattern => {
        const matches = allComments.matchAll(pattern)
        for (const match of matches) {
          if (match[1] && match[1].length >= 2) {
            namedStaff.add(match[1])
          }
        }
      })
    })

    return Array.from(namedStaff)
  }

  /**
   * 유효한 의견인지 확인
   */
  private isValidComment(comment: string): boolean {
    if (!comment || comment.trim() === '') return false

    const cleaned = comment.trim().toLowerCase()
    return !MEANINGLESS_RESPONSES.includes(cleaned) && cleaned.length > 1
  }

  /**
   * 스탭 관련 키워드 포함 여부
   */
  private containsStaffKeywords(comment: string): boolean {
    const staffKeywords = ['치위생사', '간호사', '직원', '스태프', '데스크', '접수', '수납']
    return staffKeywords.some(keyword => comment.includes(keyword))
  }

  /**
   * 시설 관련 키워드 포함 여부
   */
  private containsFacilityKeywords(comment: string): boolean {
    const facilityKeywords = ['시설', '주차', '대기실', '화장실', '청결', '환경', '공간', '위치']
    return facilityKeywords.some(keyword => comment.includes(keyword))
  }
}