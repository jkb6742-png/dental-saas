import * as XLSX from 'xlsx'
import {
  PeiExcelRow,
  ItemMapping,
  STANDARD_ITEMS,
  RATING_CONVERSION,
  MEANINGLESS_RESPONSES
} from './types'

export class PeiExcelParser {
  private workbook: XLSX.WorkBook | null = null
  private worksheet: XLSX.WorkSheet | null = null
  private headers: string[] = []
  private itemMappings: ItemMapping[] = []

  /**
   * 엑셀 파일 로드 및 초기 분석
   */
  async loadExcel(buffer: Buffer): Promise<void> {
    try {
      this.workbook = XLSX.read(buffer, { type: 'buffer' })

      // 첫 번째 시트 사용
      const sheetName = this.workbook.SheetNames[0]
      this.worksheet = this.workbook.Sheets[sheetName]

      // 헤더 추출
      this.extractHeaders()

      // 표준 항목 매핑
      this.mapStandardItems()

    } catch (error) {
      throw new Error(`엑셀 파일 로드 실패: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 1행 헤더 추출
   */
  private extractHeaders(): void {
    if (!this.worksheet) throw new Error('워크시트가 로드되지 않음')

    const range = XLSX.utils.decode_range(this.worksheet['!ref'] || 'A1:A1')
    this.headers = []

    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      const cell = this.worksheet[cellAddress]
      this.headers.push(cell ? String(cell.v || '') : '')
    }
  }

  /**
   * 표준 항목에 엑셀 컬럼 매핑
   */
  private mapStandardItems(): void {
    this.itemMappings = []

    STANDARD_ITEMS.forEach(standardItem => {
      // 헤더에서 가장 유사한 컬럼 찾기
      const matchedIndex = this.findBestHeaderMatch(standardItem.description)

      if (matchedIndex !== -1) {
        this.itemMappings.push({
          standardKey: standardItem.key,
          excelColumn: this.headers[matchedIndex],
          columnIndex: matchedIndex
        })
      }
    })

    console.log('📋 매핑된 평가 항목:', this.itemMappings)
  }

  /**
   * 헤더에서 가장 유사한 항목 찾기
   */
  private findBestHeaderMatch(description: string): number {
    const keywords = this.extractKeywords(description)
    let bestMatch = -1
    let bestScore = 0

    this.headers.forEach((header, index) => {
      if (!header || header.trim() === '') return

      let score = 0
      keywords.forEach(keyword => {
        if (header.includes(keyword)) {
          score += keyword.length
        }
      })

      if (score > bestScore) {
        bestScore = score
        bestMatch = index
      }
    })

    return bestMatch
  }

  /**
   * 설명에서 키워드 추출
   */
  private extractKeywords(description: string): string[] {
    const keywordMap: { [key: string]: string[] } = {
      '전화/카카오톡 응대': ['전화', '카카오톡', '응대'],
      '접수·수납 데스크 응대': ['접수', '수납', '데스크'],
      '치료 상담(상담 직원)': ['상담', '직원'],
      '의사 진료에 대한 상담': ['의사', '진료', '상담'],
      '치위생사 응대': ['치위생사', '응대'],
      '진료 시 의사 응대': ['진료', '의사', '응대'],
      '시설·주차': ['시설', '주차'],
      '주차 편의성': ['주차'],
      '홈페이지 이용 편의': ['홈페이지'],
      '대기시간': ['대기시간'],
      '추천 의향': ['추천', '권유']
    }

    return keywordMap[description] || [description]
  }

  /**
   * 모든 데이터 행 파싱
   */
  parseAllRows(): PeiExcelRow[] {
    if (!this.worksheet) throw new Error('워크시트가 로드되지 않음')

    const range = XLSX.utils.decode_range(this.worksheet['!ref'] || 'A1:A1')
    const rows: PeiExcelRow[] = []

    // 2행부터 시작 (1행은 헤더)
    for (let rowNum = 1; rowNum <= range.e.r; rowNum++) {
      const row = this.parseRow(rowNum)
      if (row) rows.push(row)
    }

    return rows
  }

  /**
   * 특정 행 파싱
   */
  private parseRow(rowNum: number): PeiExcelRow | null {
    if (!this.worksheet) return null

    const row: any = {}
    const range = XLSX.utils.decode_range(this.worksheet['!ref'] || 'A1:A1')

    // 각 컬럼 값 추출
    for (let col = 0; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: col })
      const cell = this.worksheet[cellAddress]
      row[this.headers[col] || `col_${col}`] = cell ? cell.v : ''
    }

    // 필수 필드 체크
    if (!row[this.headers[0]]) return null // 타임스탬프가 없으면 빈 행

    // 표준 형식으로 변환
    const timestamp = this.parseTimestamp(row[this.headers[0]])
    const gender = this.parseGender(row[this.headers[1]])
    const age = this.parseAge(row[this.headers[2]])
    const doctor = this.parseDoctor(row[this.headers[3]])

    // 평가 항목 점수 추출
    const ratings: { [key: string]: any } = {}
    this.itemMappings.forEach(mapping => {
      const rawValue = row[mapping.excelColumn]
      ratings[mapping.standardKey] = this.convertRating(rawValue)
    })

    // 주관식 의견 (마지막 2개 컬럼)
    const lastTwoColumns = this.headers.slice(-2)
    const positiveComment = row[lastTwoColumns[0]] || ''
    const negativeComment = row[lastTwoColumns[1]] || ''

    return {
      timestamp,
      gender,
      age,
      doctor,
      ratings,
      positiveComment: this.cleanComment(positiveComment),
      negativeComment: this.cleanComment(negativeComment)
    }
  }

  /**
   * 타임스탬프 파싱
   */
  private parseTimestamp(value: any): string {
    if (!value) return ''

    // 엑셀 날짜 시리얼 번호인 경우
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value)
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
    }

    return String(value)
  }

  /**
   * 성별 파싱
   */
  private parseGender(value: any): string {
    const str = String(value || '').toLowerCase()
    if (str.includes('남') || str.includes('male')) return '남성'
    if (str.includes('여') || str.includes('female')) return '여성'
    return str
  }

  /**
   * 연령 파싱
   */
  private parseAge(value: any): string {
    if (!value) return ''
    const str = String(value)

    // 숫자만 있는 경우 "세" 추가
    if (/^\d+$/.test(str)) {
      return `${str}세`
    }

    return str
  }

  /**
   * 의료진 파싱
   */
  private parseDoctor(value: any): string {
    if (!value) return ''
    return String(value).trim()
  }

  /**
   * 평점 환산 (텍스트 → 5점 척도)
   */
  private convertRating(value: any): number | null {
    if (!value || value === '' || value === 0) return null

    const str = String(value).trim()

    // 무의미 응답 체크
    if (MEANINGLESS_RESPONSES.includes(str.toLowerCase())) {
      return null
    }

    // 텍스트 평점 변환
    if (str in RATING_CONVERSION) {
      return RATING_CONVERSION[str as keyof typeof RATING_CONVERSION]
    }

    // 숫자인 경우
    const num = parseFloat(str)
    if (!isNaN(num)) {
      // 10점 척도면 5점으로 환산
      if (num > 5 && num <= 10) {
        return num / 2
      }
      // 1-5점 척도면 그대로 사용
      if (num >= 1 && num <= 5) {
        return num
      }
    }

    return null
  }

  /**
   * 주관식 의견 정리
   */
  private cleanComment(comment: any): string {
    if (!comment) return ''

    let cleaned = String(comment).trim()

    // 무의미 응답 필터링
    if (MEANINGLESS_RESPONSES.some(meaningless =>
      cleaned.toLowerCase() === meaningless.toLowerCase()
    )) {
      return ''
    }

    return cleaned
  }

  /**
   * 매핑 정보 반환
   */
  getMappings(): ItemMapping[] {
    return this.itemMappings
  }

  /**
   * 헤더 정보 반환
   */
  getHeaders(): string[] {
    return this.headers
  }
}