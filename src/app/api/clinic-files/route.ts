import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"

// 원장 자료실: 이 치과에 공개(CLINIC)된 파일만. 내부 파일은 어떤 경우에도 나가지 않는다.
export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const clinicId = req.nextUrl.searchParams.get("clinicId")
  if (!clinicId || !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  const rows = await prisma.sharedFile.findMany({
    where: { clinicId, visibility: "CLINIC", deletedAt: null },
    select: {
      id: true,
      title: true,
      publishedAt: true,
      updatedAt: true,
      currentVersion: true,
      versions: { orderBy: { versionNo: "desc" }, take: 1, select: { originalName: true, mimeType: true, byteSize: true, createdAt: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 300,
  })
  return NextResponse.json({
    files: rows.map((f) => ({ ...f, latest: f.versions[0] ? { ...f.versions[0], byteSize: Number(f.versions[0].byteSize) } : null, versions: undefined })),
  })
}
