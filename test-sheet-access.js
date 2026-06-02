const { google } = require('googleapis')
require('dotenv/config')

async function testSheetAccess() {
  const sheetId = '1YwFnZ_ohzU8Nns2HFQd7ZZ07rmPG3JLvuKks-Jfb-yA'

  try {
    console.log('🔍 구글 시트 API 클라이언트 초기화 중...')

    // 서비스 계정 인증
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)

    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    console.log('✅ 인증 완료')

    console.log('🔍 시트 메타데이터 조회 중...')
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'properties,sheets.properties'
    })

    console.log('✅ 시트 정보:')
    console.log('- 제목:', metadata.data.properties.title)
    console.log('- 시트 개수:', metadata.data.sheets.length)
    console.log('- 시트 목록:')

    metadata.data.sheets.forEach((sheet, index) => {
      console.log(`  ${index + 1}. "${sheet.properties.title}" (ID: ${sheet.properties.sheetId})`)
      console.log(`     행: ${sheet.properties.gridProperties?.rowCount || '?'}, 열: ${sheet.properties.gridProperties?.columnCount || '?'}`)
    })

    // 첫 번째 시트의 데이터 일부 읽어보기
    const firstSheetName = metadata.data.sheets[0].properties.title
    console.log(`\n🔍 "${firstSheetName}" 시트 데이터 읽기 시도...`)

    try {
      const values = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${firstSheetName}!A1:E10`,
        valueRenderOption: 'UNFORMATTED_VALUE'
      })

      console.log('✅ 데이터 읽기 성공!')
      console.log('- 범위:', values.data.range)
      console.log('- 행 수:', values.data.values?.length || 0)

      if (values.data.values && values.data.values.length > 0) {
        console.log('- 첫 번째 행:', values.data.values[0])
        if (values.data.values.length > 1) {
          console.log('- 두 번째 행:', values.data.values[1])
        }
      }
    } catch (readError) {
      console.error('❌ 데이터 읽기 실패:', readError.message)
    }

  } catch (error) {
    console.error('❌ 시트 접근 실패:', error.message)
    if (error.code) {
      console.error('- 에러 코드:', error.code)
    }
    if (error.details) {
      console.error('- 세부사항:', error.details)
    }
  }
}

testSheetAccess()