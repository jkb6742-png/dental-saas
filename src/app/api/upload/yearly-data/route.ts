// =============================================================================
// 통합 업로드 API - 새로운 자동 감지 기반 업로드 시스템
// =============================================================================

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { processUpload } from "@/lib/upload"
import { extractYear } from "@/lib/upload/utils"

export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
    }

    // 2. MASTER 권한 확인 (MASTER만 업로드 가능)
    if ((session.user as any).role !== "MASTER") {
      return NextResponse.json({ error: "MASTER 권한이 필요합니다." }, { status: 403 })
    }

    // 3. 요청 데이터 추출
    const formData = await request.formData()
    const file = formData.get("file") as File
    const clinicId = formData.get("clinicId") as string
    const yearParam = formData.get("year") as string

    // 4. 기본 유효성 검증
    if (!file) {
      return NextResponse.json({ error: "파일이 선택되지 않았습니다." }, { status: 400 })
    }

    if (!clinicId) {
      return NextResponse.json({ error: "클리닉 ID가 필요합니다." }, { status: 400 })
    }

    // 5. 파일 형식 검증
    const allowedExtensions = ['.xlsx', '.xls']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))

    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json({
        error: "Excel 파일만 업로드 가능합니다. (.xlsx, .xls)",
        supportedFormats: allowedExtensions
      }, { status: 400 })
    }

    // 6. 연도 결정 (파라미터 > 파일명 > 현재 연도)
    let year: number
    if (yearParam) {
      year = parseInt(yearParam)
      if (isNaN(year) || year < 2020 || year > 2030) {
        return NextResponse.json({ error: "올바른 연도를 입력해주세요. (2020-2030)" }, { status: 400 })
      }
    } else {
      year = extractYear(file.name)
    }

    // 7. 클리닉 존재 및 권한 확인 (MASTER는 모든 클리닉 접근 가능)
    const { prisma } = await import('@/lib/db')
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId }
    })

    if (!clinic) {
      return NextResponse.json({ error: "존재하지 않는 클리닉입니다." }, { status: 404 })
    }

    // 8. 파일 크기 확인 (50MB 제한으로 성능 최적화)
    const maxSize = 50 * 1024 * 1024 // 50MB (성능 최적화)
    if (file.size > maxSize) {
      return NextResponse.json({
        error: `파일 크기가 너무 큽니다. 최대 50MB까지 업로드 가능합니다. (현재: ${Math.round(file.size / 1024 / 1024)}MB)`,
        maxSizeMB: 50,
        currentSizeMB: Math.round(file.size / 1024 / 1024)
      }, { status: 413 })
    }

    // 9. 업로드 컨텍스트 생성
    const buffer = await file.arrayBuffer()
    const context = {
      clinicId,
      filename: file.name,
      fileSize: file.size,
      buffer,
      year,
      userId: session.user.id
    }

    console.log(`📤 새 업로드 요청: ${file.name} (${Math.round(file.size / 1024)}KB, clinic: ${clinicId}, year: ${year})`)

    // 10. 메인 처리 로직 실행
    const result = await processUpload(context)

    // 11. 성공 응답
    if (result.success) {
      console.log(`✅ 업로드 성공: ${result.recordCount}건, ${result.processingTime}ms`)

      return NextResponse.json({
        success: true,
        fileType: result.fileType,
        recordCount: result.recordCount,
        affectedMonths: result.affectedMonths,
        recalculatedSummaries: result.recalculatedSummaries,
        processingTimeMs: result.processingTime,
        warnings: result.warnings,
        clinic: {
          id: clinic.id,
          name: clinic.name
        },
        message: generateSuccessMessage(result),
        debug: {
          fileSize: file.size,
          year,
          hasWarnings: result.warnings.length > 0,
          hasErrors: result.errors.length > 0
        }
      })
    }

    // 12. 실패 응답
    console.error(`❌ 업로드 실패: ${result.errors.join(', ')}`)

    return NextResponse.json({
      success: false,
      fileType: result.fileType,
      error: "업로드 처리에 실패했습니다.",
      details: result.errors.join(', '),
      warnings: result.warnings,
      processingTimeMs: result.processingTime,
      debug: {
        recordCount: result.recordCount,
        affectedMonths: result.affectedMonths
      }
    }, { status: 400 })

  } catch (error) {
    console.error("업로드 API 오류:", error)

    // 에러 타입별 처리
    if (error instanceof SyntaxError) {
      return NextResponse.json({
        error: "요청 데이터가 올바르지 않습니다.",
        details: "FormData를 올바르게 전송해주세요."
      }, { status: 400 })
    }

    return NextResponse.json({
      error: "서버 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "알 수 없는 오류",
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * 성공 메시지 생성
 */
function generateSuccessMessage(result: any): string {
  const fileTypeNames: Record<string, string> = {
    'RECEPTION_RECORDS': '접수수납목록',
    'ANNUAL_LEDGER': '연간장부',
    'MONTHLY_PATIENTS': '월별접수환자수',
    'AGE_DISTRIBUTION': '연령분포',
    'REGION_DISTRIBUTION': '지역분포',
    'TREATMENT_STATS': '진료항목별통계',
    'CONSULTATION_STATS': '상담자별상담통계'
  }

  const typeName = fileTypeNames[result.fileType] || result.fileType
  let message = `✅ ${typeName} 업로드 완료! ${result.recordCount}건 처리됨`

  if (result.affectedMonths.length > 0) {
    const monthList = result.affectedMonths.filter((m: number) => m > 0).join(', ')
    if (monthList) {
      message += ` (${monthList}월 데이터)`
    }
  }

  if (result.recalculatedSummaries > 0) {
    message += `\n🔄 월간요약 ${result.recalculatedSummaries}개월 자동 재계산됨`
  }

  if (result.warnings.length > 0) {
    message += `\n⚠️ 경고 ${result.warnings.length}건 (확인 필요)`
  }

  message += `\n📊 대시보드에서 즉시 확인 가능합니다!`

  return message
}

/**
 * 파일 타입별 설명 반환
 */
function getFileTypeDescription(fileType: string): string {
  const descriptions: Record<string, string> = {
    'RECEPTION_RECORDS': '환자별 접수/수납 내역으로 환자통계와 연령/지역분포를 자동 생성합니다.',
    'ANNUAL_LEDGER': '월별 수입/지출 요약으로 월간매출 통계를 갱신합니다.',
    'MONTHLY_PATIENTS': '월별 환자 통계로 환자 관련 지표를 갱신합니다.',
    'AGE_DISTRIBUTION': '연령대별 환자 분포 통계입니다.',
    'REGION_DISTRIBUTION': '지역별 환자 분포 통계입니다.',
    'TREATMENT_STATS': '진료항목별 매출 및 환자 통계입니다.',
    'CONSULTATION_STATS': '상담자별 실적 통계입니다.'
  }

  return descriptions[fileType] || '알 수 없는 파일 형식'
}

/**
 * 업로드 가능한 파일 형식 정보 반환
 */
export async function GET() {
  try {
    const { getSupportedFileTypes } = await import('@/lib/upload')
    const supportedTypes = getSupportedFileTypes()

    return NextResponse.json({
      supportedFileTypes: supportedTypes,
      fileTypeDescriptions: supportedTypes.reduce((acc, type) => {
        acc[type] = getFileTypeDescription(type)
        return acc
      }, {} as Record<string, string>),
      supportedExtensions: ['.xlsx', '.xls'],
      maxFileSizeMB: 100,
      features: [
        '자동 파일 형식 감지',
        '중복 데이터 안전 교체',
        '월간요약 자동 재계산',
        '클리닉별 데이터 격리',
        '트랜잭션 기반 안전 처리'
      ]
    })

  } catch (error) {
    return NextResponse.json({
      error: '시스템 정보를 가져올 수 없습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}