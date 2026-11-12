import { auth, accessibleClinicIds } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export type Actor = {
  id: string
  name: string
  role: string
  clinicId: string | null
  /** 접근 가능한 치과. MASTER 는 null(전체), 직원은 배정 치과, 원장은 소속 치과 */
  clinicIds: string[] | null
  isMaster: boolean
  isStaff: boolean
}

/** 세션에서 실제 사용자(DB 기준)를 읽는다. 없으면 null. */
export async function getActor(): Promise<Actor | null> {
  const session = await auth()
  const sid = (session?.user as any)?.id as string | undefined
  const email = session?.user?.email ?? undefined
  if (!sid && !email) return null
  const user = await prisma.user.findFirst({
    where: sid ? { id: sid } : { email },
    select: {
      id: true,
      name: true,
      role: true,
      clinicId: true,
      inviteCode: { select: { clinicId: true } },
      employee: { select: { leftOn: true, clinicAccess: { select: { clinicId: true } } } },
    },
  })
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    clinicId: user.clinicId ?? user.inviteCode?.clinicId ?? null,
    clinicIds: accessibleClinicIds(user),
    isMaster: user.role === "MASTER",
    isStaff: user.role === "STAFF",
  }
}

/** 소속 치과가 아니면 돌려줄 응답, 괜찮으면 null. 라우트 첫머리에서 쓴다. */
export async function denyClinic(clinicId: string | null | undefined) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  if (!clinicId || !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  return null
}

/** 마스터는 전체, 직원은 배정 치과, 원장은 소속 치과만. */
/** 업무 접근: 사내 업무(치과 없음)는 직원·마스터 모두, 치과 업무는 그 치과 권한 */
export function canAccessTask(actor: Actor, clinicId: string | null) {
  if (clinicId === null) return actor.isMaster || actor.isStaff
  return canAccessClinic(actor, clinicId)
}

export function canAccessClinic(actor: Actor, clinicId: string) {
  return actor.isMaster || (actor.clinicIds ?? []).includes(clinicId)
}

/**
 * 치과 자료 업로드 기록. 직원 누구나 올릴 수 있으므로 누가 언제 무엇을 올렸는지 남긴다.
 * 기록 실패는 업로드를 막지 않는다.
 */
export async function logDataUpload(clinicId: string, event: string, details: Record<string, unknown>) {
  try {
    const actor = await getActor()
    await prisma.securityLog.create({
      data: { userId: actor?.id ?? null, event, clinicId, details: details as any, severity: "LOW" },
    })
  } catch (e) {
    console.error("업로드 기록 실패:", e)
  }
}
