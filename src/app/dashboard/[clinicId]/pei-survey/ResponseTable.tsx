"use client"

import { BUILTIN, answerText, isBuiltin, splitDoctorName } from "@/lib/pei-survey/questions"
import type { SurveyDTO, SurveyStats } from "@/lib/pei-survey/service"

// 응답 표 — 구글시트처럼 한 줄 = 응답 1건, 열 = 설문 문항 순서. 주관식은 환자가 쓴 그대로
type Row = SurveyStats["responses"][number]
type Col = { id: string; head: string; title: string; value: (r: Row) => string; wide?: boolean; center?: boolean; tone?: (v: string) => string }

const th = "px-3 py-2.5 text-left text-[12px] font-semibold text-[#4e5968] whitespace-nowrap border-b border-[#e5e8eb]"
const td = "px-3 py-2.5 border-b border-[#f2f4f6] text-[#333d4b]"
const BUILTIN_LABEL = (id: string) => BUILTIN[id]?.label ?? id
const fmtKst = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000)
  const p2 = (n: number) => String(n).padStart(2, "0")
  return `${p2(d.getUTCMonth() + 1)}.${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`
}
const scoreTone = (v: string) => (v === "1" || v === "2" ? "text-[#f04452] font-semibold" : v === "3" ? "text-[#e17000]" : "text-[#333d4b]")

export const SCORE_LEGEND = "점수 5 매우 그렇다 · 4 그렇다 · 3 보통 · 2 그렇지 않다 · 1 전혀 · X 경험 없음 · 최근 응답이 위"

export default function ResponseTable({ questions, responses, maxHeight = "70vh" }: { questions: SurveyDTO["questions"]; responses: Row[]; maxHeight?: string }) {
  const cols: Col[] = questions.map((q): Col => {
    const head = isBuiltin(q.id) ? BUILTIN_LABEL(q.id) : q.text.length > 14 ? `${q.text.slice(0, 14)}…` : q.text
    const base = { id: q.id, head, title: q.text }
    switch (q.id) {
      case "visit": return { ...base, value: (r) => r.visitType ?? "" }
      case "gender": return { ...base, value: (r) => r.gender ?? "" }
      case "age": return { ...base, value: (r) => r.ageGroup ?? "" }
      case "treatment": return { ...base, value: (r) => r.treatments.join(", ") }
      case "doctor": return { ...base, value: (r) => (r.doctor ? splitDoctorName(r.doctor).title : "") }
      case "recommend": return { ...base, center: true, value: (r) => (r.recommend == null ? "" : String(r.recommend)), tone: (v) => (v !== "" && Number(v) <= 6 ? "text-[#f04452] font-semibold" : "font-semibold text-[#191f28]") }
      case "positive": return { ...base, wide: true, value: (r) => r.positive ?? "" }
      case "improvement": return { ...base, wide: true, value: (r) => r.improvement ?? "", tone: () => "text-[#333d4b]" }
    }
    if (isBuiltin(q.id)) return { ...base, center: true, value: (r) => { const v = r.scores[q.id]; return v == null ? "" : v === 0 ? "X" : String(v) }, tone: scoreTone }
    return { ...base, wide: q.type === "long", center: q.type === "scale5" || q.type === "scale10", value: (r) => answerText(q, r.answers[q.id]) }
  })

  return (
    <div className="overflow-auto rounded-xl border border-[#e5e8eb]" style={{ maxHeight }}>
      <table className="min-w-max w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-[1] bg-[#f9fafb]">
          <tr>
            <th className={`${th} sticky left-0 z-[2] bg-[#f9fafb] w-10`}>#</th>
            <th className={th}>제출</th>
            {cols.map((c) => (
              <th key={c.id} className={`${th} ${c.wide ? "min-w-[260px]" : ""}`} title={c.title}>{c.head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {responses.map((r, i) => (
            <tr key={r.id} className="align-top hover:bg-[#f9fafb]">
              <td className={`${td} sticky left-0 bg-white text-[#b0b8c1] text-center`}>{responses.length - i}</td>
              <td className={`${td} whitespace-nowrap text-[#8b95a1]`}>{fmtKst(r.submittedAt)}</td>
              {cols.map((c) => {
                const v = c.value(r)
                return (
                  <td key={c.id} className={`${td} ${c.wide ? "whitespace-pre-wrap break-words max-w-[360px]" : "whitespace-nowrap"} ${c.center ? "text-center" : ""} ${c.tone?.(v) ?? ""}`}>
                    {v === "" ? <span className="text-[#d1d6db]">-</span> : v}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
