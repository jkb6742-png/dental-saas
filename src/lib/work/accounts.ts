import type { Prisma } from "@prisma/client"
import type { Actor } from "@/lib/requests/access"
import { prisma } from "@/lib/db"
import { str } from "./common"

// 계정 관리 공통: 볼 수 있는 범위, 입력 정리.
// 대표는 전부. 직원은 visibility=STAFF 인 사내 계정과 담당 치과 계정만.

export async function agencyOf(userId: string) {
  return (await prisma.user.findUnique({ where: { id: userId }, select: { agencyId: true } }))?.agencyId ?? null
}

export function accountScope(actor: Actor, agencyId: string): Prisma.ServiceAccountWhereInput {
  if (actor.isMaster) return { agencyId }
  return { agencyId, visibility: "STAFF", OR: [{ clinicId: null }, { clinicId: { in: actor.clinicIds ?? [] } }] }
}

export function canEditAccount(actor: Actor, clinicId: string | null) {
  if (actor.isMaster) return true
  return !!clinicId && (actor.clinicIds ?? []).includes(clinicId)
}

export function parseAccount(b: Record<string, unknown>, isMaster: boolean) {
  const category = str(b.category, 40)
  if (!category) return { error: "분류를 입력하세요 (예: 네이버, 인스타그램)" } as const
  const url = str(b.url, 500)
  if (url && !/^(https?:\/\/|www\.)/i.test(url)) return { error: "링크는 http:// 또는 www. 로 시작해야 합니다" } as const
  return {
    data: {
      category,
      label: str(b.label, 80),
      loginId: str(b.loginId, 200),
      url,
      memo: str(b.memo, 500),
      // 직원이 만든 계정은 항상 직원 공개(대표 전용으로 숨기면 본인도 못 봄)
      visibility: isMaster && b.visibility === "MASTER" ? "MASTER" : "STAFF",
    },
  } as const
}

export const accountSelect = {
  id: true,
  clinicId: true,
  category: true,
  label: true,
  loginId: true,
  url: true,
  memo: true,
  visibility: true,
  passwordEnc: true,
  passwordChangedAt: true,
  updatedAt: true,
} satisfies Prisma.ServiceAccountSelect

/** 목록 응답: 비밀번호는 절대 넣지 않고 있는지만 */
export function publicAccount(a: Prisma.ServiceAccountGetPayload<{ select: typeof accountSelect }>) {
  const { passwordEnc, ...rest } = a
  return { ...rest, hasPassword: !!passwordEnc }
}
