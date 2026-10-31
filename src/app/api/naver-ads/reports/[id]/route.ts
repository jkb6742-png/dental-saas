import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"

// GET /api/naver-ads/reports/[id]            → JSON(메타 + html)
//     /api/naver-ads/reports/[id]?format=html → 보고서 HTML 그대로 (download=1 이면 파일로)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const { id } = await params
  const r = await prisma.naverAdReport.findUnique({ where: { id } })
  if (!r || !canAccessClinic(actor, r.clinicId)) return NextResponse.json({ error: "보고서를 찾을 수 없습니다" }, { status: 404 })
  if (!actor.isMaster && r.status !== "DONE") return NextResponse.json({ error: "보고서를 찾을 수 없습니다" }, { status: 404 })

  const sp = req.nextUrl.searchParams
  if (sp.get("format") === "html") {
    if (!r.html) return new NextResponse("보고서가 아직 생성되지 않았습니다", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } })
    const headers: Record<string, string> = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" }
    if (sp.get("download") === "1") {
      const name = `${r.periodStart.toISOString().slice(0, 7)}_네이버광고보고서_${r.title.split(" · ")[0]}.html`
      headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(name)}`
    }
    return new NextResponse(r.html, { headers })
  }
  return NextResponse.json({
    id: r.id, clinicId: r.clinicId, title: r.title, status: r.status, error: r.error, model: r.model, memo: r.memo, summary: r.summary,
    periodStart: r.periodStart.toISOString().slice(0, 10), periodEnd: r.periodEnd.toISOString().slice(0, 10),
    compareStart: r.compareStart.toISOString().slice(0, 10), compareEnd: r.compareEnd.toISOString().slice(0, 10),
    createdAt: r.createdAt.toISOString(), hasHtml: !!r.html,
  })
}

// DELETE — 마스터
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor?.isMaster) return NextResponse.json({ error: "마스터만 삭제할 수 있습니다" }, { status: 403 })
  const { id } = await params
  await prisma.naverAdReport.delete({ where: { id } }).catch(() => null)
  return NextResponse.json({ ok: true })
}
