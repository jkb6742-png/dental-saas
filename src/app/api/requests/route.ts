import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { CATEGORY_MAP, type RequestCategory, type RequestPriority } from "@/lib/requests/categories"
import { requestInclude, serializeRequest } from "@/lib/requests/serialize"
import { createNotifications } from "@/lib/notifications"
import { saveRequestFile, validateFiles } from "@/lib/requests/storage"

// GET /api/requests?clinicId=...&status=...  — 요청 목록
export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const clinicId = sp.get("clinicId")
  if (!clinicId) return NextResponse.json({ error: "clinicId 가 필요합니다" }, { status: 400 })
  if (!canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 })

  const status = sp.get("status")
  const rows = await prisma.serviceRequest.findMany({
    where: { clinicId, ...(status ? { status: status as any } : {}) },
    include: requestInclude,
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(rows.map(serializeRequest))
}

// POST /api/requests  (multipart/form-data) — 새 요청 등록
export async function POST(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "multipart/form-data 로 보내 주세요" }, { status: 400 })
  }

  const clinicId = String(form.get("clinicId") ?? "")
  const category = String(form.get("category") ?? "") as RequestCategory
  const title = String(form.get("title") ?? "").trim()
  const description = String(form.get("description") ?? "").trim()
  const priority = String(form.get("priority") ?? "MEDIUM") as RequestPriority
  const dueDateRaw = String(form.get("dueDate") ?? "")
  let details: Record<string, string> = {}
  try {
    details = JSON.parse(String(form.get("details") ?? "{}"))
  } catch {
    return NextResponse.json({ error: "details 형식 오류" }, { status: 400 })
  }

  if (!clinicId || !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 })
  const def = CATEGORY_MAP[category]
  if (!def) return NextResponse.json({ error: "카테고리를 선택해 주세요" }, { status: 400 })
  if (!title) return NextResponse.json({ error: "제목을 입력해 주세요" }, { status: 400 })
  if (!description) return NextResponse.json({ error: "요청 내용을 입력해 주세요" }, { status: 400 })
  if (!["HIGH", "MEDIUM", "LOW"].includes(priority)) return NextResponse.json({ error: "우선순위 값 오류" }, { status: 400 })
  for (const f of def.fields) {
    if (f.required && !String(details[f.key] ?? "").trim()) {
      return NextResponse.json({ error: `${f.label} 을(를) 입력해 주세요` }, { status: 400 })
    }
  }
  // 정의된 필드만 저장
  const cleanDetails: Record<string, string> = {}
  for (const f of def.fields) {
    const v = String(details[f.key] ?? "").trim()
    if (v) cleanDetails[f.key] = v.slice(0, 2000)
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)
  const fileError = validateFiles(files)
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 })

  const created = await prisma.serviceRequest.create({
    data: {
      clinicId,
      category,
      title: title.slice(0, 200),
      description: description.slice(0, 5000),
      details: cleanDetails,
      priority,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      createdBy: actor.id,
    },
  })

  for (const file of files) {
    const saved = await saveRequestFile(clinicId, created.id, file)
    await prisma.serviceRequestAttachment.create({
      data: {
        requestId: created.id,
        fileName: saved.fileName,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        filePath: saved.filePath,
        kind: "REFERENCE",
        uploadedBy: actor.id,
      },
    })
  }

  const full = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: created.id }, include: requestInclude })
  const clinicName = (await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } }))?.name ?? ""
  await createNotifications({
    type: "REQUEST_NEW", clinicId, audience: actor.isMaster ? "clinic" : "masters", exclude: [actor.id],
    title: `${clinicName} 새 요청 · ${CATEGORY_MAP[category]?.short ?? category}`,
    body: `${title.slice(0, 80)}${priority === "HIGH" ? " (긴급)" : ""}${dueDateRaw ? ` · 희망 ${dueDateRaw}` : ""}`,
    link: `/dashboard/${clinicId}/requests?open=${created.id}`,
  }).catch((e) => console.error("[requests] 알림 실패", e?.message))
  return NextResponse.json(serializeRequest(full), { status: 201 })
}
