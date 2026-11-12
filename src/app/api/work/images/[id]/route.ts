import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, audit } from "@/lib/work/common"
import { staffCanSee } from "@/lib/work/files"
import { agencyOf } from "@/lib/work/accounts"
import { moveFile } from "@/lib/work/imageFolders"

// 이미지 폴더 옮기기 { folderId | null } — NAS 파일도 실제로 옮긴다.

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard()
  if ("res" in g) return g.res
  const agencyId = await agencyOf(g.actor.id)
  if (!agencyId) return fail("소속 정보가 없습니다", 403)
  const f = await prisma.sharedFile.findFirst({ where: { id: (await params).id, deletedAt: null } })
  if (!f || !staffCanSee(g.actor, f)) return fail("이미지를 찾을 수 없습니다", 404)
  const b = await req.json().catch(() => ({}))
  const folderId = b.folderId ? String(b.folderId) : null
  try {
    await moveFile(f.id, { folderId }, agencyId)
    await audit(g.actor.id, "IMAGE_MOVED", f.clinicId, { fileId: f.id, folderId })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return fail((e as Error).message)
  }
}
