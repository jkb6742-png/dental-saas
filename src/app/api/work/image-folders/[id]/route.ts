import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessTask } from "@/lib/requests/access"
import { guard, fail, audit, str } from "@/lib/work/common"
import { agencyOf } from "@/lib/work/accounts"
import { renameFolder, deleteFolder } from "@/lib/work/imageFolders"

// 폴더 이름 바꾸기·삭제. NAS 폴더에도 바로 반영. 삭제하면 안의 이미지는 상위 폴더로 옮긴다(이미지는 지우지 않음).

type Ctx = { params: Promise<{ id: string }> }

async function load(id: string) {
  const g = await guard()
  if ("res" in g) return { res: g.res }
  const agencyId = await agencyOf(g.actor.id)
  if (!agencyId) return { res: fail("소속 정보가 없습니다", 403) }
  const f = await prisma.imageFolder.findFirst({ where: { id, agencyId } })
  if (!f || !canAccessTask(g.actor, f.clinicId)) return { res: fail("폴더를 찾을 수 없습니다", 404) }
  return { actor: g.actor, agencyId, f }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const r = await load((await params).id)
  if (!("f" in r)) return r.res
  const b = await req.json().catch(() => ({}))
  const name = str(b.name, 80)
  if (!name) return fail("폴더 이름을 입력하세요")
  try {
    const f = await renameFolder(r.agencyId, r.f.id, name)
    await audit(r.actor.id, "IMAGE_FOLDER_RENAMED", r.f.clinicId, { folderId: f.id, from: r.f.path, to: f.path })
    return NextResponse.json({ id: f.id, name: f.name, path: f.path })
  } catch (e) {
    return fail((e as Error).message)
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const r = await load((await params).id)
  if (!("f" in r)) return r.res
  try {
    const out = await deleteFolder(r.agencyId, r.f.id)
    await audit(r.actor.id, "IMAGE_FOLDER_DELETED", r.f.clinicId, { folderId: r.f.id, path: r.f.path, ...out })
    return NextResponse.json({ ok: true, ...out })
  } catch (e) {
    return fail((e as Error).message)
  }
}
