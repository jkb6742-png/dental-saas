import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { getOrCreateSurvey, newToken, surveyStats, toDTO } from "@/lib/pei-survey/service"
import { QTYPE_LABEL, cleanSlug, normalizeDoctors, normalizeQuestions } from "@/lib/pei-survey/questions"

// 의료진 사진은 기본 사진(public/pei-doctors) 이나 업로드한 사진(/api/public/pei-photo/<clinicId>/...) 만 허용
const photoOk = (url: string, clinicId: string) =>
  /^\/pei-doctors\/[^/?#]+\/[\w.-]+$/.test(url) || url.startsWith(`/api/public/pei-photo/${clinicId}/`)

// GET /api/pei-survey?clinicId=&year=&month=  — 설문 설정 + 월 응답 통계 (없으면 기본값으로 생성)
export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const clinicId = sp.get("clinicId") || ""
  if (!clinicId || !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })

  const now = new Date(Date.now() + 9 * 3600 * 1000)
  const year = parseInt(sp.get("year") || "") || now.getUTCFullYear()
  const month = parseInt(sp.get("month") || "") || now.getUTCMonth() + 1

  const survey = await getOrCreateSurvey(clinicId)
  const stats = await surveyStats(clinicId, year, month)
  return NextResponse.json({ survey, stats })
}

// PUT /api/pei-survey  { clinicId, slug?, title?, slogan?, logo?, intro?, doctors?, treatments?, facilityQuestion?, isActive?, regenerateToken? } — 마스터 전용
export async function PUT(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  if (!actor.isMaster) return NextResponse.json({ error: "마스터만 수정할 수 있습니다" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const clinicId = String(body.clinicId || "")
  if (!clinicId) return NextResponse.json({ error: "clinicId 가 필요합니다" }, { status: 400 })
  const survey = await getOrCreateSurvey(clinicId)

  const data: Record<string, any> = {}
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 100)
  if (body.logo === null || typeof body.logo === "string") {
    data.logo = body.logo && (body.logo.startsWith(`/api/public/pei-photo/${clinicId}/`) || /^\/pei-logos\/[\w-]+\.(png|jpe?g|webp|svg)$/.test(body.logo)) ? body.logo : null
  }
  if (typeof body.slogan === "string") data.slogan = body.slogan.trim().slice(0, 100) || null
  if (typeof body.intro === "string") data.intro = body.intro.trim().slice(0, 1000) || null
  if (typeof body.facilityQuestion === "string" && body.facilityQuestion.trim()) data.facilityQuestion = body.facilityQuestion.trim().slice(0, 200)
  if (typeof body.isActive === "boolean") data.isActive = body.isActive
  if (Array.isArray(body.doctors)) {
    const seen = new Set<string>()
    data.doctors = normalizeDoctors(body.doctors)
      .map((d) => ({ name: d.name.trim().slice(0, 100), photo: d.photo && photoOk(d.photo, clinicId) ? d.photo : null }))
      .filter((d) => !seen.has(d.name) && seen.add(d.name))
      .slice(0, 20)
  }
  if (Array.isArray(body.treatments)) {
    data.treatments = [...new Set(body.treatments.map((t: unknown) => String(t ?? "").trim().slice(0, 40)).filter(Boolean))].slice(0, 30)
  }
  if (Array.isArray(body.questions)) {
    const qs = normalizeQuestions(body.questions, survey.facilityQuestion, survey.treatments)
    if (!qs.length) return NextResponse.json({ error: "문항이 하나도 없습니다" }, { status: 400 })
    const noOpt = qs.find((q) => (q.type === "single" || q.type === "multi") && !q.options?.length)
    if (noOpt) return NextResponse.json({ error: `'${noOpt.text}' 문항에 선택지가 없습니다 (${QTYPE_LABEL[noOpt.type]})` }, { status: 400 })
    data.questions = qs
    // 예전 열도 같이 맞춰 둔다 — 받은 진료 통계·CSV 시설 문항 머리글이 이 값을 쓴다
    data.treatments = qs.find((q) => q.id === "treatment")?.options ?? []
    const fac = qs.find((q) => q.id === "qFacility")
    if (fac) data.facilityQuestion = fac.text.slice(0, 200)
  }
  if (typeof body.slug === "string" && body.slug.trim() !== (survey.slug ?? "")) {
    const slug = cleanSlug(body.slug)
    if (!slug) return NextResponse.json({ error: "주소는 한글·영문·숫자 2~30자로 정해 주세요 (공백·특수문자 제외)" }, { status: 400 })
    const taken = await prisma.peiSurvey.findUnique({ where: { slug }, select: { id: true } })
    if (taken && taken.id !== survey.id) return NextResponse.json({ error: `'${slug}' 주소는 다른 치과가 쓰고 있습니다` }, { status: 409 })
    data.slug = slug
  }
  if (body.regenerateToken === true) {
    // 링크가 외부로 잘못 퍼졌을 때만 쓴다 — 이전 링크는 즉시 무효
    data.token = newToken()
  }

  const updated = await prisma.peiSurvey.update({ where: { id: survey.id }, data })
  return NextResponse.json({ survey: toDTO(updated) })
}
