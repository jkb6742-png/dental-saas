import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { getSurveyByToken } from "@/lib/pei-survey/service"
import { isBuiltin, questionLabel } from "@/lib/pei-survey/questions"

// 기본 문항 id → PeiResponse 열 (나머지는 id 와 열 이름이 같다)
const COLUMN: Record<string, string> = { visit: "visitType", age: "ageGroup", treatment: "treatments" }

// POST /api/public/pei/<token> — 환자 설문 제출 (로그인 없음)
// 원내 태블릿·와이파이처럼 같은 IP 에서 여러 명이 낼 수 있어 IP 제한은 넉넉하게 둔다.
const MAX_PER_IP_PER_HOUR = 30
const MAX_TEXT = 2000

function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "").trim()
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const survey = await getSurveyByToken(token)
  if (!survey || !survey.isActive) {
    return NextResponse.json({ error: "현재 진행 중인 설문이 아닙니다." }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  if (body.website) return NextResponse.json({ success: true }) // 봇용 숨은 칸에 값이 있으면 저장하지 않음

  // 문항 구성대로 검사한다. 기본 문항은 정해진 열로, 직접 더한 문항은 answers 로 간다.
  // 주관식은 환자가 쓴 그대로 저장한다 (앞뒤 공백만 정리)
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, MAX_TEXT) : null)
  const a: Record<string, unknown> = body.answers && typeof body.answers === "object" ? body.answers : {}
  const errors: string[] = []
  const cols: Record<string, unknown> = {}
  const answers: Record<string, unknown> = {}
  for (const q of survey.questions) {
    if (q.type === "doctor" && !survey.doctors.length) continue // 의료진이 없으면 화면에도 안 나옴
    const raw = a[q.id]
    let v: unknown = null
    switch (q.type) {
      case "single":
        v = typeof raw === "string" && q.options?.includes(raw) ? raw : null
        break
      case "multi": {
        const picked = Array.isArray(raw) ? raw.map(String) : []
        const list = (q.options ?? []).filter((o) => picked.includes(o)) // 선택지 순서로 저장
        v = list.length ? list : null
        break
      }
      case "doctor":
        v = typeof raw === "string" && survey.doctors.some((d) => d.name === raw) ? raw : null
        break
      case "scale5":
        v = Number.isInteger(raw) && (raw as number) >= (q.allowNA ? 0 : 1) && (raw as number) <= 5 ? raw : null
        break
      case "scale10":
        v = Number.isInteger(raw) && (raw as number) >= 1 && (raw as number) <= 10 ? raw : null
        break
      default:
        v = q.type === "short" ? text(raw)?.slice(0, 300) ?? null : text(raw)
    }
    if (v == null) {
      if (q.required) errors.push(questionLabel(q))
      continue
    }
    if (!isBuiltin(q.id)) answers[q.id] = v
    else cols[COLUMN[q.id] ?? q.id] = v
  }
  if (errors.length) {
    return NextResponse.json({ error: `응답하지 않은 문항이 있습니다: ${errors.join(", ")}` }, { status: 400 })
  }

  const ip = clientIp(req)
  const ipHash = ip ? crypto.createHash("sha256").update(`${ip}:${process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "pei"}`).digest("hex").slice(0, 32) : null
  if (ipHash) {
    const recent = await prisma.peiResponse.count({
      where: { ipHash, submittedAt: { gte: new Date(Date.now() - 3600 * 1000) } },
    })
    if (recent >= MAX_PER_IP_PER_HOUR) {
      return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 })
    }
  }

  const kst = new Date(Date.now() + 9 * 3600 * 1000)
  await prisma.peiResponse.create({
    data: {
      surveyId: survey.id, clinicId: survey.clinicId,
      year: kst.getUTCFullYear(), month: kst.getUTCMonth() + 1,
      ...cols, ...(Object.keys(answers).length ? { answers: answers as any } : {}), ipHash,
    },
  })
  return NextResponse.json({ success: true })
}
