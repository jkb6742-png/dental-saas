import { google } from 'googleapis'

export class GoogleSheetsClient {
  private auth: any
  private sheets: any

  constructor() {
    // 서비스 계정 키 또는 OAuth 설정
    this.auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    })

    this.sheets = google.sheets({ version: 'v4', auth: this.auth })
  }

  /**
   * 스프레드시트 ID에서 데이터 추출
   */
  async extractSheetId(sheetUrl: string): string {
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!match) {
      throw new Error('올바른 구글 스프레드시트 URL이 아닙니다')
    }
    return match[1]
  }

  /**
   * 스프레드시트 메타데이터 조회
   */
  async getSpreadsheetInfo(spreadsheetId: string) {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
      })

      return {
        title: response.data.properties?.title,
        sheets: response.data.sheets?.map((sheet: any) => ({
          sheetId: sheet.properties?.sheetId,
          title: sheet.properties?.title,
          gridProperties: sheet.properties?.gridProperties
        }))
      }
    } catch (error) {
      console.error('스프레드시트 정보 조회 실패:', error)
      throw new Error('스프레드시트에 접근할 수 없습니다. 공유 설정을 확인하세요.')
    }
  }

  /**
   * 시트 데이터 조회
   */
  async getSheetData(spreadsheetId: string, sheetName: string = 'Sheet1', range?: string) {
    try {
      const fullRange = range || `${sheetName}!A:Z`

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: fullRange,
      })

      return {
        values: response.data.values || [],
        range: response.data.range,
        majorDimension: response.data.majorDimension
      }
    } catch (error) {
      console.error('시트 데이터 조회 실패:', error)
      throw new Error(`시트 데이터를 읽을 수 없습니다: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 마지막 업데이트 시간 이후 새로운 데이터가 있는지 확인
   */
  async hasNewData(spreadsheetId: string, sheetName: string, lastSyncAt?: Date): Promise<boolean> {
    try {
      const data = await this.getSheetData(spreadsheetId, sheetName)

      if (!data.values || data.values.length <= 1) {
        return false // 헤더만 있거나 데이터 없음
      }

      // lastSyncAt가 없으면 새로운 설정이므로 true
      if (!lastSyncAt) {
        return true
      }

      // 첫 번째 열이 타임스탬프라고 가정
      // 마지막 행의 타임스탬프를 확인
      const lastRowIndex = data.values.length - 1
      const lastRow = data.values[lastRowIndex]

      if (!lastRow || !lastRow[0]) {
        return false
      }

      // 타임스탬프 파싱 시도
      try {
        const lastResponseTime = new Date(lastRow[0])
        return lastResponseTime > lastSyncAt
      } catch {
        // 타임스탬프 파싱 실패시 데이터 행 수로 판단
        // 간단히 마지막 동기화 이후 새로운 행이 추가되었는지 확인
        return true
      }
    } catch (error) {
      console.error('새 데이터 확인 실패:', error)
      return false
    }
  }

  /**
   * 시트 데이터를 PEI 엑셀 형식으로 변환
   */
  convertSheetDataToPeiFormat(sheetData: string[][]): any[] {
    if (!sheetData || sheetData.length < 2) {
      throw new Error('시트에 충분한 데이터가 없습니다 (최소 헤더 + 1행 필요)')
    }

    const headers = sheetData[0]
    const dataRows = sheetData.slice(1)

    return dataRows.map(row => {
      const rowData: any = {}

      headers.forEach((header, index) => {
        rowData[header] = row[index] || ''
      })

      return rowData
    })
  }

  /**
   * 시트 접근 권한 테스트
   */
  async testAccess(spreadsheetId: string, sheetName?: string): Promise<{ success: boolean, message: string }> {
    try {
      await this.getSpreadsheetInfo(spreadsheetId)

      if (sheetName) {
        await this.getSheetData(spreadsheetId, sheetName, `${sheetName}!A1:B2`)
      }

      return {
        success: true,
        message: '구글 스프레드시트에 성공적으로 접근했습니다.'
      }
    } catch (error) {
      return {
        success: false,
        message: `접근 실패: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}