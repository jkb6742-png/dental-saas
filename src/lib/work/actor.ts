import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getActor, type Actor } from "@/lib/requests/access"

export type WorkActor = Actor & { clinics: { id: string; name: string }[] }

/**
 * 직원 화면(/work) 공통 진입 검사. 직원·마스터만 통과, 원장은 자기 치과 화면으로 보낸다.
 * 반환하는 clinics 는 이 사람이 볼 수 있는 치과(마스터는 같은 에이전시 전체).
 */
export async function requireWorkActor(): Promise<WorkActor> {
  const actor = await getActor()
  if (!actor) redirect("/login")
  if (!actor.isMaster && !actor.isStaff) redirect("/dashboard")

  const me = await prisma.user.findUnique({ where: { id: actor.id }, select: { agencyId: true } })
  const clinics = await prisma.clinic.findMany({
    where: actor.isMaster
      ? { agencyId: me?.agencyId }
      : { id: { in: actor.clinicIds ?? [] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return { ...actor, clinics }
}

/** 이 직원이 볼 수 있는 치과 조건(Prisma where 조각). */
export function clinicScope(actor: WorkActor) {
  return { clinicId: { in: actor.clinics.map((c) => c.id) } }
}
