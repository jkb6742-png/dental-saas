import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export type Actor = { id: string; name: string; role: string; clinicId: string | null; isMaster: boolean }

/** 세션에서 실제 사용자(DB 기준)를 읽는다. 없으면 null. */
export async function getActor(): Promise<Actor | null> {
  const session = await auth()
  const sid = (session?.user as any)?.id as string | undefined
  const email = session?.user?.email ?? undefined
  if (!sid && !email) return null
  const user = await prisma.user.findFirst({
    where: sid ? { id: sid } : { email },
    select: { id: true, name: true, role: true, clinicId: true, inviteCode: { select: { clinicId: true } } },
  })
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    clinicId: user.clinicId ?? user.inviteCode?.clinicId ?? null,
    isMaster: user.role === "MASTER",
  }
}

/** 마스터는 전체, 그 외는 소속 치과만. */
export function canAccessClinic(actor: Actor, clinicId: string) {
  return actor.isMaster || actor.clinicId === clinicId
}
