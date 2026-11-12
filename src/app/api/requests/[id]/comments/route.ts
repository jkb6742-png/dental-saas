import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createNotifications } from "@/lib/notifications"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { fetchOne, serializeRequest } from "@/lib/requests/serialize"
import { saveRequestFile, validateFiles } from "@/lib/requests/storage"

type Ctx = { params: Promise<{ id: string }> }

// POST (multipart) — 댓글 + 선택 첨부(마스터가 올리면 결과물 RESULT 로 분류)
export async function POST(request: NextRequest, { params }: Ctx) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const { id } = await params
  const row = await prisma.serviceRequest.findUnique({ where: { id } })
  if (!row || !canAccessClinic(actor, row.clinicId)) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 })

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "multipart/form-data 로 보내 주세요" }, { status: 400 })
  const content = String(form.get("content") ?? "").trim()
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)
  if (!content && files.length === 0) return NextResponse.json({ error: "내용 또는 파일을 넣어 주세요" }, { status: 400 })
  const fileError = validateFiles(files)
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 })

  if (content) {
    await prisma.serviceRequestComment.create({ data: { requestId: id, content: content.slice(0, 3000), createdBy: actor.id } })
  }
  for (const file of files) {
    const saved = await saveRequestFile(row.clinicId, id, file)
    await prisma.serviceRequestAttachment.create({
      data: {
        requestId: id,
        fileName: saved.fileName,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        filePath: saved.filePath,
        kind: actor.isMaster || actor.isStaff ? "RESULT" : "REFERENCE",
        uploadedBy: actor.id,
      },
    })
  }
  await prisma.serviceRequest.update({ where: { id }, data: { updatedAt: new Date() } })
  const full = await fetchOne(id)
  {
    const clinicName = (await prisma.clinic.findUnique({ where: { id: row.clinicId }, select: { name: true } }))?.name ?? ""
    createNotifications({
      type: "REQUEST_COMMENT", clinicId: row.clinicId, audience: actor.isMaster || actor.isStaff ? "clinic" : "masters", exclude: [actor.id],
      title: `${actor.isMaster || actor.isStaff ? "THINKLAB" : clinicName} 댓글 · ${row.title.slice(0, 60)}`,
      body: content ? content.slice(0, 200) : `파일 ${files.length}개를 올렸습니다.`,
      link: `/dashboard/${row.clinicId}/requests?open=${id}`,
    }).catch((e) => console.error("[requests] 알림 실패", e?.message))
  }
  return NextResponse.json(serializeRequest(full!))
}
