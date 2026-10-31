import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { createReport, processReport } from "@/lib/naver-ads/report"

const serialize = (r: any) => ({
  id: r.id,
  title: r.title,
  periodStart: r.periodStart.toISOString().slice(0, 10),
  periodEnd: r.periodEnd.toISOString().slice(0, 10),
  compareStart: r.compareStart.toISOString().slice(0, 10),
  compareEnd: r.compareEnd.toISOString().slice(0, 10),
  memo: r.memo,
  status: r.status,
  error: r.error,
  model: r.model,
  summary: r.summary,
  createdBy: r.createdBy,
  createdAt: r.createdAt.toISOString(),
})

// GET /api/naver-ads/reports?clinicId= — 보고서 목록(HTML 제외)
export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const clinicId = req.nextUrl.searchParams.get("clinicId") ?? ""
  if (!clinicId || !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 })
  const rows = await prisma.naverAdReport.findMany({
    where: { clinicId, ...(actor.isMaster ? {} : { status: "DONE" }) },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, periodStart: true, periodEnd: true, compareStart: true, compareEnd: true, memo: true, status: true, error: true, model: true, summary: true, createdBy: true, createdAt: true },
  })
  return NextResponse.json({ reports: rows.map(serialize).map((r) => (actor.isMaster ? r : { ...r, memo: null, error: null, model: null, createdBy: null })) })
}

// POST — 마스터: { clinicId, since, until, compareSince?, compareUntil?, memo? }
// 행을 만들고 바로 응답(GENERATING). 생성은 서버에서 이어서 진행하며 목록에서 상태를 확인한다(1~2분)
export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  if (!actor.isMaster) return NextResponse.json({ error: "보고서 생성은 마스터만 할 수 있습니다" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const clinicId = String(body.clinicId ?? "")
  if (!clinicId) return NextResponse.json({ error: "clinicId 가 필요합니다" }, { status: 400 })
  try {
    const { id } = await createReport({
      clinicId,
      since: String(body.since ?? ""),
      until: String(body.until ?? ""),
      compareSince: body.compareSince ? String(body.compareSince) : undefined,
      compareUntil: body.compareUntil ? String(body.compareUntil) : undefined,
      memo: body.memo ? String(body.memo) : undefined,
      createdBy: actor.id,
    })
    processReport(id).catch((e) => console.error("[naver-ads/report]", id, e?.message))
    const r = await prisma.naverAdReport.findUnique({ where: { id } })
    return NextResponse.json({ ok: true, report: r ? serialize(r) : { id } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "보고서 생성 실패" }, { status: 500 })
  }
}
