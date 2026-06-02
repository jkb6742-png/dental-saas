import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { readSheetData, parsePEIData, testSheetConnection, extractSheetId } from "@/lib/googleSheets"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clinicId = searchParams.get('clinicId')
    const range = searchParams.get('range') || 'A1:Z1000' // 기본 읽기 범위
    const testConnection = searchParams.get('test') === 'true'
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined

    if (!clinicId) {
      return NextResponse.json({ error: "clinicId가 필요합니다" }, { status: 400 })
    }

    // 해당 치과의 시트 설정 조회
    const sheetConfig = await prisma.peiSheetConfig.findUnique({
      where: { clinicId },
      include: {
        clinic: {
          select: { name: true }
        }
      }
    })

    if (!sheetConfig) {
      return NextResponse.json({
        error: "설정된 구글 시트가 없습니다",
        needsConfig: true
      }, { status: 404 })
    }

    if (!sheetConfig.isActive) {
      return NextResponse.json({
        error: "비활성화된 시트 설정입니다"
      }, { status: 400 })
    }

    // 연결 테스트만 하는 경우
    if (testConnection) {
      const connectionTest = await testSheetConnection(sheetConfig.sheetId)
      return NextResponse.json({
        success: connectionTest.success,
        message: connectionTest.message,
        metadata: connectionTest.metadata,
        config: {
          sheetUrl: sheetConfig.sheetUrl,
          sheetName: sheetConfig.sheetName,
          lastSyncAt: sheetConfig.lastSyncAt
        }
      })
    }

    console.log(`[PEI_DATA] ${sheetConfig.clinic.name} 시트 데이터 조회 시작`)

    // 시트 데이터 읽기
    const fullRange = sheetConfig.sheetName
      ? `${sheetConfig.sheetName}!${range}`
      : range

    const rawData = await readSheetData(sheetConfig.sheetId, fullRange)

    if (!rawData.values || rawData.values.length === 0) {
      return NextResponse.json({
        error: "시트에 데이터가 없습니다",
        isEmpty: true,
        config: {
          sheetUrl: sheetConfig.sheetUrl,
          sheetName: sheetConfig.sheetName,
          range: fullRange
        }
      }, { status: 404 })
    }

    console.log(`[PEI_DATA] 원본 데이터: ${rawData.values.length}행`)

    // PEI 데이터 파싱 및 분석 (월별 필터링 적용)
    const peiData = parsePEIData(rawData.values, year, month)

    console.log(`[PEI_DATA] 파싱 완료: 전체 ${rawData.values.length}행 → 필터링 후 ${peiData.summary.totalRecords}개 레코드`)

    // 시트 설정의 lastSyncAt 업데이트
    await prisma.peiSheetConfig.update({
      where: { id: sheetConfig.id },
      data: { lastSyncAt: new Date() }
    })

    console.log(`[PEI_DATA] 파싱 완료: ${peiData.records.length}개 레코드, PEI 점수: ${peiData.summary.peiScore}`)

    return NextResponse.json({
      success: true,
      data: {
        summary: peiData.summary,
        records: peiData.records,
        metadata: {
          clinicName: sheetConfig.clinic.name,
          sheetTitle: rawData.range,
          dataRange: fullRange,
          lastSyncAt: new Date(),
          totalRows: rawData.values.length,
          validRecords: peiData.records.length,
          columns: peiData.columns,
          headers: peiData.headers
        }
      }
    })

  } catch (error: any) {
    console.error("PEI 데이터 조회 실패:", error)

    // 구체적인 에러 메시지 제공
    let errorMessage = "데이터 조회 중 오류가 발생했습니다"
    let statusCode = 500

    if (error.code === 404) {
      errorMessage = "스프레드시트를 찾을 수 없습니다"
      statusCode = 404
    } else if (error.code === 403) {
      errorMessage = "시트 접근 권한이 없습니다"
      statusCode = 403
    } else if (error.message?.includes('GOOGLE_SERVICE_ACCOUNT_KEY')) {
      errorMessage = "Google 인증 설정이 필요합니다"
      statusCode = 500
    } else if (error.message?.includes('Invalid range')) {
      errorMessage = "잘못된 시트 범위입니다"
      statusCode = 400
    }

    return NextResponse.json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: statusCode })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    // URL 파라미터에서 먼저 확인
    const { searchParams } = new URL(req.url)
    let clinicId = searchParams.get('clinicId')
    let range = searchParams.get('range')
    let forceRefresh = searchParams.get('forceRefresh') === 'true'
    const testConnection = searchParams.get('test') === 'true'

    // request body에서도 확인 (JSON으로 전송된 경우)
    let body: any = {}
    try {
      body = await req.json()
      clinicId = clinicId || body.clinicId
      range = range || body.range
      forceRefresh = forceRefresh || body.forceRefresh
    } catch (e) {
      // JSON 파싱 실패해도 계속 진행
    }

    if (!clinicId) {
      return NextResponse.json({ error: "clinicId가 필요합니다" }, { status: 400 })
    }

    // test=true인 경우 연결 테스트 처리
    if (testConnection) {
      // 새로운 시트 URL이 body에 있으면 해당 URL로 테스트 (설정 저장 전)
      if (body.sheetUrl) {
        console.log(`[PEI_TEST] 새 시트 URL 연결 테스트: ${body.sheetUrl}`)
        const sheetId = extractSheetId(body.sheetUrl)
        if (!sheetId) {
          return NextResponse.json({
            success: false,
            message: "유효하지 않은 구글 시트 URL입니다"
          })
        }

        const connectionTest = await testSheetConnection(sheetId)
        return NextResponse.json({
          success: connectionTest.success,
          message: connectionTest.message,
          metadata: connectionTest.metadata,
          testUrl: body.sheetUrl,
          extractedSheetId: sheetId
        })
      }

      // 기존 설정된 시트로 테스트
      const sheetConfig = await prisma.peiSheetConfig.findUnique({
        where: { clinicId },
        include: {
          clinic: { select: { name: true } }
        }
      })

      if (!sheetConfig) {
        return NextResponse.json({
          error: "설정된 구글 시트가 없습니다. 새 시트 URL을 요청 body에 포함해주세요.",
          needsConfig: true
        }, { status: 404 })
      }

      const connectionTest = await testSheetConnection(sheetConfig.sheetId)
      return NextResponse.json({
        success: connectionTest.success,
        message: connectionTest.message,
        metadata: connectionTest.metadata,
        config: {
          sheetUrl: sheetConfig.sheetUrl,
          sheetName: sheetConfig.sheetName,
          lastSyncAt: sheetConfig.lastSyncAt
        }
      })
    }

    // 해당 치과의 시트 설정 조회
    const sheetConfig = await prisma.peiSheetConfig.findUnique({
      where: { clinicId },
      include: {
        clinic: { select: { name: true } }
      }
    })

    if (!sheetConfig) {
      return NextResponse.json({
        error: "설정된 구글 시트가 없습니다"
      }, { status: 404 })
    }

    // 마지막 동기화 후 5분 이내라면 캐시된 데이터 사용 (forceRefresh가 false인 경우)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    if (!forceRefresh && sheetConfig.lastSyncAt && sheetConfig.lastSyncAt > fiveMinutesAgo) {
      return NextResponse.json({
        message: "최근에 동기화되었습니다. 강제 새로고침을 원하면 forceRefresh: true를 사용하세요",
        lastSyncAt: sheetConfig.lastSyncAt,
        nextSyncAvailable: new Date(sheetConfig.lastSyncAt.getTime() + 5 * 60 * 1000)
      })
    }

    console.log(`[PEI_DATA_REFRESH] ${sheetConfig.clinic.name} 데이터 강제 새로고침`)

    // 시트 데이터 다시 읽기
    const fullRange = sheetConfig.sheetName
      ? `${sheetConfig.sheetName}!${range || 'A1:Z1000'}`
      : (range || 'A1:Z1000')

    const rawData = await readSheetData(sheetConfig.sheetId, fullRange)
    const peiData = parsePEIData(rawData.values || [])

    // 동기화 시간 업데이트
    const updatedConfig = await prisma.peiSheetConfig.update({
      where: { id: sheetConfig.id },
      data: { lastSyncAt: new Date() }
    })

    return NextResponse.json({
      success: true,
      message: "데이터를 성공적으로 새로고침했습니다",
      data: {
        summary: peiData.summary,
        recordCount: peiData.records.length,
        lastSyncAt: updatedConfig.lastSyncAt
      }
    })

  } catch (error: any) {
    console.error("PEI 데이터 새로고침 실패:", error)
    return NextResponse.json({
      error: "데이터 새로고침 중 오류가 발생했습니다",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}