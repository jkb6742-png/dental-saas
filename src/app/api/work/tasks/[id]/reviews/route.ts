import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, str } from "@/lib/work/common"
import { updateTask } from "@/lib/work/tasks"
import { createNotifications } from "@/lib/notifications"

type Ctx = { params: Promise<{ id: string }> }

// 의료광고 검수 기록. 담당자 본인은 검수할 수 없다(대표는 예외).
// 수정 요청이면 업무를 진행중으로 돌리고 담당자에게 알린다.
export async function POST(req: NextRequest, { params }: Ctx) {
  const task = await prisma.task.findUnique({ where: { id: (await params).id }, select: { id: true, clinicId: true, title: true, assigneeUserId: true, status: true } })
  if (!task) return fail("찾을 수 없습니다", 404)
  const g = await guard({ clinicId: task.clinicId })
  if ("res" in g) return g.res
  const actor = g.actor
  if (task.assigneeUserId === actor.id && !actor.isMaster) return fail("담당자 본인은 검수할 수 없습니다. 다른 직원에게 요청하세요", 403)

  const b = await req.json().catch(() => ({}))
  const decision = b.decision === "APPROVED" ? "APPROVED" : b.decision === "CHANGES_REQUIRED" ? "CHANGES_REQUIRED" : null
  if (!decision) return fail("검수 결과를 고르세요")
  const checks = { claimsChecked: !!b.claimsChecked, riskDisclosureChecked: !!b.riskDisclosureChecked, anonymizationChecked: !!b.anonymizationChecked }
  if (decision === "APPROVED" && !Object.values(checks).every(Boolean)) return fail("승인하려면 세 항목(과장·보장 표현, 부작용·주의사항, 환자 익명화)을 모두 확인해야 합니다")
  const note = str(b.note, 1000)
  if (decision === "CHANGES_REQUIRED" && !note) return fail("고칠 내용을 적어 주세요")

  let artifactVersionId: string | null = null
  if (b.artifactVersionId) {
    const v = await prisma.sharedFileVersion.findFirst({ where: { id: String(b.artifactVersionId), file: { taskId: task.id, deletedAt: null } }, select: { id: true } })
    if (!v) return fail("이 업무에 올린 파일만 고를 수 있습니다")
    artifactVersionId = v.id
  }
  const row = await prisma.taskReview.create({
    data: {
      taskId: task.id,
      reviewerUserId: actor.id,
      decision,
      ...checks,
      casePhotoConsentChecked: typeof b.casePhotoConsentChecked === "boolean" ? b.casePhotoConsentChecked : null,
      note,
      artifactVersionId,
    },
  })
  if (decision === "CHANGES_REQUIRED" && ["IN_REVIEW", "DONE"].includes(task.status)) await updateTask(task.id, { status: "IN_PROGRESS" }, actor.id).catch(() => {})
  if (task.assigneeUserId && task.assigneeUserId !== actor.id) {
    await createNotifications({
      type: "TASK_REVIEW",
      title: `검수 ${decision === "APPROVED" ? "승인" : "수정 요청"}: ${task.title}`,
      body: note ?? undefined,
      link: `/work/tasks?open=${task.id}`,
      clinicId: task.clinicId,
      audience: "masters",
      userIds: [task.assigneeUserId],
      dedupKey: `review:${row.id}`,
    })
  }
  return NextResponse.json(row, { status: 201 })
}
