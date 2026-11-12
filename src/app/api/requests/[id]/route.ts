import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createNotifications } from "@/lib/notifications"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { STATUS_META, type RequestStatus } from "@/lib/requests/categories"
import { fetchOne, serializeRequest } from "@/lib/requests/serialize"
import { updateTask } from "@/lib/work/tasks"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const { id } = await params
  const row = await fetchOne(id)
  if (!row || !canAccessClinic(actor, row.clinicId)) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 })
  return NextResponse.json(serializeRequest(row))
}

// PATCH — THINKLAB(마스터·담당 직원): 상태·담당자·희망일·결과 메모 / 치과 계정: 접수 상태에서 내용 수정·취소
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const { id } = await params
  const row = await prisma.serviceRequest.findUnique({ where: { id } })
  if (!row || !canAccessClinic(actor, row.clinicId)) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  const validPriority = (p: unknown) => ["HIGH", "MEDIUM", "LOW"].includes(String(p))

  const internal = actor.isMaster || actor.isStaff
  if (internal) {
    if (body.status) {
      if (!STATUS_META[body.status as RequestStatus]) return NextResponse.json({ error: "상태 값 오류" }, { status: 400 })
      data.status = body.status
      data.completedAt = body.status === "DONE" ? new Date() : null
    }
    if (body.assignee !== undefined) data.assignee = String(body.assignee ?? "").slice(0, 50) || null
    if (body.resultNote !== undefined) data.resultNote = String(body.resultNote ?? "").slice(0, 3000) || null
    if (body.priority && validPriority(body.priority)) data.priority = body.priority
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
  } else {
    if (body.status === "CANCELED") {
      if (!["REQUESTED", "IN_REVIEW"].includes(row.status)) {
        return NextResponse.json({ error: "진행중인 요청은 취소할 수 없습니다. 댓글로 알려 주세요." }, { status: 400 })
      }
      data.status = "CANCELED"
    }
    if (row.status === "REQUESTED") {
      if (body.title) data.title = String(body.title).trim().slice(0, 200)
      if (body.description) data.description = String(body.description).trim().slice(0, 5000)
      if (body.priority && validPriority(body.priority)) data.priority = body.priority
      if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
      if (body.details && typeof body.details === "object") data.details = body.details
    }
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 })
  await prisma.serviceRequest.update({ where: { id }, data: data as any })
  // 연결된 업무도 완료·취소를 따라간다(되돌리기는 업무 화면에서)
  if (data.status === "DONE" || data.status === "CANCELED") {
    const task = await prisma.task.findUnique({ where: { serviceRequestId: id }, select: { id: true } })
    if (task) await updateTask(task.id, { status: data.status === "DONE" ? "DONE" : "CANCELLED" }, actor.id).catch(() => {})
  }
  const full = await fetchOne(id)
  // 상태가 바뀌면 상대편에 알림 (마스터 변경 → 치과 / 치과 취소 → 마스터)
  if (data.status && data.status !== row.status) {
    const clinicName = (await prisma.clinic.findUnique({ where: { id: row.clinicId }, select: { name: true } }))?.name ?? ""
    const label = STATUS_META[data.status as RequestStatus]?.label ?? String(data.status)
    createNotifications({
      type: "REQUEST_STATUS", clinicId: row.clinicId, audience: internal ? "clinic" : "masters", exclude: [actor.id],
      title: `${internal ? "" : clinicName + " "}요청 ${label} · ${row.title.slice(0, 60)}`,
      body: data.status === "DONE" && data.resultNote ? String(data.resultNote).slice(0, 200) : internal ? `THINKLAB 이 상태를 '${label}'(으)로 변경했습니다.` : `치과에서 요청을 취소했습니다.`,
      link: `/dashboard/${row.clinicId}/requests?open=${id}`,
    }).catch((e) => console.error("[requests] 알림 실패", e?.message))
  }
  return NextResponse.json(serializeRequest(full!))
}

// DELETE — 마스터만
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const actor = await getActor()
  if (!actor?.isMaster) return NextResponse.json({ error: "마스터만 삭제할 수 있습니다" }, { status: 403 })
  const { id } = await params
  await prisma.serviceRequest.delete({ where: { id } }).catch(() => null)
  return NextResponse.json({ ok: true })
}
