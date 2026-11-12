import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { canAccessClinic, type Actor } from "@/lib/requests/access"
import { guard, fail, str, kstToday, dateOnly } from "@/lib/work/common"
import { taskSelect } from "@/lib/work/tasks"

// 업무 보드: 카테고리(THINKLAB 사내 + 치과) → 그룹 → 업무.
// scope = "internal"(사내) · clinicId · 묶음 보기 "all"(전체 업무) · "mine"(내 업무) · "overdue"(지연 업무).

const OPEN = ["TODO", "BLOCKED", "IN_PROGRESS", "IN_REVIEW"] as const
const CROSS = ["all", "mine", "overdue"] as const

function scopeClinic(scope: string | null) {
  if (!scope) return undefined
  return scope === "internal" ? null : scope
}

/** 이 사람이 볼 수 있는 업무(사내 + 담당 치과) */
const visibleTasks = (actor: Actor): Prisma.TaskWhereInput =>
  actor.isMaster ? {} : { OR: [{ clinicId: null }, { clinicId: { in: actor.clinicIds ?? [] } }] }

/** 보드 표에 쓰는 업무 칸: 공통 칸 + 활동 수 + 계약 순번 + 검수 여부 */
const boardTaskSelect = {
  ...taskSelect,
  reviewRequired: true,
  quotaSlot: true,
  monthlyCommitment: { select: { targetCount: true } },
  _count: { select: { comments: { where: { deletedAt: null } }, files: { where: { deletedAt: null } }, checklist: true } },
} satisfies Prisma.TaskSelect

export async function GET(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const scope = req.nextUrl.searchParams.get("scope")
  const today = dateOnly(kstToday())

  // 카테고리 목록 + 진행 중·마감 지난 업무 수
  if (!scope) {
    const me = await prisma.user.findUnique({ where: { id: actor.id }, select: { agencyId: true } })
    const clinics = await prisma.clinic.findMany({
      where: actor.isMaster ? { agencyId: me?.agencyId } : { id: { in: actor.clinicIds ?? [] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
    const vis = visibleTasks(actor)
    const [open, overdue, mine] = await Promise.all([
      prisma.task.groupBy({ by: ["clinicId"], where: { status: { in: [...OPEN] } }, _count: true }),
      prisma.task.groupBy({ by: ["clinicId"], where: { status: { in: [...OPEN] }, dueOn: { lt: today } }, _count: true }),
      prisma.task.count({ where: { AND: [vis, { status: { in: [...OPEN] }, assigneeUserId: actor.id }] } }),
    ])
    const count = (rows: { clinicId: string | null; _count: number }[], id: string | null) => rows.find((r) => r.clinicId === id)?._count ?? 0
    const ids = new Set<string | null>([null, ...clinics.map((c) => c.id)])
    const sum = (rows: { clinicId: string | null; _count: number }[]) => rows.filter((r) => ids.has(r.clinicId)).reduce((s, r) => s + r._count, 0)
    return NextResponse.json({
      categories: [
        { id: "internal", name: "THINKLAB 사내", open: count(open, null), overdue: count(overdue, null) },
        ...clinics.map((c) => ({ id: c.id, name: c.name, open: count(open, c.id), overdue: count(overdue, c.id) })),
      ],
      quick: { all: sum(open), mine, overdue: sum(overdue) },
    })
  }

  const cross = (CROSS as readonly string[]).includes(scope)
  const clinicId = cross ? undefined : scopeClinic(scope)!
  if (clinicId && !canAccessClinic(actor, clinicId)) return fail("권한이 없습니다", 403)
  const done = req.nextUrl.searchParams.get("done") === "1"
  const recent = done ? {} : { OR: [{ status: { in: [...OPEN] } }, { completedAt: { gte: new Date(Date.now() - 7 * 86400_000) } }] }

  let where: Prisma.TaskWhereInput
  if (!cross) where = { clinicId, ...recent }
  else if (scope === "mine") where = { AND: [visibleTasks(actor), { assigneeUserId: actor.id }, recent] }
  else if (scope === "overdue") where = { AND: [visibleTasks(actor), { status: { in: [...OPEN] }, dueOn: { lt: today } }] }
  else where = { AND: [visibleTasks(actor), recent] }

  const [groups, rawTasks, employees] = await Promise.all([
    cross
      ? prisma.taskGroup.findMany({
          where: { archivedAt: null, ...(actor.isMaster ? {} : { OR: [{ clinicId: null }, { clinicId: { in: actor.clinicIds ?? [] } }] }) },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, name: true, sortOrder: true, clinicId: true },
        })
      : prisma.taskGroup.findMany({ where: { clinicId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, sortOrder: true, clinicId: true } }),
    prisma.task.findMany({
      where,
      select: boardTaskSelect,
      orderBy: cross ? [{ dueOn: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] : [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 1000,
    }),
    // 배정 가능한 사람: 사내 업무는 재직 직원 전원, 치과 업무는 담당 직원 + 대표
    prisma.employee.findMany({
      where: {
        OR: [{ leftOn: null }, { leftOn: { gt: new Date() } }],
        ...(clinicId ? { AND: [{ OR: [{ user: { role: "MASTER" as const } }, { clinicAccess: { some: { clinicId } } }] }] } : {}),
      },
      select: { userId: true, user: { select: { name: true, role: true } }, clinicAccess: { select: { clinicId: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ])

  // 체크리스트 완료 수(표에 "2/4")
  const withList = rawTasks.filter((t) => t._count.checklist > 0).map((t) => t.id)
  const doneRows = withList.length
    ? await prisma.taskChecklistItem.groupBy({ by: ["taskId"], where: { taskId: { in: withList }, doneAt: { not: null } }, _count: true })
    : []
  const doneMap = new Map(doneRows.map((r) => [r.taskId, r._count]))
  const tasks = rawTasks.map((t) => ({ ...t, checklistDone: doneMap.get(t.id) ?? 0 }))

  return NextResponse.json({
    groups,
    tasks,
    // clinicIds: null = 어느 치과든 배정 가능(대표)
    assignable: employees.map((e) => ({ id: e.userId, name: e.user.name, clinicIds: e.user.role === "MASTER" ? null : e.clinicAccess.map((a) => a.clinicId) })),
  })
}

/** 그룹 만들기 { scope, name } */
export async function POST(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const b = await req.json().catch(() => ({}))
  const rawScope = typeof b.scope === "string" ? b.scope : null
  if (rawScope && (CROSS as readonly string[]).includes(rawScope)) return fail("사내 또는 치과를 먼저 고르세요")
  const clinicId = scopeClinic(rawScope)
  if (clinicId === undefined) return fail("카테고리를 고르세요")
  if (clinicId && !canAccessClinic(g.actor, clinicId)) return fail("권한이 없습니다", 403)
  const name = str(b.name, 60)
  if (!name) return fail("그룹 이름을 입력하세요")
  const last = await prisma.taskGroup.aggregate({ where: { clinicId, archivedAt: null }, _max: { sortOrder: true } })
  const row = await prisma.taskGroup.create({
    data: { clinicId, name, sortOrder: (last._max.sortOrder ?? 0) + 1, createdByUserId: g.actor.id },
    select: { id: true, name: true, sortOrder: true, clinicId: true },
  })
  return NextResponse.json(row, { status: 201 })
}
