import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

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

/** 소속 치과가 아니면 돌려줄 응답, 괜찮으면 null. 라우트 첫머리에서 쓴다. */
export async function denyClinic(clinicId: string | null | undefined) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  if (!clinicId || !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  return null
}

/** 마스터는 전체, 그 외는 소속 치과만. */
export function canAccessClinic(actor: Actor, clinicId: string) {
  return actor.isMaster || actor.clinicId === clinicId
}
