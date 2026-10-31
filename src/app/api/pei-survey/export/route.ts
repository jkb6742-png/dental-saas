import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { getOrCreateSurvey } from "@/lib/pei-survey/service"
import { toGoogleCsv } from "@/lib/pei-survey/questions"

// GET /api/pei-survey/export?clinicId=&month=YYYY-MM(선택)
// 구글시트 응답과 같은 16열 + 받은 진료 1열 CSV. month 없으면 전체 기간. PEI 보고서 스킬 입력으로 그대로 쓴다.
export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const clinicId = sp.get("clinicId") || ""
  if (!clinicId || !canAccessClinic(actor, clinicId)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })

  const ym = sp.get("month")?.match(/^(\d{4})-(\d{2})$/)
  const survey = await getOrCreateSurvey(clinicId)
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } })
  const rows = await prisma.peiResponse.findMany({
    where: { clinicId, ...(ym ? { year: Number(ym[1]), month: Number(ym[2]) } : {}) },
    orderBy: { submittedAt: "asc" },
  })

  const csv = toGoogleCsv(survey.facilityQuestion, rows, survey.questions)
  const name = `${ym ? `${ym[1]}-${ym[2]}` : "전체"}_PEI응답_${clinic?.name ?? "치과"}.csv`
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  })
}
