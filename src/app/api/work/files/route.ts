import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { canAccessClinic } from "@/lib/requests/access"
import { guard, fail, forbidden, audit, str } from "@/lib/work/common"
import { checkUpload, storeFile, fileListSelect, serializeFile, taskFolder, storedPath } from "@/lib/work/files"
import { promises as fsp } from "fs"
import { canAccessTask } from "@/lib/requests/access"
import { createNotifications } from "@/lib/notifications"

// 공유 파일 목록·업로드. 직원 누구나 올릴 수 있고 기록이 남는다.

export async function GET(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const q = req.nextUrl.searchParams
  const clinicId = q.get("clinicId")
  if (clinicId && clinicId !== "none" && !canAccessClinic(actor, clinicId)) return forbidden()

  const where: Prisma.SharedFileWhereInput = { deletedAt: null }
  if (clinicId === "none") where.clinicId = null
  else if (clinicId) where.clinicId = clinicId
  else if (!actor.isMaster) where.OR = [{ clinicId: null }, { clinicId: { in: actor.clinicIds ?? [] } }]
  const vis = q.get("visibility")
  if (vis === "CLINIC" || vis === "INTERNAL") where.visibility = vis
  const taskId = q.get("taskId")
  if (taskId) where.taskId = taskId
  const text = q.get("q")?.trim()
  if (text) where.title = { contains: text, mode: "insensitive" }

  const rows = await prisma.sharedFile.findMany({ where, select: fileListSelect, orderBy: { updatedAt: "desc" }, take: 300 })
  return NextResponse.json({ files: rows.map(serializeFile) })
}

export async function POST(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const form = await req.formData().catch(() => null)
  if (!form) return fail("잘못된 요청")
  const file = form.get("file") as File | null
  const err = checkUpload(file as File)
  if (err) return fail(err)

  const taskId = str(form.get("taskId"), 40)
  // 업무에 붙이는 파일은 업무의 치과(사내 업무면 없음)를 따른다
  const task = taskId ? await prisma.task.findUnique({ where: { id: taskId }, select: { clinicId: true } }) : null
  if (taskId && (!task || !canAccessTask(actor, task.clinicId))) return fail("업무를 찾을 수 없습니다")
  const clinicId = task ? task.clinicId : str(form.get("clinicId"), 40)
  if (clinicId && !canAccessClinic(actor, clinicId)) return forbidden()
  const visibility = form.get("visibility") === "CLINIC" ? "CLINIC" : "INTERNAL"
  if (visibility === "CLINIC" && !clinicId) return fail("원장 공개 파일은 치과를 골라야 합니다")
  const serviceRequestId = str(form.get("serviceRequestId"), 40)
  if (serviceRequestId && !clinicId) return fail("요청에 붙이는 파일은 치과를 골라야 합니다")
  if (serviceRequestId && !(await prisma.serviceRequest.findFirst({ where: { id: serviceRequestId, clinicId: clinicId! }, select: { id: true } })))
    return fail("요청을 찾을 수 없습니다")

  // 이미지 폴더함의 폴더로 올리면 그 NAS 폴더에 저장(같은 치과만)
  const imageFolderId = str(form.get("imageFolderId"), 40)
  const imgFolder = imageFolderId ? await prisma.imageFolder.findUnique({ where: { id: imageFolderId } }) : null
  if (imageFolderId && (!imgFolder || imgFolder.clinicId !== clinicId)) return fail("폴더를 찾을 수 없습니다")
  const stored = await storeFile(file as File, imgFolder ? imgFolder.path.split("/") : taskId ? await taskFolder(taskId) : null)
  const title = str(form.get("title"), 200) ?? stored.originalName.slice(0, 200)
  // DB 기록이 실패하면 방금 저장한 파일도 지운다(NAS에 주인 없는 파일 남기지 않기)
  const created = await prisma.sharedFile.create({
    data: {
      clinicId,
      taskId,
      imageFolderId: imgFolder?.id ?? null,
      serviceRequestId,
      visibility,
      title,
      uploadedByUserId: actor.id,
      publishedAt: visibility === "CLINIC" ? new Date() : null,
      versions: { create: { versionNo: 1, uploadedByUserId: actor.id, ...stored } },
    },
    select: fileListSelect,
  }).catch(async (e) => {
    await fsp.rm(storedPath(stored.storageKey), { force: true }).catch(() => {})
    throw e
  })
  await audit(actor.id, "FILE_UPLOADED", clinicId, { fileId: created.id, title, visibility, name: stored.originalName, bytes: Number(stored.byteSize) })
  if (visibility === "CLINIC" && clinicId) {
    await createNotifications({ type: "FILE_SHARED", title: `새 자료: ${title}`, link: `/dashboard/${clinicId}/files`, clinicId, audience: "clinic", exclude: [actor.id] })
  }
  return NextResponse.json(serializeFile(created), { status: 201 })
}
