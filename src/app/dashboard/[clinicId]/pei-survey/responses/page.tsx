export const dynamic = "force-dynamic"

import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft, Download, Table2 } from "lucide-react"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { getOrCreateSurvey, responseMonths, surveyStats } from "@/lib/pei-survey/service"
import { peiGrade } from "@/lib/pei-survey/questions"
import ResponseTable, { SCORE_LEGEND } from "../ResponseTable"

// PEI 응답 시트 — 구글시트의 월별 시트처럼 달마다 탭을 나눠 응답 원문을 본다
export default async function PeiResponsesPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const actor = await getActor()
  if (!actor) redirect("/login")
  const { clinicId } = await params
  if (!canAccessClinic(actor, clinicId)) redirect("/dashboard")
  const sp = await searchParams

  const months = await responseMonths(clinicId)
  const now = new Date(Date.now() + 9 * 3600 * 1000)
  const fallback = months[0] ?? { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
  const year = sp.year ? parseInt(sp.year) : fallback.year
  const month = sp.month ? parseInt(sp.month) : fallback.month
  const [survey, stats] = await Promise.all([getOrCreateSurvey(clinicId), surveyStats(clinicId, year, month)])

  // 고른 달이 응답 없는 달이어도 탭에 보이게
  const tabs = months.some((m) => m.year === year && m.month === month) ? months : [{ year, month, count: 0 }, ...months].sort((a, b) => b.year - a.year || b.month - a.month)
  const ym = `${year}-${String(month).padStart(2, "0")}`
  const base = `/dashboard/${clinicId}/pei-survey`
  const grade = peiGrade(stats.pei)
  const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold rounded-[8px] bg-[#f2f4f6] hover:bg-[#e5e8eb] text-[#191f28] transition"

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link href={`${base}?year=${year}&month=${month}`} className="w-9 h-9 rounded-lg hover:bg-[#f2f4f6] flex items-center justify-center" aria-label="응답 통계로">
            <ChevronLeft className="w-5 h-5 text-[#4e5968]" />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-[#e8f3ff] flex items-center justify-center"><Table2 className="w-5 h-5 text-[#0062ff]" /></div>
          <div>
            <h1 className="text-[20px] font-bold text-[#191f28]">PEI 응답 시트</h1>
            <p className="text-[13px] text-[#8b95a1]">{survey.title} · 한 줄이 응답 1건, 주관식은 환자가 쓴 그대로</p>
          </div>
        </div>
        <div className="flex gap-2">
          <a href={`/api/pei-survey/export?clinicId=${clinicId}&month=${ym}`} className={btn}><Download className="w-4 h-4" />{month}월 CSV</a>
          <a href={`/api/pei-survey/export?clinicId=${clinicId}`} className={btn}><Download className="w-4 h-4" />전체 CSV</a>
        </div>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-[#d1d1cc]">
        {/* 월 탭 — 시트 탭처럼 */}
        <div className="flex gap-1 px-3 pt-3 border-b border-[#d1d1cc] bg-[#f2f2ef] overflow-x-auto">
          {tabs.map((t) => {
            const on = t.year === year && t.month === month
            return (
              <Link
                key={`${t.year}-${t.month}`}
                href={`${base}/responses?year=${t.year}&month=${t.month}`}
                className={`shrink-0 px-3.5 py-2 rounded-t-lg text-[13px] font-semibold border border-b-0 -mb-px transition ${on ? "bg-white border-[#d1d1cc] text-[#191f28]" : "border-transparent text-[#6b7684] hover:text-[#191f28] hover:bg-white/60"}`}
              >
                {t.year !== now.getUTCFullYear() ? `${String(t.year).slice(2)}년 ` : ""}{t.month}월
                <span className={`ml-1.5 text-[12px] ${on ? "text-[#0062ff]" : "text-[#b0b8c1]"}`}>{t.count}</span>
              </Link>
            )
          })}
        </div>

        <div className="p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-bold text-[#191f28]">
              {year}년 {month}월 응답 {stats.count}건
              {stats.pei != null && (
                <span className="ml-2 text-[14px] font-semibold" style={{ color: grade?.color }}>PEI {stats.pei.toFixed(2)}{grade ? ` · ${grade.label}` : ""}</span>
              )}
            </p>
            <p className="text-[12px] text-[#8b95a1]">{SCORE_LEGEND}</p>
          </div>
          {stats.responses.length === 0 ? (
            <p className="text-[14px] text-[#8b95a1] py-10 text-center">이 달 응답이 아직 없습니다</p>
          ) : (
            <ResponseTable questions={survey.questions} responses={stats.responses} maxHeight="calc(100vh - 300px)" />
          )}
        </div>
      </div>
    </div>
  )
}
