import type { Prisma, TaskCategory, TaskPriority, TaskStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { createNotifications } from "@/lib/notifications"

// 업무(Task) 공통 로직. 상태·담당자·마감이 바뀔 때마다 TaskActivity 를 남겨
// 나중에 직원별 처리량·상태별 체류 시간을 분석할 수 있게 한다.

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "할 일",
  BLOCKED: "자료 대기",
  IN_PROGRESS: "진행중",
  IN_REVIEW: "검토중",
  DONE: "완료",
  CANCELLED: "취소",
}

export const TASK_CATEGORY_LABEL: Record<TaskCategory, string> = {
  BLOG: "블로그",
  IMAGE: "이미지",
  WEBSITE: "홈페이지",
  REPORT: "보고서",
  ADS: "광고",
  MEETING: "미팅",
  OTHER: "기타",
}

// 원장 요청 분류 → 업무 분류
const FROM_REQUEST: Record<string, TaskCategory> = {
  IMAGE: "IMAGE",
  CONTENT: "BLOG",
  WEBSITE: "WEBSITE",
  REPORT: "REPORT",
  ADS: "ADS",
  OTHER: "OTHER",
}
const PRIORITY_FROM_REQUEST: Record<string, TaskPriority> = { HIGH: "HIGH", MEDIUM: "NORMAL", LOW: "LOW" }

/** 목록·상세 공통 조회 칸 */
export const taskSelect = {
  id: true,
  clinicId: true,
  groupId: true,
  sortOrder: true,
  title: true,
  category: true,
  status: true,
  priority: true,
  startOn: true,
  dueOn: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  serviceRequestId: true,
  assigneeUserId: true,
  clinic: { select: { name: true } },
  group: { select: { name: true } },
  assignee: { select: { user: { select: { name: true } } } },
  _count: { select: { comments: { where: { deletedAt: null } } } },
} satisfies Prisma.TaskSelect

const dateOnly = (d: Date | null | undefined) => (d ? new Date(d.toISOString().slice(0, 10) + "T00:00:00Z") : null)

/**
 * 원장 요청 1건 → 업무 1건. 이미 연결돼 있으면 그대로 둔다(serviceRequestId 고유).
 * 요청 저장 직후, 그리고 기존 요청 백필에 쓴다.
 */
export async function ensureTaskForRequest(requestId: string, tx: Prisma.TransactionClient = prisma) {
  const req = await tx.serviceRequest.findUnique({
    where: { id: requestId },
    select: { id: true, clinicId: true, title: true, category: true, priority: true, dueDate: true, createdBy: true, createdAt: true, status: true, completedAt: true, task: { select: { id: true } } },
  })
  if (!req) return null
  if (req.task) return req.task.id
  const status: TaskStatus = req.status === "DONE" ? "DONE" : req.status === "CANCELED" ? "CANCELLED" : req.status === "IN_PROGRESS" ? "IN_PROGRESS" : "TODO"
  const task = await tx.task.create({
    data: {
      clinicId: req.clinicId,
      serviceRequestId: req.id,
      title: req.title.slice(0, 200),
      category: FROM_REQUEST[req.category] ?? "OTHER",
      priority: PRIORITY_FROM_REQUEST[req.priority] ?? "NORMAL",
      dueOn: dateOnly(req.dueDate),
      status,
      completedAt: status === "DONE" ? req.completedAt ?? new Date() : null,
      createdByUserId: req.createdBy,
      createdAt: req.createdAt,
      activities: { create: { type: "CREATED", actorUserId: req.createdBy, newValue: "원장 요청" } },
    },
    select: { id: true },
  })
  return task.id
}

export type TaskPatch = {
  title?: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  category?: TaskCategory
  assigneeUserId?: string | null
  startOn?: string | null
  dueOn?: string | null
  groupId?: string | null
  sortOrder?: number
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const parseDay = (v: string | null | undefined) => (v && DATE.test(v) ? new Date(`${v}T00:00:00Z`) : null)
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "")

/** 업무 수정 + 변경 이력. 담당자 검증(그 치과 배정 직원 또는 마스터)은 여기서 한다. */
export async function updateTask(taskId: string, patch: TaskPatch, actorId: string) {
  const cur = await prisma.task.findUniqueOrThrow({ where: { id: taskId } })
  const data: Prisma.TaskUncheckedUpdateInput = {}
  const acts: Prisma.TaskActivityCreateManyInput[] = []
  const act = (type: Prisma.TaskActivityCreateManyInput["type"], oldValue: string, newValue: string) =>
    acts.push({ taskId, actorUserId: actorId, type, oldValue: oldValue.slice(0, 300), newValue: newValue.slice(0, 300) })

  if (patch.title !== undefined && patch.title.trim() && patch.title !== cur.title) {
    data.title = patch.title.trim().slice(0, 200)
    act("CONTENT_CHANGED", cur.title, String(data.title))
  }
  if (patch.description !== undefined && patch.description !== cur.description) data.description = patch.description?.slice(0, 10000) ?? null
  if (patch.priority && patch.priority !== cur.priority) data.priority = patch.priority
  if (patch.category && patch.category !== cur.category) data.category = patch.category
  if (patch.startOn !== undefined) data.startOn = parseDay(patch.startOn)

  if (patch.dueOn !== undefined) {
    const next = parseDay(patch.dueOn)
    if (ymd(next) !== ymd(cur.dueOn)) {
      data.dueOn = next
      act("DUE_DATE_CHANGED", ymd(cur.dueOn), ymd(next))
    }
  }

  if (patch.assigneeUserId !== undefined && patch.assigneeUserId !== cur.assigneeUserId) {
    if (patch.assigneeUserId) {
      const ok = await prisma.employee.findFirst({
        where: {
          userId: patch.assigneeUserId,
          // 사내 업무는 재직 직원 누구나, 치과 업무는 그 치과 담당 직원 또는 대표
          ...(cur.clinicId ? { OR: [{ user: { role: "MASTER" as const } }, { clinicAccess: { some: { clinicId: cur.clinicId } } }] } : {}),
          AND: [{ OR: [{ leftOn: null }, { leftOn: { gt: new Date() } }] }],
        },
        select: { userId: true },
      })
      if (!ok) throw new Error("이 치과에 배정되지 않은 직원입니다")
    }
    data.assigneeUserId = patch.assigneeUserId
    act("ASSIGNEE_CHANGED", cur.assigneeUserId ?? "", patch.assigneeUserId ?? "")
  }

  if (patch.groupId !== undefined && patch.groupId !== cur.groupId) {
    if (patch.groupId) {
      const g = await prisma.taskGroup.findUnique({ where: { id: patch.groupId }, select: { clinicId: true } })
      if (!g || g.clinicId !== cur.clinicId) throw new Error("같은 치과의 그룹으로만 옮길 수 있습니다")
    }
    data.groupId = patch.groupId
  }
  if (typeof patch.sortOrder === "number" && Number.isFinite(patch.sortOrder)) data.sortOrder = Math.round(patch.sortOrder)

  if (patch.status && patch.status !== cur.status) {
    data.status = patch.status
    const reopened = (cur.status === "DONE" || cur.status === "CANCELLED") && patch.status !== "DONE" && patch.status !== "CANCELLED"
    act(reopened ? "REOPENED" : "STATUS_CHANGED", cur.status, patch.status)
    data.completedAt = patch.status === "DONE" ? new Date() : null
  }

  if (Object.keys(data).length === 0) return cur
  const [updated] = await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data }),
    prisma.taskActivity.createMany({ data: acts }),
  ])

  if (data.assigneeUserId && data.assigneeUserId !== actorId) {
    await createNotifications({
      type: "TASK_ASSIGNED",
      audience: "masters",
      userIds: [String(data.assigneeUserId)],
      clinicId: cur.clinicId,
      title: `업무 배정 · ${updated.title.slice(0, 80)}`,
      link: `/work/tasks?open=${taskId}`,
    }).catch(() => {})
  }
  return updated
}
