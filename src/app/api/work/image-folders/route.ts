import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClinic } from "@/lib/requests/access"
import { guard, fail, audit, str } from "@/lib/work/common"
import { agencyOf } from "@/lib/work/accounts"
import { createFolder } from "@/lib/work/imageFolders"

// 이미지 폴더함 폴더 목록·만들기. 만들면 NAS 에 실제 폴더가 생긴다.

async function ctx(req: NextRequest, scopeParam: string | null) {
  const g = await guard()
  if ("res" in g) return { res: g.res }
  const agencyId = await agencyOf(g.actor.id)
  if (!agencyId) return { res: fail("소속 정보가 없습니다", 403) }
  const clinicId = !scopeParam || scopeParam === "internal" ? null : scopeParam
  if (clinicId && !canAccessClinic(g.actor, clinicId)) return { res: fail("권한이 없습니다", 403) }
  return { actor: g.actor, agencyId, clinicId }
}

export async function GET(req: NextRequest) {
  const c = await ctx(req, req.nextUrl.searchParams.get("scope"))
  if (!("agencyId" in c)) return c.res
  const folders = await prisma.imageFolder.findMany({
    where: { agencyId: c.agencyId, clinicId: c.clinicId },
    select: { id: true, parentId: true, name: true, path: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json({ folders })
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const c = await ctx(req, typeof b.scope === "string" ? b.scope : null)
  if (!("agencyId" in c)) return c.res
  const name = str(b.name, 80)
  if (!name) return fail("폴더 이름을 입력하세요")
  try {
    const f = await createFolder(c.agencyId, c.clinicId, b.parentId ? String(b.parentId) : null, name, c.actor.id)
    await audit(c.actor.id, "IMAGE_FOLDER_CREATED", c.clinicId, { folderId: f.id, path: f.path })
    return NextResponse.json({ id: f.id, parentId: f.parentId, name: f.name, path: f.path }, { status: 201 })
  } catch (e) {
    return fail((e as Error).message)
  }
}
