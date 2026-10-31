import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { requireClinicAccess, logSecurityEvent } from "@/lib/security"
import sanitizeHtml from "sanitize-html"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const clinicId = formData.get('clinicId') as string
    const year = parseInt(formData.get('year') as string)
    const month = parseInt(formData.get('month') as string)
    const title = formData.get('title') as string

    if (!file || !clinicId || !year || !month || !title) {
      return NextResponse.json({
        error: "파일, 치과ID, 연도, 월, 제목이 필요합니다"
      }, { status: 400 })
    }

    // 🔒 보안 검증: 클리닉 접근 및 WRITE 권한 확인
    const user = await requireClinicAccess(clinicId, 'WRITE')

    // 파일 타입 제한 제거 - 모든 파일 형식 허용

    // 파일 크기 제한 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({
        error: "파일 크기는 50MB를 초과할 수 없습니다"
      }, { status: 400 })
    }

    // 파일 내용을 Base64로 읽기 (모든 파일 형식 지원)
    const buffer = await file.arrayBuffer()
    const rawContent = Buffer.from(buffer).toString('base64')

    // 파일 정보 저장을 위한 메타데이터
    const fileMetadata = {
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      encoding: 'base64'
    }

    // 🔒 보안 4: 악성 패턴 검사 (비활성화 - PDF 업로드 허용)
    /*
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b/gi,
      /<object\b/gi,
      /<embed\b/gi,
      /<form\b/gi
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(rawHtmlContent)) {
        return NextResponse.json({
          error: "보안상 위험한 HTML 요소가 감지되었습니다. 스크립트, 폼, iframe 등을 제거해주세요."
        }, { status: 400 })
      }
    }
    */

    // 🔒 HTML 새니타이징 비활성화 - 원본 파일 그대로 저장
    /*
    const sanitizeOptions = {
      // ... (생략)
    }
    const htmlContent = sanitizeHtml(rawHtmlContent, sanitizeOptions)
    */

    // 원본 파일 내용을 Base64로 저장
    const fileContent = JSON.stringify({
      content: rawContent,
      metadata: fileMetadata
    })

    // 보안 이벤트 로깅
    await logSecurityEvent({
      userId: user.id!,
      event: "PEI_HTML_UPLOAD",
      clinicId,
      timestamp: new Date(),
      details: { year, month, title, fileName: file.name }
    })

    // 데이터베이스에 저장 (기존 리포트가 있으면 업데이트)
    const report = await prisma.peiReport.upsert({
      where: {
        clinicId_year_month: { clinicId, year, month }
      },
      update: {
        title,
        content: fileContent,
        status: 'COMPLETED',
        generatedAt: new Date(),
        updatedAt: new Date(),
        summary: `원본 파일로 업로드된 PEI 보고서 (${fileMetadata.originalName})`,
        peiScore: 0,
        categoryScores: {},
        insights: [],
        recommendations: []
      },
      create: {
        clinicId,
        year,
        month,
        title,
        content: fileContent,
        status: 'COMPLETED',
        generatedAt: new Date(),
        generatedBy: user.id!,
        summary: `원본 파일로 업로드된 PEI 보고서 (${fileMetadata.originalName})`,
        peiScore: 0,
        categoryScores: {},
        insights: [],
        recommendations: []
      }
    })

    // HTML 파일을 구조화된 디렉토리에 저장
    console.log(`[PEI_UPLOAD] 리포트 업로드 완료: ${report.id} - ${title} (${fileMetadata.originalName})`)

    return NextResponse.json({
      success: true,
      message: `PEI 리포트 원본 파일이 성공적으로 업로드되었습니다 (${fileMetadata.originalName})`,
      reportId: report.id,
      fileName: fileMetadata.originalName,
      downloadUrl: `/api/pei/html?reportId=${report.id}&download=true`
    })

  } catch (error: any) {
    console.error('[PEI_UPLOAD] 업로드 실패:', error)

    if (error instanceof Error) {
      // 인증 관련 오류인 경우
      if (error.message.includes("인증되지 않은") || error.message.includes("접근 권한이")) {
        return NextResponse.json({
          error: error.message,
          code: "AUTH_ERROR"
        }, { status: 401 })
      }
    }

    return NextResponse.json({
      error: "파일 업로드 중 오류가 발생했습니다",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}