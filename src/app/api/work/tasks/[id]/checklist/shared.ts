import { prisma } from "@/lib/db"
import { canAccessTask } from "@/lib/requests/access"
import { guard, fail } from "@/lib/work/common"

// 업무 체크리스트 공통: 직원·마스터 + 그 업무 접근 권한

export const itemSelect = { id: true, title: true, sortOrder: true, doneAt: true, doneByUserId: true, createdAt: true } as const

export async function loadTask(taskId: string) {
  const g = await guard()
  if ("res" in g) return { res: g.res } as const
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, clinicId: true } })
  if (!task || !canAccessTask(g.actor, task.clinicId)) return { res: fail("찾을 수 없습니다", 404) } as const
  return { actor: g.actor, task } as const
}

export const listItems = (taskId: string) =>
  prisma.taskChecklistItem.findMany({ where: { taskId }, select: itemSelect, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })
