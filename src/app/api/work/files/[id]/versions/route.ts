import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, audit } from "@/lib/work/common"
import { checkUpload, storeFile, fileListSelect, serializeFile, staffCanSee, taskFolder } from "@/lib/work/files"
import { createNotifications } from "@/lib/notifications"

type Ctx = { params: Promise<{ id: string }> }

// 새 버전 올리기. 이전 버전은 그대로 남는다.
export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const f = await prisma.sharedFile.findFirst({ where: { id: (await params).id, deletedAt: null } })
  if (!f || !staffCanSee(actor, f)) return fail("찾을 수 없습니다", 404)
  const form = await req.formData().catch(() => null)
  const file = form?.get("file") as File | null
  const err = checkUpload(file as File)
  if (err) return fail(err)

  const stored = await storeFile(file as File, f.taskId ? await taskFolder(f.taskId) : null)
  const row = await prisma.$transaction(async (tx) => {
    const cur = await tx.sharedFile.update({ where: { id: f.id }, data: { currentVersion: { increment: 1 } }, select: { currentVersion: true } })
    await tx.sharedFileVersion.create({ data: { fileId: f.id, versionNo: cur.currentVersion, uploadedByUserId: actor.id, ...stored } })
    return tx.sharedFile.findUniqueOrThrow({ where: { id: f.id }, select: fileListSelect })
  })
  await audit(actor.id, "FILE_VERSION_UPLOADED", f.clinicId, { fileId: f.id, version: row.currentVersion, name: stored.originalName })
  if (f.visibility === "CLINIC" && f.clinicId) {
    await createNotifications({ type: "FILE_SHARED", title: `자료 수정본: ${f.title}`, link: `/dashboard/${f.clinicId}/files`, clinicId: f.clinicId, audience: "clinic", exclude: [actor.id] })
  }
  return NextResponse.json(serializeFile(row), { status: 201 })
}
