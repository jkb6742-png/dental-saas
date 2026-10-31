import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { absolutePath } from "@/lib/requests/storage"

type Ctx = { params: Promise<{ id: string; fileId: string }> }

// GET — 첨부파일 다운로드(권한 검사 후 전송). ?inline=1 이면 이미지 미리보기
export async function GET(req: NextRequest, { params }: Ctx) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const { id, fileId } = await params
  const att = await prisma.serviceRequestAttachment.findFirst({
    where: { id: fileId, requestId: id },
    include: { request: { select: { clinicId: true } } },
  })
  if (!att || !canAccessClinic(actor, att.request.clinicId)) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 })

  try {
    const buf = await fs.readFile(absolutePath(att.filePath))
    const inline = req.nextUrl.searchParams.get("inline") === "1" && att.mimeType.startsWith("image/")
    const disposition = inline ? "inline" : "attachment"
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": att.mimeType,
        "Content-Length": String(buf.length),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(att.originalName)}`,
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch {
    return NextResponse.json({ error: "파일이 서버에 없습니다" }, { status: 410 })
  }
}
