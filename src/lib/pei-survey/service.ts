import crypto from "crypto"
import { prisma } from "@/lib/db"
import {
  DEFAULT_SURVEYS, DEFAULT_TREATMENTS, FACILITY_WITH_PARKING, SCORE_KEYS, cleanSlug, defaultIntro, itemAverages,
  normalizeDoctors, normalizeQuestions, slugFromName, type Doctor, type QuestionDef,
} from "./questions"

const TOKEN_CHARS = "abcdefghijkmnpqrstuvwxyz23456789" // 헷갈리는 l·o·0·1 제외

export function newToken(len = 8) {
  const bytes = crypto.randomBytes(len)
  return Array.from(bytes, (b) => TOKEN_CHARS[b % TOKEN_CHARS.length]).join("")
}

export type SurveyDTO = {
  id: string; clinicId: string; token: string; slug: string | null; title: string; slogan: string | null; logo: string | null; intro: string | null
  doctors: Doctor[]; treatments: string[]; facilityQuestion: string; isActive: boolean
  questions: QuestionDef[]
}

export function toDTO(s: any): SurveyDTO {
  const treatments: string[] = Array.isArray(s.treatments) ? s.treatments.map(String) : []
  return {
    id: s.id, clinicId: s.clinicId, token: s.token, slug: s.slug ?? null, title: s.title, slogan: s.slogan ?? null, logo: s.logo ?? null, intro: s.intro,
    doctors: normalizeDoctors(s.doctors),
    treatments, facilityQuestion: s.facilityQuestion, isActive: s.isActive,
    questions: normalizeQuestions(s.questions, s.facilityQuestion, treatments),
  }
}

export async function getSurvey(clinicId: string): Promise<SurveyDTO | null> {
  const s = await prisma.peiSurvey.findUnique({ where: { clinicId } })
  return s ? toDTO(s) : null
}

/** 설문이 없으면 치과 코드별 기본값(구글폼 선택지)으로 만든다. */
export async function getOrCreateSurvey(clinicId: string): Promise<SurveyDTO> {
  const existing = await getSurvey(clinicId)
  if (existing) {
    if (existing.slug) return existing
    // 한글 주소가 없던 설문(초기 버전)은 치과명으로 채운다 — 다른 치과가 쓰고 있으면 비워 둔다
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } })
    const slug = clinic ? cleanSlug(slugFromName(clinic.name)) : null
    if (!slug) return existing
    try {
      return toDTO(await prisma.peiSurvey.update({ where: { id: existing.id }, data: { slug } }))
    } catch {
      return existing
    }
  }
  const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { name: true, code: true } })
  const def = DEFAULT_SURVEYS[clinic.code] ?? { doctors: [], facilityQuestion: FACILITY_WITH_PARKING }
  // 기본 사진은 public/pei-doctors/<치과코드>/<순번>.jpg 에 있으면 붙인다
  const doctors: Doctor[] = def.doctors.map((name, i) => ({ name, photo: def.photos?.[i] ?? null }))
  let slug = cleanSlug(slugFromName(clinic.name))
  for (let i = 0; i < 5; i++) {
    try {
      const s = await prisma.peiSurvey.create({
        data: {
          clinicId, token: newToken(), slug, title: `${clinic.name} 진료만족도조사`, slogan: def.slogan ?? null, logo: def.logo ?? null,
          intro: defaultIntro(clinic.name), doctors, treatments: def.treatments ?? DEFAULT_TREATMENTS,
          facilityQuestion: def.facilityQuestion,
        },
      })
      return toDTO(s)
    } catch (e: any) {
      if (e?.code !== "P2002") throw e
      const raced = await getSurvey(clinicId) // 동시 생성 또는 토큰·주소 충돌
      if (raced) return raced
      if (String(e?.meta?.target ?? "").includes("slug")) slug = null
    }
  }
  throw new Error("설문 링크 생성 실패")
}

export async function getSurveyByToken(token: string) {
  const s = await prisma.peiSurvey.findUnique({ where: { token }, include: { clinic: { select: { name: true } } } })
  return s ? { ...toDTO(s), clinicName: s.clinic.name } : null
}

export async function getSurveyBySlug(slug: string) {
  const s = await prisma.peiSurvey.findUnique({ where: { slug }, include: { clinic: { select: { name: true } } } })
  return s ? { ...toDTO(s), clinicName: s.clinic.name } : null
}

/** 월 응답 통계 + 최근 12개월 추이 */
export async function surveyStats(clinicId: string, year: number, month: number) {
  const rows = await prisma.peiResponse.findMany({
    where: { clinicId, year, month },
    orderBy: { submittedAt: "desc" },
  })
  const { items, pei } = itemAverages(rows)

  // 그룹별 응답 수 + PEI
  const grouped = (keysOf: (r: (typeof rows)[number]) => string[]) => {
    const g = new Map<string, typeof rows>()
    for (const r of rows) for (const k of keysOf(r)) g.set(k, [...(g.get(k) ?? []), r])
    return [...g.entries()]
      .map(([name, rs]) => ({ name, count: rs.length, pei: itemAverages(rs).pei }))
      .sort((a, b) => b.count - a.count)
  }
  const byDoctor = grouped((r) => [r.doctor || "미선택"])
  const byTreatment = grouped((r) => (Array.isArray(r.treatments) ? (r.treatments as string[]) : [])) // 중복 선택
  const byVisit = grouped((r) => (r.visitType ? [r.visitType] : []))
  const byGender = grouped((r) => (r.gender ? [r.gender] : []))
  const byAge = grouped((r) => (r.ageGroup ? [r.ageGroup] : []))

  const from = new Date(Date.UTC(year, month - 12, 1))
  const trendRows = await prisma.peiResponse.findMany({
    where: { clinicId, submittedAt: { gte: from } },
    select: { year: true, month: true, recommend: true, ...Object.fromEntries(SCORE_KEYS.map((k) => [k, true])) },
  })
  const groups = new Map<string, any[]>()
  for (const r of trendRows as any[]) {
    const k = `${r.year}-${String(r.month).padStart(2, "0")}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(r)
  }
  const trend = [...groups.entries()]
    .filter(([k]) => k <= `${year}-${String(month).padStart(2, "0")}`)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, rs]) => ({ ym: k, count: rs.length, pei: itemAverages(rs).pei }))
  const prevYm = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`
  const prevPei = trend.find((t) => t.ym === prevYm)?.pei ?? null

  return {
    year, month, count: rows.length, pei, items,
    prevPei, byDoctor, byTreatment, byVisit, byGender, byAge,
    trend,
    responses: rows.map((r) => ({
      id: r.id, submittedAt: r.submittedAt.toISOString(), visitType: r.visitType, gender: r.gender, ageGroup: r.ageGroup, doctor: r.doctor,
      treatments: Array.isArray(r.treatments) ? (r.treatments as string[]) : [],
      scores: Object.fromEntries(SCORE_KEYS.map((k) => [k, (r as any)[k] as number | null])),
      recommend: r.recommend, positive: r.positive, improvement: r.improvement,
      answers: (r.answers && typeof r.answers === "object" ? r.answers : {}) as Record<string, unknown>,
    })),
  }
}

export type SurveyStats = Awaited<ReturnType<typeof surveyStats>>

/** 응답이 있는 달 목록(최근 달이 앞) — 응답 시트의 월 탭 */
export async function responseMonths(clinicId: string) {
  const g = await prisma.peiResponse.groupBy({ by: ["year", "month"], where: { clinicId }, _count: { _all: true } })
  return g
    .map((r) => ({ year: r.year, month: r.month, count: r._count._all }))
    .sort((a, b) => b.year - a.year || b.month - a.month)
}
