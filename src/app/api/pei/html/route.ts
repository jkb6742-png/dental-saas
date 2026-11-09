import { denyClinic } from "@/lib/requests/access"
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

    const denied = await denyClinic(report.clinicId)
    if (denied) return denied

    if (!report.content) {
      return NextResponse.json({ error: "보고서 내용이 없습니다" }, { status: 404 })
    }

    // 새로운 Base64 형식인지 확인
    let fileData: any
    let isNewFormat = false

    try {
      fileData = JSON.parse(report.content)
      if (fileData.content && fileData.metadata) {
        isNewFormat = true
      }
    } catch {
      // 기존 HTML 형식
      isNewFormat = false
    }

    if (isNewFormat) {
      // 새로운 형식: Base64 디코딩하여 원본 파일 제공
      const buffer = Buffer.from(fileData.content, 'base64')
      const originalFileName = fileData.metadata.originalName
      const mimeType = fileData.metadata.mimeType

      const headers: HeadersInit = {
        'Content-Type': mimeType
      }

      // 다운로드 요청인 경우 파일명 설정
      if (download) {
        const fileName = originalFileName || `${report.year}년${report.month}월_PEI보고서_${report.clinic.name}`
        headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(fileName)}"`
      }

      return new NextResponse(buffer, { headers })
    } else {
      // 기존 HTML 형식 (하위 호환성)
      const headers: HeadersInit = {
        'Content-Type': 'text/html; charset=utf-8'
      }

      if (download) {
        const fileName = `${report.year}년${report.month}월_PEI보고서_${report.clinic.name}.html`
        headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(fileName)}"`
      }

      return new NextResponse(report.content, { headers })
    }

  } catch (error) {
    console.error('[PEI_HTML] 조회 실패:', error)
    return NextResponse.json({ error: "HTML 보고서 처리 중 오류" }, { status: 500 })
  }
}