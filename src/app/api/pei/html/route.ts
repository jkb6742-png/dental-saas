import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const reportId = searchParams.get('reportId')
    const download = searchParams.get('download') === 'true'

    if (!reportId) {
      return NextResponse.json({ error: "reportId가 필요합니다" }, { status: 400 })
    }

    const report = await prisma.peiReport.findUnique({
      where: { id: reportId },
      include: { clinic: true }
    })

    if (!report) {
      return NextResponse.json({ error: "보고서를 찾을 수 없습니다" }, { status: 404 })
    }

    if (!report.content) {
      return NextResponse.json({ error: "보고서 내용이 없습니다" }, { status: 404 })
    }

    const headers: HeadersInit = {
      'Content-Type': 'text/html; charset=utf-8'
    }

    // 다운로드 요청인 경우 파일명 설정
    if (download) {
      const fileName = `${report.year}년${report.month}월_PEI보고서_${report.clinic.name}.html`
      headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(fileName)}"`
    }

    return new NextResponse(report.content, { headers })

  } catch (error) {
    console.error('[PEI_HTML] 조회 실패:', error)
    return NextResponse.json({ error: "HTML 보고서 처리 중 오류" }, { status: 500 })
  }
}