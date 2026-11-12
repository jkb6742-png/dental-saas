import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic, type Actor } from "@/lib/requests/access"

// 직원 API 공통: 직원·마스터 확인, 오류 응답, 한국 날짜·월 계산, 감사 기록.

export const KST_MS = 9 * 3600_000

export async function internalActor(): Promise<Actor | null> {
  const actor = await getActor()
  return actor && (actor.isMaster || actor.isStaff) ? actor : null
}

export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })
export const forbidden = () => fail("권한이 없습니다", 403)

/** 직원·마스터만, 치과가 주어지면 그 치과 권한까지 확인. 통과하면 actor, 아니면 응답. */
export async function guard(opts: { clinicId?: string | null; master?: boolean } = {}) {
  const actor = await internalActor()
  if (!actor) return { res: forbidden() } as const
  if (opts.master && !actor.isMaster) return { res: forbidden() } as const
  if (opts.clinicId !== undefined && opts.clinicId !== null && !canAccessClinic(actor, opts.clinicId)) return { res: forbidden() } as const
  return { actor } as const
}

/** 이 사람이 볼 수 있는 치과 조건 (마스터 = 제한 없음) */
export function clinicWhere(actor: Actor) {
  return actor.isMaster ? {} : { clinicId: { in: actor.clinicIds ?? [] } }
}

/** 오늘 한국 날짜 YYYY-MM-DD */
export const kstToday = () => new Date(Date.now() + KST_MS).toISOString().slice(0, 10)
export const kstYmd = (d: Date) => new Date(d.getTime() + KST_MS).toISOString().slice(0, 10)
/** @db.Date 칸은 UTC 자정 */
export const dateOnly = (ymd: string) => new Date(`${ymd}T00:00:00Z`)
export const ymdOf = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)

export const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s))
export const isMonth = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)

/** "2026-11" → 월 첫날·다음 달 첫날(UTC 자정) */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const next = new Date(Date.UTC(y, m, 1))
  return { start, next }
}
export const currentMonth = () => kstToday().slice(0, 7)
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}
/** 그 달 n일(말일 넘으면 말일) */
export function dayInMonth(month: string, day: number) {
  const { start, next } = monthRange(month)
  const last = new Date(next.getTime() - 86400_000).getUTCDate()
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), Math.min(Math.max(1, day), last)))
}

/** 관리 변경 기록(SecurityLog 재사용). 실패해도 본 작업은 막지 않는다. */
export async function audit(actorId: string | null, event: string, clinicId: string | null, details: Record<string, unknown>) {
  try {
    await prisma.securityLog.create({ data: { userId: actorId, event, clinicId, details: details as any, severity: "LOW" } })
  } catch (e) {
    console.error("감사 기록 실패:", e)
  }
}

/** 문자열 칸 정리: 비면 null, 길이 제한 */
export const str = (v: unknown, max: number) => {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s ? s.slice(0, max) : null
}
