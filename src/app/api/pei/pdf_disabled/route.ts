import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    const { reportId } = await req.json()

    if (!reportId) {
      return NextResponse.json({
        error: "reportId가 필요합니다"
      }, { status: 400 })
    }

    console.log(`[PEI_PDF] PDF 생성 시작: ${reportId}`)

    // 보고서 조회
    const report = await prisma.peiReport.findUnique({
      where: { id: reportId },
      include: {
        clinic: { select: { name: true } }
      }
    })

    if (!report) {
      return NextResponse.json({
        error: "보고서를 찾을 수 없습니다"
      }, { status: 404 })
    }

    let htmlReport = null

    if (report.content) {
      if (report.content.trim().startsWith('<!DOCTYPE html>')) {
        // 이미 HTML 보고서인 경우
        htmlReport = report.content
      } else {
        try {
          // 기존 JSON 형태인 경우
          const content = JSON.parse(report.content)
          htmlReport = content?.htmlReport
        } catch (e) {
          console.error("보고서 콘텐츠 파싱 실패:", e)
        }
      }
    }

    if (!htmlReport) {
      return NextResponse.json({
        error: "HTML 보고서가 생성되지 않았습니다. 먼저 보고서를 생성해주세요"
      }, { status: 404 })
    }

    // PDF 파일명 생성
    const fileName = `PEI_${report.clinic.name}_${report.year}년${report.month}월_${new Date().getTime()}.pdf`
    const publicDir = path.join(process.cwd(), 'public', 'reports')
    const filePath = path.join(publicDir, fileName)

    // public/reports 디렉토리 생성
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true })
    }

    console.log(`[PEI_PDF] Puppeteer 시작...`)

    // Puppeteer로 PDF 생성
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--font-render-hinting=none'
      ]
    })

    try {
      const page = await browser.newPage()

      // 한글 폰트 지원을 위한 설정
      await page.setContent(htmlReport, {
        waitUntil: ['networkidle0', 'load']
      })

      // PDF 생성 옵션
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: false,
        preferCSSPageSize: true
      })

      // 파일 저장
      fs.writeFileSync(filePath, pdfBuffer)

      console.log(`[PEI_PDF] PDF 생성 완료: ${fileName}`)

    } finally {
      await browser.close()
    }

    // 데이터베이스에 PDF URL 업데이트
    const pdfUrl = `/reports/${fileName}`
    const updatedReport = await prisma.peiReport.update({
      where: { id: reportId },
      data: {
        pdfUrl,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: "PDF 보고서가 성공적으로 생성되었습니다",
      pdf: {
        url: pdfUrl,
        fileName,
        size: fs.statSync(filePath).size,
        generatedAt: new Date().toISOString()
      },
      report: {
        id: updatedReport.id,
        title: updatedReport.title,
        clinicName: report.clinic.name,
        period: `${report.year}년 ${report.month}월`
      }
    })

  } catch (error: any) {
    console.error('[PEI_PDF] PDF 생성 실패:', error)

    let errorMessage = "PDF 생성 중 오류가 발생했습니다"

    if (error.message?.includes('Failed to launch')) {
      errorMessage = "PDF 생성 엔진 시작에 실패했습니다"
    } else if (error.message?.includes('ENOSPC')) {
      errorMessage = "디스크 공간이 부족합니다"
    } else if (error.message?.includes('EACCES')) {
      errorMessage = "파일 저장 권한이 없습니다"
    }

    return NextResponse.json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const reportId = searchParams.get('reportId')
    const download = searchParams.get('download') === 'true'

    if (!reportId) {
      return NextResponse.json({
        error: "reportId 파라미터가 필요합니다"
      }, { status: 400 })
    }

    // 보고서 조회
    const report = await prisma.peiReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        pdfUrl: true,
        title: true,
        year: true,
        month: true,
        clinic: { select: { name: true } }
      }
    })

    if (!report) {
      return NextResponse.json({
        error: "보고서를 찾을 수 없습니다"
      }, { status: 404 })
    }

    if (!report.pdfUrl) {
      return NextResponse.json({
        error: "PDF가 아직 생성되지 않았습니다"
      }, { status: 404 })
    }

    if (download) {
      // 파일 다운로드
      const filePath = path.join(process.cwd(), 'public', report.pdfUrl)

      if (!fs.existsSync(filePath)) {
        return NextResponse.json({
          error: "PDF 파일을 찾을 수 없습니다"
        }, { status: 404 })
      }

      const fileBuffer = fs.readFileSync(filePath)
      const fileName = `${report.clinic.name}_${report.year}년${report.month}월_PEI보고서.pdf`

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          'Content-Length': fileBuffer.length.toString()
        }
      })
    }

    return NextResponse.json({
      success: true,
      pdf: {
        url: report.pdfUrl,
        title: report.title,
        period: `${report.year}년 ${report.month}월`,
        clinicName: report.clinic.name
      }
    })

  } catch (error) {
    console.error('[PEI_PDF] PDF 조회/다운로드 실패:', error)
    return NextResponse.json({
      error: "PDF 처리 중 오류가 발생했습니다"
    }, { status: 500 })
  }
}