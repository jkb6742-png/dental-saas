import { google } from 'googleapis'

// Google Sheets API 클라이언트 인스턴스
let sheetsInstance: any = null

/**
 * Google Sheets API 클라이언트 초기화
 */
export function getGoogleSheetsClient() {
  // 개발 환경에서는 매번 새로운 인스턴스 생성 (캐시 문제 방지)
  if (process.env.NODE_ENV === 'development') {
    sheetsInstance = null
  }

  if (sheetsInstance) {
    return sheetsInstance
  }

  try {
    // 서비스 계정 인증 (환경변수에서 JSON 키 로드)
    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    if (!credentials) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set')
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credentials),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    sheetsInstance = google.sheets({ version: 'v4', auth })
    return sheetsInstance
  } catch (error) {
    console.error('Google Sheets 클라이언트 초기화 실패:', error)
    throw error
  }
}

/**
 * 스프레드시트 URL에서 시트 ID 추출
 */
export function extractSheetId(url: string): string | null {
  try {
    // Google Sheets URL 패턴: https://docs.google.com/spreadsheets/d/{SHEET_ID}/...
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    return match ? match[1] : null
  } catch (error) {
    console.error('시트 ID 추출 실패:', error)
    return null
  }
}

/**
 * 스프레드시트 메타데이터 조회 (시트 존재 확인)
 */
export async function getSpreadsheetMetadata(sheetId: string) {
  try {
    const sheets = getGoogleSheetsClient()
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'properties,sheets.properties'
    })

    return {
      title: response.data.properties?.title || '',
      sheetCount: response.data.sheets?.length || 0,
      sheets: response.data.sheets?.map((sheet: any) => ({
        id: sheet.properties?.sheetId,
        title: sheet.properties?.title,
        rowCount: sheet.properties?.gridProperties?.rowCount,
        columnCount: sheet.properties?.gridProperties?.columnCount
      })) || []
    }
  } catch (error) {
    console.error('스프레드시트 메타데이터 조회 실패:', error)
    throw error
  }
}

/**
 * 시트 데이터 읽기
 */
export async function readSheetData(sheetId: string, range: string = 'A1:Z1000') {
  try {
    console.log(`[SHEETS] 🔍 구글시트 읽기 시작:`)
    console.log(`  sheetId: ${sheetId}`)
    console.log(`  range: ${range}`)

    const sheets = getGoogleSheetsClient()
    console.log(`[SHEETS] ✅ 클라이언트 생성 완료`)

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    })

    console.log(`[SHEETS] ✅ API 응답 성공:`)
    console.log(`  응답 행수: ${response.data.values?.length || 0}`)
    console.log(`  응답 범위: ${response.data.range}`)
    console.log(`  첫 행 (헤더): `, response.data.values?.[0])
    console.log(`  두번째 행: `, response.data.values?.[1])

    const result = {
      values: response.data.values || [],
      range: response.data.range || '',
      majorDimension: response.data.majorDimension || 'ROWS'
    }

    console.log(`[SHEETS] 🎯 최종 결과: ${result.values.length}행 반환`)
    return result
  } catch (error: any) {
    console.error('❌ [SHEETS] 시트 데이터 읽기 실패:', error)
    console.error('❌ 에러 코드:', error.code)
    console.error('❌ 에러 메시지:', error.message)
    console.error('❌ 상세 에러:', error)
    throw error
  }
}

/**
 * PEI 데이터 파싱 (시트 데이터를 PEI 구조로 변환)
 */
export function parsePEIData(rawData: any[][], targetYear?: number, targetMonth?: number) {
  try {
    if (!rawData || rawData.length === 0) {
      throw new Error('빈 데이터입니다')
    }

    // 첫 번째 행을 헤더로 가정
    const headers = rawData[0] || []
    const rows = rawData.slice(1)

    console.log(`[PEI_PARSER] 헤더 정보 (${headers.length}개):`, headers)
    console.log(`[PEI_PARSER] 총 ${rows.length}개 행 데이터`)
    console.log(`[PEI_PARSER] 첫 3개 행 샘플:`, rows.slice(0, 3))

    // 📋 헤더 분석: 14번, 15번 컬럼 찾기
    console.log(`[PEI_PARSER] 🔍 헤더 상세 분석:`)
    headers.forEach((header, index) => {
      console.log(`  컬럼 ${index}: "${header}"`)
      if (header && (header.toString().includes('14') || header.toString().includes('15'))) {
        console.log(`    ⭐ 피드백 컬럼 발견!`)
      }
    })

    // 실제 시트 구조에 맞게 컬럼 매핑 개선
    const peiColumns = {
      timestamp: headers.findIndex(h => h && (h.toString().includes('타임스탬프') || h.toString().includes('날짜') || h.toString().includes('일시'))), // 0번
      gender: headers.findIndex(h => h && h.toString().includes('성별')), // 1번
      age: headers.findIndex(h => h && h.toString().includes('연령')), // 2번
      doctor: headers.findIndex(h => h && h.toString().includes('의료진')), // 3번 - 의료진 정보!
      // 4-13번 항목들 (점수)
      scores: [],
      // 🚨 O열, P열 직접 지정 (A=0, B=1, ..., O=14, P=15)
      feedback14: 14, // O열 (14번 인덱스)
      feedback15: 15, // P열 (15번 인덱스)
    }

    // 🔍 디버깅: O, P열 헤더 확인
    console.log(`[PEI_PARSER] 🎯 O열(14) 헤더: "${headers[14]}" (타입: ${typeof headers[14]})`)
    console.log(`[PEI_PARSER] 🎯 P열(15) 헤더: "${headers[15]}" (타입: ${typeof headers[15]})`)
    console.log(`[PEI_PARSER] 🎯 전체 헤더 길이: ${headers.length}개`)
    console.log(`[PEI_PARSER] 🎯 헤더 전체:`, headers)

    // 🔍 O, P열 데이터 샘플 확인
    console.log(`[PEI_PARSER] 🔍 첫 5개 행의 O, P열 원본 데이터:`)
    for (let i = 1; i <= Math.min(5, rows.length); i++) {
      const row = rows[i - 1]
      console.log(`  행${i+1}: O열="${row[14]}" (타입: ${typeof row[14]}), P열="${row[15]}" (타입: ${typeof row[15]})`)
      if (row[14]) console.log(`    O열 길이: ${String(row[14]).length}, 내용: [${String(row[14])}]`)
      if (row[15]) console.log(`    P열 길이: ${String(row[15]).length}, 내용: [${String(row[15])}]`)
    }

    // 4-13번 점수 항목들 찾기 (더 유연한 매핑)
    for (let i = 4; i <= 13; i++) {
      const colIndex = headers.findIndex(h => {
        if (!h) return false
        const headerStr = h.toString().trim()
        return (
          headerStr.includes(`${i}.`) ||
          headerStr.includes(`${i}번`) ||
          headerStr.includes(`항목${i}`) ||
          headerStr === i.toString() ||
          headerStr.includes(`문항 ${i}`) ||
          headerStr.includes(`Q${i}`) ||
          headerStr.includes(`질문${i}`)
        )
      })
      if (colIndex >= 0) {
        peiColumns.scores[i - 4] = colIndex // 0부터 시작하는 인덱스
        console.log(`[PEI_PARSER] ${i}번 항목 -> 컬럼 ${colIndex}: "${headers[colIndex]}"`)
      } else {
        console.warn(`[PEI_PARSER] ${i}번 항목을 찾을 수 없음`)
      }
    }

    // 헤더 매핑이 실패한 경우 컬럼 순서로 대체 매핑
    if (peiColumns.scores.filter(col => col >= 0).length < 5) {
      console.warn(`[PEI_PARSER] 헤더 매핑 실패, 컬럼 순서로 대체 매핑 시도`)
      // 일반적으로 3번 이후 컬럼들이 점수일 가능성이 높음
      for (let i = 0; i < 10; i++) {
        if (headers.length > i + 3) { // 3번 이후부터
          peiColumns.scores[i] = i + 3
          console.log(`[PEI_PARSER] 순서 매핑: 항목${i+4} -> 컬럼 ${i+3}: "${headers[i+3]}"`)
        }
      }
    }

    // 🔍 O, P열이 실제로 존재하는지 확인
    if (headers.length <= 14) {
      console.error(`[PEI_PARSER] ❌ O열(14)이 존재하지 않습니다! 현재 헤더 개수: ${headers.length}`)
      peiColumns.feedback14 = -1
    }
    if (headers.length <= 15) {
      console.error(`[PEI_PARSER] ❌ P열(15)이 존재하지 않습니다! 현재 헤더 개수: ${headers.length}`)
      peiColumns.feedback15 = -1
    }

    console.log(`[PEI_PARSER] 최종 컬럼 매핑:`, peiColumns)
    console.log(`[PEI_PARSER] 매핑된 점수 컬럼들:`, peiColumns.scores.filter(col => col >= 0))
    console.log(`[PEI_PARSER] 전체 헤더 (${headers.length}개):`, headers)

    // 데이터 변환 - 실제 시트 구조에 맞게 개선
    const parsedData = rows
      .filter(row => {
        // 빈 행이나 모든 값이 비어있는 행 제외
        return row && row.length > 0 && row.some(cell => cell !== null && cell !== undefined && cell !== '')
      })
      .map((row, index) => {
        // 타임스탬프 파싱
        const timestamp = peiColumns.timestamp >= 0 ? row[peiColumns.timestamp] : null
        let recordDate = null
        if (timestamp) {
          try {
            // "2025. 4. 15 오후 2:30:00" 형식 파싱
            const dateStr = String(timestamp)
            const dateMatch = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/)
            if (dateMatch) {
              const [, year, month, day] = dateMatch
              recordDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            }
          } catch (error) {
            console.warn('날짜 파싱 실패:', timestamp)
          }
        }

        // 4-13번 점수들 추출 (10개) - 더 안전한 파싱
        const scores = peiColumns.scores.map((colIndex, scoreIndex) => {
          if (colIndex >= 0 && colIndex < row.length && row[colIndex] !== undefined && row[colIndex] !== '') {
            const rawValue = row[colIndex]
            const score = parseFloat(rawValue)

            // 유효한 점수 범위 체크 (1-5점 또는 0-5점)
            if (!isNaN(score) && score >= 0 && score <= 5) {
              return score
            } else {
              console.warn(`[PEI_PARSER] 행${index+2}, 컬럼${colIndex} 잘못된 점수: "${rawValue}" -> ${score}`)
              return 0
            }
          }
          return 0
        })

        // 디버깅: 첫 3개 행의 점수 출력
        if (index < 3) {
          console.log(`[PEI_PARSER] 행${index+2} 점수:`, scores)
        }

        // 의료진 정보 추출
        const doctor = peiColumns.doctor >= 0 ? String(row[peiColumns.doctor] || '').trim() : ''

        // 14, 15번 의견 추출 (문자열로 안전하게 변환)
        const feedback14 = peiColumns.feedback14 >= 0 && row[peiColumns.feedback14]
          ? String(row[peiColumns.feedback14]).trim()
          : ''
        const feedback15 = peiColumns.feedback15 >= 0 && row[peiColumns.feedback15]
          ? String(row[peiColumns.feedback15]).trim()
          : ''

        // 🚨 강제 디버깅: 첫 10개 행의 O, P열 데이터 출력
        if (index < 10) {
          console.log(`[PEI_PARSER] 🔍 행${index+2} 상세 디버깅:`)
          console.log(`  원본 O열(14): "${row[14]}" (타입: ${typeof row[14]}, 길이: ${String(row[14] || '').length})`)
          console.log(`  원본 P열(15): "${row[15]}" (타입: ${typeof row[15]}, 길이: ${String(row[15] || '').length})`)
          console.log(`  파싱 후 feedback14: "${feedback14}"`)
          console.log(`  파싱 후 feedback15: "${feedback15}"`)
          console.log(`  행 전체 길이: ${row.length}`)

          // 실제 조건 확인
          const has14 = peiColumns.feedback14 >= 0 && row[peiColumns.feedback14]
          const has15 = peiColumns.feedback15 >= 0 && row[peiColumns.feedback15]
          console.log(`  조건 체크 - has14: ${has14}, has15: ${has15}`)

          if (feedback14 && feedback14.trim() !== '') {
            console.log(`  ✅ 14번 피드백 유효: "${feedback14}"`)
          }
          if (feedback15 && feedback15.trim() !== '') {
            console.log(`  ✅ 15번 피드백 유효: "${feedback15}"`)
          }
        }

        return {
          id: index + 1,
          timestamp: timestamp,
          recordDate: recordDate,
          gender: peiColumns.gender >= 0 ? row[peiColumns.gender] : null,
          age: peiColumns.age >= 0 ? row[peiColumns.age] : null,
          doctor: doctor, // 의료진 정보
          scores: scores, // 4-13번 점수 배열 (10개)
          feedback14: feedback14, // 14번 의견
          feedback15: feedback15, // 15번 의견
          // 기존 호환성을 위한 필드들
          satisfaction: scores[0] || 0, // 4번
          waitTime: scores[4] || 0, // 8번이 대기시간
          serviceScore: scores.slice(0, 6).reduce((sum, s) => sum + s, 0) / 6 || 0, // 4-9번 평균
          facilityScore: scores.slice(6, 9).reduce((sum, s) => sum + s, 0) / 3 || 0, // 10-12번 평균
          revisitIntention: scores[9] || 0 // 13번이 재방문 의향
        }
      })

    // 월별 필터링 및 유효한 레코드 필터링
    const validRecords = parsedData.filter(record => {
      // 월별 필터링 (targetYear, targetMonth가 지정된 경우)
      if (targetYear && targetMonth && record.recordDate) {
        const recordYear = record.recordDate.getFullYear()
        const recordMonth = record.recordDate.getMonth() + 1
        if (recordYear !== targetYear || recordMonth !== targetMonth) {
          return false
        }
      }

      // 점수가 하나라도 있거나, 의견이 있는 경우만 유효한 레코드로 판단
      const hasScore = record.scores.some(score => score > 0)
      const hasFeedback = (record.feedback14 && record.feedback14 !== '') ||
                         (record.feedback15 && record.feedback15 !== '')

      return hasScore || hasFeedback
    })

    console.log(`[PEI_PARSER] 월별 필터링 ${targetYear}년 ${targetMonth}월: ${validRecords.length}개 레코드`)
    if (targetYear && targetMonth) {
      console.log(`[PEI_PARSER] 필터링된 첫 3개:`, validRecords.slice(0, 3).map(r => ({
        date: r.timestamp,
        recordDate: r.recordDate,
        doctor: r.doctor,
        feedback14: r.feedback14?.substring(0, 50),
        feedback15: r.feedback15?.substring(0, 50)
      })))
    }

    console.log(`[PEI_PARSER] 유효한 레코드: ${validRecords.length}개`)
    console.log(`[PEI_PARSER] 첫 번째 유효 레코드:`, validRecords[0])

    // 📊 피드백 데이터 통계
    const feedback14Count = validRecords.filter(r => r.feedback14 && r.feedback14.trim() !== '').length
    const feedback15Count = validRecords.filter(r => r.feedback15 && r.feedback15.trim() !== '').length
    console.log(`[PEI_PARSER] 📝 최종 피드백 통계:`)
    console.log(`  전체 유효 레코드: ${validRecords.length}개`)
    console.log(`  14번 의견 (O열): ${feedback14Count}개`)
    console.log(`  15번 의견 (P열): ${feedback15Count}개`)

    // 🚨 만약 피드백이 0개라면 원본 데이터 재확인
    if (feedback14Count === 0 && feedback15Count === 0) {
      console.error(`❌ [PEI_PARSER] 피드백이 전혀 수집되지 않았습니다!`)
      console.error(`❌ 원본 데이터 재확인:`)
      console.error(`  첫 번째 데이터 행 O열: "${rows[0]?.[14]}"`)
      console.error(`  첫 번째 데이터 행 P열: "${rows[0]?.[15]}"`)
      console.error(`  두 번째 데이터 행 O열: "${rows[1]?.[14]}"`)
      console.error(`  두 번째 데이터 행 P열: "${rows[1]?.[15]}"`)
    }

    if (feedback14Count > 0) {
      console.log(`[PEI_PARSER] 📝 14번 의견 샘플:`, validRecords.filter(r => r.feedback14).slice(0, 2).map(r => ({
        doctor: r.doctor,
        feedback14: r.feedback14?.substring(0, 50) + '...'
      })))
    }

    if (feedback15Count > 0) {
      console.log(`[PEI_PARSER] 📝 15번 의견 샘플:`, validRecords.filter(r => r.feedback15).slice(0, 2).map(r => ({
        doctor: r.doctor,
        feedback15: r.feedback15?.substring(0, 50) + '...'
      })))
    }

    const totalRecords = validRecords.length

    // 성별 분포 계산
    const genderCounts = { male: 0, female: 0, unknown: 0 }
    validRecords.forEach(record => {
      const gender = record.gender ? String(record.gender).toLowerCase().trim() : ''
      if (gender.includes('남') || gender.includes('male')) {
        genderCounts.male++
      } else if (gender.includes('여') || gender.includes('female')) {
        genderCounts.female++
      } else {
        genderCounts.unknown++
      }
    })

    console.log(`[PEI_PARSER] 성별 분포:`, genderCounts)

    // 4-13번 점수 항목별 평균 계산 (실제 평가 항목만)
    const itemAverages = []
    const validScoreCounts = []

    for (let i = 0; i < 10; i++) { // 4-13번 항목 = 10개
      const validScores = validRecords
        .map(record => record.scores[i])
        .filter(score => score > 0 && score <= 5) // 1-5점만 유효

      validScoreCounts[i] = validScores.length
      itemAverages[i] = validScores.length > 0
        ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
        : 0

      console.log(`[PEI_PARSER] 항목${i+4}: ${validScores.length}개 응답, 평균 ${itemAverages[i].toFixed(2)}점`)
    }

    console.log(`[PEI_PARSER] 항목별 평균 (4-13번):`, itemAverages.map(a => a.toFixed(2)))

    // 전체 평균 점수 계산 - 각 항목의 평균을 다시 평균내기 (5.0 만점 보장)
    const validItemAverages = itemAverages.filter(avg => avg > 0)
    const overallAverage = validItemAverages.length > 0
      ? validItemAverages.reduce((sum, avg) => sum + avg, 0) / validItemAverages.length
      : 0

    // 5.0을 넘는 경우 강제 제한
    const finalOverallAverage = Math.min(overallAverage, 5.0)

    console.log(`[PEI_PARSER] 유효 항목수: ${validItemAverages.length}개`)
    console.log(`[PEI_PARSER] 계산된 평균: ${overallAverage.toFixed(2)}`)
    console.log(`[PEI_PARSER] 최종 평균 (5.0 제한): ${finalOverallAverage.toFixed(2)}`)

    if (overallAverage > 5.0) {
      console.warn(`[PEI_PARSER] ⚠️ 평균 점수가 5.0을 초과함: ${overallAverage.toFixed(2)} -> 5.0으로 제한`)
    }

    // 카테고리별 평균 (4-13번 기준으로 재정의)
    const avgSatisfaction = itemAverages.slice(0, 3).reduce((sum, avg) => sum + avg, 0) / 3 || 0 // 4-6번
    const avgServiceScore = itemAverages.slice(0, 6).reduce((sum, avg) => sum + avg, 0) / 6 || 0 // 4-9번
    const avgFacilityScore = itemAverages.slice(6, 9).reduce((sum, avg) => sum + avg, 0) / 3 || 0 // 10-12번
    const avgRevisitIntention = itemAverages[9] || 0 // 13번

    console.log(`[PEI_PARSER] 카테고리별 평균 - 만족도: ${avgSatisfaction}, 서비스: ${avgServiceScore}, 시설: ${avgFacilityScore}, 재방문: ${avgRevisitIntention}`)

    // 전체 PEI 점수는 제한된 평균 사용 (5.0 이하 보장)
    const peiScore = finalOverallAverage

    return {
      summary: {
        totalRecords,
        peiScore: Math.round(peiScore * 100) / 100,
        overallAverage: Math.round(finalOverallAverage * 100) / 100,
        itemAverages: itemAverages.map(avg => Math.round(avg * 100) / 100),
        genderCounts, // 성별 분포 추가
        avgSatisfaction: Math.round(avgSatisfaction * 100) / 100,
        avgServiceScore: Math.round(avgServiceScore * 100) / 100,
        avgFacilityScore: Math.round(avgFacilityScore * 100) / 100,
        avgRevisitIntention: Math.round(avgRevisitIntention * 100) / 100
      },
      records: parsedData,
      feedbackData: {
        // 모든 14번 긍정 의견 (원문 그대로)
        feedback14: validRecords
          .filter(r => r.feedback14 && r.feedback14.trim() !== '')
          .map(r => ({
            content: r.feedback14,
            doctor: r.doctor,
            date: r.timestamp
          })),
        // 모든 15번 부정 의견 (원문 그대로)
        feedback15: validRecords
          .filter(r => r.feedback15 && r.feedback15.trim() !== '')
          .map(r => ({
            content: r.feedback15,
            doctor: r.doctor,
            date: r.timestamp
          })),
        // 의료진별 피드백 분류
        byDoctor: (() => {
          const doctorFeedback: { [key: string]: { positive: string[], negative: string[] } } = {}

          validRecords.forEach(record => {
            const doctor = record.doctor || '미지정'
            if (!doctorFeedback[doctor]) {
              doctorFeedback[doctor] = { positive: [], negative: [] }
            }

            if (record.feedback14 && record.feedback14.trim() !== '') {
              doctorFeedback[doctor].positive.push(record.feedback14)
            }

            if (record.feedback15 && record.feedback15.trim() !== '') {
              doctorFeedback[doctor].negative.push(record.feedback15)
            }
          })

          return doctorFeedback
        })()
      },
      columns: peiColumns,
      headers
    }
  } catch (error) {
    console.error('PEI 데이터 파싱 실패:', error)
    throw error
  }
}

/**
 * 구글 시트 연결 테스트
 */
export async function testSheetConnection(sheetId: string): Promise<{
  success: boolean
  message: string
  metadata?: any
}> {
  try {
    const metadata = await getSpreadsheetMetadata(sheetId)
    return {
      success: true,
      message: `연결 성공: "${metadata.title}" (${metadata.sheetCount}개 시트)`,
      metadata
    }
  } catch (error: any) {
    let message = '연결 실패'

    if (error.code === 404) {
      message = '스프레드시트를 찾을 수 없습니다. URL을 확인해주세요.'
    } else if (error.code === 403) {
      message = '접근 권한이 없습니다. 시트를 공유 설정에서 편집자로 추가해주세요.'
    } else if (error.message.includes('GOOGLE_SERVICE_ACCOUNT_KEY')) {
      message = 'Google 인증 설정이 필요합니다.'
    } else {
      message = `연결 실패: ${error.message}`
    }

    return {
      success: false,
      message
    }
  }
}