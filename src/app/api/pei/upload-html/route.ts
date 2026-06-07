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

    // 🔒 보안 1: 파일 확장자 및 MIME 타입 검증
    const allowedExtensions = ['.html', '.htm']
    const allowedMimeTypes = ['text/html', 'text/plain', 'application/octet-stream']

    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json({
        error: "HTML 파일(.html, .htm)만 업로드 가능합니다"
      }, { status: 400 })
    }

    if (file.type && !allowedMimeTypes.includes(file.type)) {
      return NextResponse.json({
        error: "허용되지 않은 파일 타입입니다"
      }, { status: 400 })
    }

    // 🔒 보안 2: 파일 크기 제한 (5MB로 축소)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({
        error: "파일 크기는 5MB를 초과할 수 없습니다"
      }, { status: 400 })
    }

    // 파일 내용 읽기
    const rawHtmlContent = await file.text()

    // 🔒 보안 3: 기본적인 HTML 검증
    if (!rawHtmlContent.includes('<!DOCTYPE html>') && !rawHtmlContent.includes('<html')) {
      return NextResponse.json({
        error: "올바른 HTML 파일이 아닙니다"
      }, { status: 400 })
    }

    // 🔒 보안 4: 악성 패턴 검사
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

    // 🔒 보안 5: HTML 새니타이징 (XSS 방지)
    const sanitizeOptions = {
      allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'div', 'span', 'br', 'hr',
        'strong', 'b', 'em', 'i', 'u',
        'ul', 'ol', 'li',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'img', 'a',
        'blockquote', 'pre', 'code',
        'html', 'head', 'body', 'title', 'meta', 'link', 'style'
      ],
      allowedAttributes: {
        '*': ['class', 'id', 'style'],
        'a': ['href', 'target'],
        'img': ['src', 'alt', 'width', 'height'],
        'meta': ['charset', 'name', 'content'],
        'link': ['rel', 'type', 'href']
      },
      allowedSchemes: ['http', 'https', 'data'],
      allowedClasses: {},
      allowedStyles: {
        '*': {
          'color': [/^[a-z]+$/i, /^#[0-9a-f]{3,6}$/i, /^rgb\([0-9, ]+\)$/],
          'background-color': [/^[a-z]+$/i, /^#[0-9a-f]{3,6}$/i, /^rgb\([0-9, ]+\)$/],
          'font-size': [/^\d+(px|em|rem|%)$/],
          'font-weight': [/^\d+$/, /^(normal|bold|bolder|lighter)$/],
          'text-align': [/^(left|center|right|justify)$/],
          'margin': [/^\d+(px|em|rem|%)(\s+\d+(px|em|rem|%))*$/],
          'padding': [/^\d+(px|em|rem|%)(\s+\d+(px|em|rem|%))*$/],
          'width': [/^\d+(px|em|rem|%)$/],
          'height': [/^\d+(px|em|rem|%)$/],
          'border': [/^[\d\w\s#(),-]+$/],
          'display': [/^(block|inline|inline-block|flex|grid|none)$/]
        }
      }
    }

    const htmlContent = sanitizeHtml(rawHtmlContent, sanitizeOptions)

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
        content: htmlContent,
        status: 'COMPLETED',
        generatedAt: new Date(),
        updatedAt: new Date(),
        summary: 'HTML로 업로드된 PEI 보고서',
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
        content: htmlContent,
        status: 'COMPLETED',
        generatedAt: new Date(),
        generatedBy: user.id!,
        summary: 'HTML로 업로드된 PEI 보고서',
        peiScore: 0,
        categoryScores: {},
        insights: [],
        recommendations: []
      }
    })

    // HTML 파일을 구조화된 디렉토리에 저장
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true }
    })

    const fileName = `[${clinic?.name || '치과'}] ${year}년 ${month}월 PEI리포트.html`

    // 개선된 파일 저장 구조: ./uploads/pei/[clinicId]/[year]/[month]/
    const fs = require('fs').promises
    const path = require('path')

    const baseDir = path.join(process.cwd(), 'uploads', 'pei', clinicId, year.toString(), month.toString().padStart(2, '0'))
    const filePath = path.join(baseDir, fileName)

    // 디렉토리가 없으면 생성
    await fs.mkdir(baseDir, { recursive: true })
    await fs.writeFile(filePath, htmlContent, 'utf8')

    console.log(`[PEI_UPLOAD] HTML 보고서 업로드 완료: ${report.id} - ${title}`)

    return NextResponse.json({
      success: true,
      message: "PEI 보고서가 성공적으로 업로드되었습니다",
      reportId: report.id,
      fileName: fileName,
      filePath: filePath
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