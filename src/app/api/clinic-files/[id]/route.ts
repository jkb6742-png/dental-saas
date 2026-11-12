import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { readStored, fileResponse } from "@/lib/work/files"

type Ctx = { params: Promise<{ id: string }> }

// 원장 다운로드: 공개된 자기 치과 파일의 최신 버전만
export async function GET(req: NextRequest, { params }: Ctx) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const f = await prisma.sharedFile.findFirst({
    where: { id: (await params).id, visibility: "CLINIC", deletedAt: null, clinicId: { not: null } },
    select: { id: true, clinicId: true, currentVersion: true },
  })
  if (!f || !canAccessClinic(actor, f.clinicId!)) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 })
  const v = await prisma.sharedFileVersion.findUnique({ where: { fileId_versionNo: { fileId: f.id, versionNo: f.currentVersion } } })
  if (!v) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 })
  try {
    return fileResponse(await readStored(v.storageKey), v, req.nextUrl.searchParams.get("inline") === "1")
  } catch {
    return NextResponse.json({ error: "파일이 서버에 없습니다" }, { status: 410 })
  }
}
