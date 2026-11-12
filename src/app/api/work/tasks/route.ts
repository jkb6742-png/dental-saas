import { NextRequest, NextResponse } from "next/server"
import type { Prisma, TaskCategory, TaskPriority, TaskStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic, canAccessTask } from "@/lib/requests/access"
import { TASK_CATEGORY_LABEL, taskSelect, updateTask } from "@/lib/work/tasks"

// 직원 업무 목록·생성. 프록시가 /api/work 를 직원·마스터로 제한하고, 여기서 치과 범위를 건다.

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"] as const
const CATEGORIES = Object.keys(TASK_CATEGORY_LABEL) as TaskCategory[]
const PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const

async function internalActor() {
  const actor = await getActor()
  return actor && (actor.isMaster || actor.isStaff) ? actor : null
}


export async function GET(req: NextRequest) {
  const actor = await internalActor()
  if (!actor) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  const q = req.nextUrl.searchParams

  // clinicId=internal 이면 사내 업무만
  const clinicId = q.get("clinicId")
  if (clinicId && clinicId !== "internal" && !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  const where: Prisma.TaskWhereInput =
    clinicId === "internal"
      ? { clinicId: null }
      : clinicId
        ? { clinicId }
        : actor.isMaster
          ? {}
          : { OR: [{ clinicId: { in: actor.clinicIds ?? [] } }, { clinicId: null }] }

  const status = q.get("status")
  if (status === "open") where.status = { in: ["TODO", "BLOCKED", "IN_PROGRESS", "IN_REVIEW"] }
  else if (status && (STATUSES as readonly string[]).includes(status)) where.status = status as TaskStatus
  const assignee = q.get("assignee")
  if (assignee === "me") where.assigneeUserId = actor.id
  else if (assignee === "none") where.assigneeUserId = null
  else if (assignee) where.assigneeUserId = assignee
  // 마감 필터: overdue(지남) / today / week(7일 안), 검수 대기: review=1
  const due = q.get("due")
  const todayYmd = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const day0 = new Date(`${todayYmd}T00:00:00Z`)
  if (due === "overdue") Object.assign(where, { dueOn: { lt: day0 }, status: { in: ["TODO", "BLOCKED", "IN_PROGRESS", "IN_REVIEW"] } })
  else if (due === "today") where.dueOn = day0
  else if (due === "week") where.dueOn = { gte: day0, lt: new Date(day0.getTime() + 7 * 86400_000) }
  if (q.get("review") === "1") Object.assign(where, { reviewRequired: true, status: { notIn: ["DONE", "CANCELLED"] } })
  const category = q.get("category")
  if (category && CATEGORIES.includes(category as TaskCategory)) where.category = category as TaskCategory

  const rows = await prisma.task.findMany({
    where,
    select: taskSelect,
    orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 500,
  })
  return NextResponse.json({ tasks: rows })
}

export async function POST(req: NextRequest) {
  const actor = await internalActor()
  if (!actor) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  const b = await req.json().catch(() => null)
  if (!b || typeof b !== "object") return NextResponse.json({ error: "잘못된 요청" }, { status: 400 })

  // clinicId 가 비었거나 "internal" 이면 THINKLAB 사내 업무
  const rawClinic = String(b.clinicId ?? "")
  const clinicId = rawClinic && rawClinic !== "internal" ? rawClinic : null
  if (!canAccessTask(actor, clinicId)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  let groupId: string | null = null
  if (b.groupId) {
    const g = await prisma.taskGroup.findUnique({ where: { id: String(b.groupId) }, select: { id: true, clinicId: true, archivedAt: true } })
    if (!g || g.clinicId !== clinicId || g.archivedAt) return NextResponse.json({ error: "그룹을 찾을 수 없습니다" }, { status: 400 })
    groupId = g.id
  }
  const last = groupId ? await prisma.task.aggregate({ where: { groupId }, _max: { sortOrder: true } }) : null
  const title = String(b.title ?? "").trim()
  if (!title) return NextResponse.json({ error: "제목을 입력하세요" }, { status: 400 })
  const category = CATEGORIES.includes(b.category) ? (b.category as TaskCategory) : "OTHER"
  const priority = (PRIORITIES as readonly string[]).includes(b.priority) ? (b.priority as TaskPriority) : "NORMAL"

  const task = await prisma.task.create({
    data: {
      clinicId,
      groupId,
      sortOrder: (last?._max.sortOrder ?? 0) + 1,
      title: title.slice(0, 200),
      description: b.description ? String(b.description).slice(0, 10000) : null,
      category,
      priority,
      createdByUserId: actor.id,
      activities: { create: { type: "CREATED", actorUserId: actor.id } },
    },
    select: { id: true },
  })
  // 담당자·날짜는 검증·이력·알림이 붙은 공통 경로로
  try {
    // "__me__" = 만든 사람이 담당. 직원 정보(Employee)가 없는 계정이면 미배정으로 둔다.
    let assignee: string | undefined = b.assigneeUserId ?? undefined
    if (assignee === "__me__") {
      const emp = await prisma.employee.findUnique({ where: { userId: actor.id }, select: { userId: true } })
      assignee = emp ? actor.id : undefined
    }
    await updateTask(task.id, { assigneeUserId: assignee, startOn: b.startOn, dueOn: b.dueOn }, actor.id)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, id: task.id }, { status: 400 })
  }
  const row = await prisma.task.findUniqueOrThrow({ where: { id: task.id }, select: taskSelect })
  return NextResponse.json(row, { status: 201 })
}
