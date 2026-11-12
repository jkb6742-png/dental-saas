import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessTask } from "@/lib/requests/access"
import { taskSelect, updateTask, type TaskPatch } from "@/lib/work/tasks"

type Ctx = { params: Promise<{ id: string }> }

async function load(id: string) {
  const actor = await getActor()
  if (!actor || !(actor.isMaster || actor.isStaff)) return { error: NextResponse.json({ error: "권한이 없습니다" }, { status: 403 }) }
  const task = await prisma.task.findUnique({ where: { id }, select: { id: true, clinicId: true } })
  if (!task || !canAccessTask(actor, task.clinicId)) return { error: NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 }) }
  return { actor, task }
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const r = await load(id)
  if ("error" in r) return r.error
  const [task, comments, activities, assignable, reviews] = await Promise.all([
    prisma.task.findUniqueOrThrow({
      where: { id },
      select: {
        ...taskSelect,
        description: true,
        reviewRequired: true,
        resultUrl: true,
        quotaSlot: true,
        serviceRequest: { select: { id: true, title: true, status: true } },
        publishedContent: { select: { id: true, title: true, url: true } },
      },
    }),
    prisma.taskComment.findMany({
      where: { taskId: id, deletedAt: null },
      select: { id: true, body: true, createdAt: true, author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.taskActivity.findMany({
      where: { taskId: id },
      select: { id: true, type: true, oldValue: true, newValue: true, createdAt: true, actor: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // 이 치과에 배정할 수 있는 사람: 담당 직원 + 마스터(직원 등록된 경우)
    prisma.employee.findMany({
      where: {
        OR: [{ leftOn: null }, { leftOn: { gt: new Date() } }],
        ...(r.task.clinicId ? { AND: [{ OR: [{ user: { role: "MASTER" as const } }, { clinicAccess: { some: { clinicId: r.task.clinicId } } }] }] } : {}),
      },
      select: { userId: true, user: { select: { name: true } } },
    }),
    prisma.taskReview.findMany({
      where: { taskId: id },
      select: {
        id: true,
        decision: true,
        claimsChecked: true,
        riskDisclosureChecked: true,
        anonymizationChecked: true,
        casePhotoConsentChecked: true,
        note: true,
        reviewedAt: true,
        reviewer: { select: { name: true } },
        artifactVersion: { select: { versionNo: true, originalName: true } },
      },
      orderBy: { reviewedAt: "desc" },
    }),
  ])
  return NextResponse.json({ task, comments, activities, reviews, assignable: assignable.map((e) => ({ id: e.userId, name: e.user.name })) })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const r = await load(id)
  if ("error" in r) return r.error
  const b = (await req.json().catch(() => ({}))) as TaskPatch & { reviewRequired?: boolean }
  // 의료광고 검수가 필요한 원고는 검수 승인 뒤에만 완료
  if (b.status === "DONE") {
    const t = await prisma.task.findUniqueOrThrow({ where: { id }, select: { reviewRequired: true, reviews: { orderBy: { reviewedAt: "desc" }, take: 1, select: { decision: true } } } })
    if (t.reviewRequired && t.reviews[0]?.decision !== "APPROVED") {
      return NextResponse.json({ error: "의료광고 검수 승인 뒤에 완료할 수 있습니다" }, { status: 400 })
    }
  }
  if (typeof b.reviewRequired === "boolean") await prisma.task.update({ where: { id }, data: { reviewRequired: b.reviewRequired } })
  try {
    await updateTask(id, b, r.actor.id)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
  return NextResponse.json(await prisma.task.findUniqueOrThrow({ where: { id }, select: taskSelect }))
}
