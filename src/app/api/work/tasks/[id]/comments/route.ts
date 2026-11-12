import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessTask } from "@/lib/requests/access"
import { createNotifications } from "@/lib/notifications"

type Ctx = { params: Promise<{ id: string }> }

// 업무 내부 댓글(직원끼리만). 원장과의 대화는 원장 요청 댓글을 쓴다.
export async function POST(req: NextRequest, { params }: Ctx) {
  const actor = await getActor()
  if (!actor || !(actor.isMaster || actor.isStaff)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  const { id } = await params
  const task = await prisma.task.findUnique({ where: { id }, select: { id: true, clinicId: true, title: true, assigneeUserId: true } })
  if (!task || !canAccessTask(actor, task.clinicId)) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 })

  const b = await req.json().catch(() => ({}))
  const body = String(b.body ?? "").trim()
  if (!body) return NextResponse.json({ error: "내용을 입력하세요" }, { status: 400 })

  const c = await prisma.taskComment.create({
    data: { taskId: id, authorUserId: actor.id, body: body.slice(0, 5000) },
    select: { id: true, body: true, createdAt: true, author: { select: { id: true, name: true } } },
  })
  if (task.assigneeUserId && task.assigneeUserId !== actor.id) {
    await createNotifications({
      type: "TASK_COMMENT",
      audience: "masters",
      userIds: [task.assigneeUserId],
      clinicId: task.clinicId,
      title: `업무 댓글 · ${task.title.slice(0, 60)}`,
      body: `${actor.name}: ${body.slice(0, 120)}`,
      link: `/work/tasks?open=${id}`,
    }).catch(() => {})
  }
  return NextResponse.json(c, { status: 201 })
}
