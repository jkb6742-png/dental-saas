import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    // 마스터 계정만 업로드 가능
    if ((session.user as any).role !== 'MASTER') {
      return NextResponse.json({
        error: "PEI 보고서 업로드는 마스터 계정만 가능합니다"
      }, { status: 403 })
    }

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

    // HTML 파일인지 확인
    if (!file.name.endsWith('.html') && !file.type.includes('text/html')) {
      return NextResponse.json({
        error: "HTML 파일만 업로드 가능합니다"
      }, { status: 400 })
    }

    // 파일 내용 읽기
    const htmlContent = await file.text()

    // 기본적인 HTML 검증
    if (!htmlContent.includes('<!DOCTYPE html>') && !htmlContent.includes('<html')) {
      return NextResponse.json({
        error: "올바른 HTML 파일이 아닙니다"
      }, { status: 400 })
    }

    // 데이터베이스에 저장
    const report = await prisma.peiReport.upsert({
      where: {
        clinicId_year_month: { clinicId, year, month }
      },
      update: {
        title,
        content: htmlContent,
        status: 'COMPLETED',
        updatedAt: new Date(),
        summary: '업로드된 HTML 보고서',
        peiScore: 0, // HTML에서 추출하거나 기본값
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
        generatedBy: (session.user as any).id,
        summary: '업로드된 HTML 보고서',
        peiScore: 0,
        categoryScores: {},
        insights: [],
        recommendations: []
      }
    })

    console.log(`[PEI_UPLOAD] HTML 보고서 업로드 완료: ${report.id}`)

    return NextResponse.json({
      success: true,
      message: "PEI HTML 보고서가 성공적으로 업로드되었습니다",
      report: {
        id: report.id,
        title: report.title,
        clinicId: report.clinicId,
        year: report.year,
        month: report.month,
        generatedAt: report.generatedAt
      }
    })

  } catch (error: any) {
    console.error('[PEI_UPLOAD] 업로드 실패:', error)

    return NextResponse.json({
      error: "파일 업로드 중 오류가 발생했습니다",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    // 마스터 계정만 삭제 가능
    if ((session.user as any).role !== 'MASTER') {
      return NextResponse.json({
        error: "PEI 보고서 삭제는 마스터 계정만 가능합니다"
      }, { status: 403 })
    }

    const { reportId } = await req.json()

    if (!reportId) {
      return NextResponse.json({
        error: "reportId가 필요합니다"
      }, { status: 400 })
    }

    // 보고서 존재 여부 확인
    const existingReport = await prisma.peiReport.findUnique({
      where: { id: reportId },
      include: { clinic: { select: { name: true } } }
    })

    if (!existingReport) {
      return NextResponse.json({
        error: "삭제할 보고서를 찾을 수 없습니다"
      }, { status: 404 })
    }

    // 보고서 삭제
    await prisma.peiReport.delete({
      where: { id: reportId }
    })

    console.log(`[PEI_DELETE] 보고서 삭제 완료: ${reportId} - ${existingReport.title}`)

    return NextResponse.json({
      success: true,
      message: "PEI 보고서가 성공적으로 삭제되었습니다",
      deletedReport: {
        id: existingReport.id,
        title: existingReport.title,
        year: existingReport.year,
        month: existingReport.month
      }
    })

  } catch (error: any) {
    console.error('[PEI_DELETE] 삭제 실패:', error)

    return NextResponse.json({
      error: "보고서 삭제 중 오류가 발생했습니다",
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
    const clinicId = searchParams.get('clinicId')

    if (!clinicId) {
      return NextResponse.json({
        error: "clinicId 파라미터가 필요합니다"
      }, { status: 400 })
    }

    // 해당 치과의 모든 업로드된 보고서 조회
    const reports = await prisma.peiReport.findMany({
      where: { clinicId },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ],
      include: {
        clinic: { select: { name: true } }
      }
    })

    return NextResponse.json({
      success: true,
      reports: reports.map(report => ({
        id: report.id,
        title: report.title,
        year: report.year,
        month: report.month,
        status: report.status,
        generatedAt: report.generatedAt,
        clinicName: report.clinic.name,
        hasContent: !!report.content
      }))
    })

  } catch (error) {
    console.error('[PEI_UPLOAD] 목록 조회 실패:', error)
    return NextResponse.json({
      error: "보고서 목록 조회 중 오류가 발생했습니다"
    }, { status: 500 })
  }
}