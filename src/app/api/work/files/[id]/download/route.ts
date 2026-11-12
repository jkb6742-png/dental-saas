import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail } from "@/lib/work/common"
import { readStored, fileResponse, staffCanSee } from "@/lib/work/files"

type Ctx = { params: Promise<{ id: string }> }

// 직원용 다운로드. ?v=버전번호(없으면 최신), ?inline=1 미리보기
export async function GET(req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const f = await prisma.sharedFile.findFirst({ where: { id: (await params).id, deletedAt: null }, select: { id: true, clinicId: true, currentVersion: true } })
  if (!f || !staffCanSee(g.actor, f)) return fail("찾을 수 없습니다", 404)
  const vNo = Number(req.nextUrl.searchParams.get("v")) || f.currentVersion
  const v = await prisma.sharedFileVersion.findUnique({ where: { fileId_versionNo: { fileId: f.id, versionNo: vNo } } })
  if (!v) return fail("버전을 찾을 수 없습니다", 404)
  try {
    return fileResponse(await readStored(v.storageKey), v, req.nextUrl.searchParams.get("inline") === "1")
  } catch {
    return fail("파일이 서버에 없습니다", 410)
  }
}
