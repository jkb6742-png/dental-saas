export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import { requireWorkActor, clinicScope } from "@/lib/work/actor"
import { ensureTaskForRequest } from "@/lib/work/tasks"
import TasksClient from "./TasksClient"

export default async function TasksPage() {
  const actor = await requireWorkActor()

  // 업무가 아직 없는 원장 요청(기능 도입 전 요청 등)은 여기서 한 번 이어 붙인다
  const orphan = await prisma.serviceRequest.findMany({
    where: { ...clinicScope(actor), task: null },
    select: { id: true },
    take: 200,
  })
  for (const r of orphan) await ensureTaskForRequest(r.id).catch(() => {})

  return <TasksClient clinics={actor.clinics} me={{ id: actor.id, name: actor.name }} />
}
