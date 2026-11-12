"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check as CheckIcon, X } from "lucide-react"
import { field, btn, btnLine, api } from "../../../ui"

// 치과 월 상세의 브라우저 부품: 계약 분량(업무 만들기·조정) · 월 마감 체크리스트 · 소통 입력 · 메모 삭제 · 재무 점검.
// API: /api/work/commitments/*, /api/work/close, /api/work/notes (기존 그대로).

type Quota = { commitmentId: string; kind: string; label: string; target: number; done: number; inProgress: number; adjustmentReason: string | null }
export type Check = { key: string; label: string; ok: boolean; detail: string; href: string; fix: string }
type CloseInfo = {
  opsClosed: boolean
  opsBy: string | null
  opsAt: string | null
  exceptionNote: string | null
  financeAt: string | null
  financeBy: string | null
  reopenNote: string | null
  reopenedAt: string | null
} | null

const NOTE_KIND: Record<string, string> = { CALL: "통화", MEETING: "미팅", REQUEST: "요청", SPECIAL: "특이사항", OTHER: "기타" }

function useRun() {
  const router = useRouter()
  const [err, setErr] = useState("")
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setErr("")
    setMsg("")
    setBusy(true)
    try {
      await fn()
      if (ok) setMsg(ok)
      router.refresh()
      return true
    } catch (e) {
      setErr((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }
  const note = (err || msg) && <p className={`px-4 py-2 text-[13px] ${err ? "text-[#d92d20]" : "text-[#1a7f37]"}`}>{err || msg}</p>
  return { run, busy, note }
}

function Head({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="flex items-baseline gap-2 px-4 py-2.5 border-b border-[#f2f2ef]">
      <h2 className="text-[15px] font-bold">{title}</h2>
      {desc && <span className="text-[12px] text-[#8a8a84]">{desc}</span>}
    </div>
  )
}
const box = "bg-white rounded border border-[#d1d1cc]"

/** 계약 분량: 항목별 막대 + 기준 진도 눈금 */
export function QuotaCard({ quota, isMaster, expected }: { quota: Quota[]; isMaster: boolean; expected: number | null }) {
  const { run, busy, note } = useRun()
  const [adjust, setAdjust] = useState<{ id: string; target: string; reason: string } | null>(null)
  return (
    <section className={box} id="quota">
      <Head title="계약 분량" desc={expected !== null ? `세로선 = 오늘 기준 진도 ${Math.round(expected * 100)}%` : undefined} />
      {note}
      {quota.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-[#6f6f6a]">이 달에 걸친 진행 중 계약이 없습니다. {isMaster ? "‘계약’ 메뉴에서 계약과 월 분량을 넣으세요." : "대표에게 계약 입력을 요청하세요."}</p>
      ) : (
        <table className="w-full text-[14px]">
          <tbody>
            {quota.map((q) => {
              const pct = q.target ? Math.min(100, Math.round((q.done / q.target) * 100)) : 100
              const met = q.done >= q.target
              const behind = expected !== null && q.target > 0 && q.done / q.target + 0.1 <= expected
              return (
                <tr key={q.commitmentId} className="border-b border-[#f2f2ef] last:border-0">
                  <td className="py-2 px-4 w-[120px]">{q.label}</td>
                  <td className="py-2 px-2">
                    <div className="relative h-2 rounded-full bg-[#ecece9] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: met ? "#1a7f37" : behind ? "#d92d20" : "#0062ff" }} />
                      {expected !== null && <div className="absolute top-0 bottom-0 w-px bg-[#0a0a0a]/50" style={{ left: `${Math.round(expected * 100)}%` }} aria-hidden="true" />}
                    </div>
                    {q.adjustmentReason && <div className="text-[12px] text-[#6f6f6a] mt-1">조정: {q.adjustmentReason}</div>}
                  </td>
                  <td className={`py-2 px-2 w-[64px] text-right tabular-nums font-bold ${met ? "text-[#1a7f37]" : ""}`}>
                    {q.done}/{q.target}
                  </td>
                  <td className="py-2 px-2 w-[60px] text-right text-[12px] text-[#6f6f6a]">{q.inProgress ? `진행 ${q.inProgress}` : ""}</td>
                  <td className="py-2 px-4 w-[150px] text-right">
                    <div className="flex gap-1 justify-end">
                      <button disabled={busy} className={`${btnLine} h-7 text-[12px]`} onClick={() => run(() => api(`/api/work/commitments/${q.commitmentId}/tasks`, { method: "POST" }), "업무를 만들었습니다")}>
                        업무 만들기
                      </button>
                      {isMaster && (
                        <button className={`${btnLine} h-7 text-[12px]`} onClick={() => setAdjust({ id: q.commitmentId, target: String(q.target), reason: "" })}>
                          조정
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {adjust && (
        <div className="px-4 py-3 border-t border-[#f2f2ef] flex flex-wrap gap-2 items-center">
          <span className="text-[13px]">이번 달 목표</span>
          <input className={`${field} w-[70px]`} type="number" min={0} value={adjust.target} onChange={(e) => setAdjust({ ...adjust, target: e.target.value })} />
          <input className={`${field} flex-1 min-w-[200px]`} placeholder="조정 사유(필수)" value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} />
          <button
            className={btn}
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api(`/api/work/commitments/${adjust.id}`, { method: "PATCH", json: { targetCount: Number(adjust.target), adjustmentReason: adjust.reason } })
                setAdjust(null)
              }, "목표를 조정했습니다")
            }
          >
            저장
          </button>
          <button className={btnLine} onClick={() => setAdjust(null)}>
            닫기
          </button>
        </div>
      )}
      <p className="px-4 py-2 text-[12px] text-[#8a8a84] border-t border-[#f2f2ef]">블로그·칼럼은 발행 기록(이행 대상월), 정기 미팅은 확정된 지난 일정, 나머지는 연결 업무의 완료 수로 셉니다.</p>
    </section>
  )
}

/** 월 마감: 운영 점검 4항목 → 운영 마감(미충족이면 예외 마감 + 사유) → 재무 점검(대표) · 재오픈(대표, 사유) */
export function CloseChecklist({ clinicId, month, isMaster, checks, info }: { clinicId: string; month: string; isMaster: boolean; checks: Check[]; info: CloseInfo }) {
  const { run, busy, note } = useRun()
  const [reason, setReason] = useState("")
  const [mode, setMode] = useState<"" | "exception" | "reopen">("")
  const failed = checks.filter((c) => !c.ok)
  const post = (json: object, ok: string) => run(() => api("/api/work/close", { method: "POST", json: { clinicId, month, ...json } }), ok)
  const opsClosed = !!info?.opsClosed

  return (
    <section className={box}>
      <Head title="월 마감" desc={opsClosed ? (info?.financeAt ? "최종 마감" : "운영 마감 · 재무 점검 대기") : `운영 점검 ${checks.length - failed.length}/${checks.length}`} />
      <ul className="divide-y divide-[#f2f2ef]">
        {checks.map((c) => (
          <li key={c.key} className="px-4 py-2 flex items-center gap-2.5 text-[14px]">
            {c.ok ? <CheckIcon size={16} className="text-[#1a7f37] shrink-0" aria-label="충족" /> : <X size={16} className="text-[#d92d20] shrink-0" aria-label="미충족" />}
            <span className="flex-1">
              {c.label}
              <span className={`ml-2 text-[12px] ${c.ok ? "text-[#8a8a84]" : "text-[#d92d20]"}`}>{c.detail}</span>
            </span>
            {!c.ok && !opsClosed && (
              <Link prefetch={false} href={c.href} className="text-[12px] text-[#0062ff] hover:underline shrink-0">
                {c.fix}
              </Link>
            )}
          </li>
        ))}
      </ul>
      {note}
      <div className="px-4 py-3 border-t border-[#f2f2ef] space-y-2 text-[14px]">
        {opsClosed ? (
          <>
            <p className="text-[13px] text-[#1a7f37]">
              운영 마감 · {info?.opsBy ?? ""} {info?.opsAt}
            </p>
            {info?.exceptionNote && <p className="text-[13px] text-[#6f6f6a]">예외 사유: {info.exceptionNote}</p>}
            {info?.financeAt ? (
              <p className="text-[13px] text-[#1a7f37]">
                재무 점검 · {info.financeBy ?? ""} {info.financeAt}
              </p>
            ) : (
              <p className="text-[13px] text-[#6f6f6a]">재무 점검(청구 → 입금 확인)은 대표가 정산 탭에서 합니다.</p>
            )}
            {isMaster ? (
              mode === "reopen" ? (
                <div className="space-y-2">
                  <textarea className="w-full h-16 p-2 rounded border border-[#d1d1cc] text-[13px]" placeholder="재오픈 사유(필수) 예: 칼럼 1편 이행월 정정" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="flex gap-2">
                    <button
                      className={btn}
                      disabled={busy || !reason.trim()}
                      onClick={() =>
                        post({ action: "reopen", note: reason.trim() }, "다시 열었습니다").then((ok) => {
                          if (!ok) return
                          setMode("")
                          setReason("")
                        })
                      }
                    >
                      재오픈
                    </button>
                    <button className={btnLine} onClick={() => setMode("")}>
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  {!info?.financeAt && (
                    <button className={btn} disabled={busy} onClick={() => post({ action: "finance" }, "재무 점검을 기록했습니다")}>
                      재무 점검 완료
                    </button>
                  )}
                  <button className={btnLine} onClick={() => setMode("reopen")}>
                    재오픈
                  </button>
                </div>
              )
            ) : (
              <p className="text-[12px] text-[#8a8a84]">마감 후 변경은 대표가 재오픈 사유를 남기고 엽니다.</p>
            )}
          </>
        ) : (
          <>
            {info?.reopenedAt && (
              <p className="text-[12px] text-[#b54708]">
                {info.reopenedAt} 재오픈{info.reopenNote ? ` · ${info.reopenNote}` : ""}
              </p>
            )}
            {failed.length === 0 ? (
              <button className={`${btn} w-full`} disabled={busy} onClick={() => post({ action: "close" }, "운영 마감했습니다")}>
                운영 마감
              </button>
            ) : mode === "exception" ? (
              <div className="space-y-2">
                <p className="text-[12px] text-[#6f6f6a]">미충족 {failed.map((c) => c.label).join(", ")} — 사유와 마감한 사람이 기록되고 다음 달로 이월됩니다.</p>
                <textarea className="w-full h-16 p-2 rounded border border-[#d1d1cc] text-[13px]" placeholder="예외 사유(필수) 예: 원장 사진 지연으로 칼럼 1편 12월 초 발행" value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2">
                  <button
                    className={btn}
                    disabled={busy || !reason.trim()}
                    onClick={() =>
                      post({ action: "close", exceptionNote: `[예외] ${failed.map((c) => c.label).join(", ")} · ${reason.trim()}` }, "예외 마감했습니다").then((ok) => {
                        if (!ok) return
                        setMode("")
                        setReason("")
                      })
                    }
                  >
                    예외 마감
                  </button>
                  <button className={btnLine} onClick={() => setMode("")}>
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button className={`${btn} flex-1`} disabled title="체크리스트를 모두 채우면 눌립니다">
                  운영 마감
                </button>
                <button className={btnLine} onClick={() => setMode("exception")}>
                  예외 마감
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

/** 소통 입력(통화·미팅·요청·특이사항·기타) */
export function NoteForm({ clinicId, month }: { clinicId: string; month: string }) {
  const { run, busy, note } = useRun()
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const defDay = today.startsWith(month) ? today : `${month}-01`
  const [f, setF] = useState({ kind: "CALL", day: defDay, title: "", body: "" })
  return (
    <section className={box}>
      <Head title="소통 남기기" desc="직원만 봅니다 · 환자 이름·연락처는 적지 마세요" />
      <div className="px-4 py-3 flex flex-wrap gap-2">
        <select aria-label="유형" className={field} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          {Object.entries(NOTE_KIND).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input aria-label="날짜" type="date" className={field} value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} />
        <input className={`${field} w-[200px]`} placeholder="제목(선택)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <textarea className="flex-1 min-w-[260px] h-8 min-h-8 px-2 py-1 rounded border border-[#d1d1cc] text-[14px]" placeholder="내용" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <button
          className={btn}
          disabled={busy || !f.body.trim()}
          onClick={() =>
            run(async () => {
              // 날짜만 고르면 그 날 한국 시각 정오로 기록
              await api("/api/work/notes", { method: "POST", json: { clinicId, kind: f.kind, title: f.title, body: f.body, occurredAt: `${f.day}T12:00:00+09:00` } })
              setF({ ...f, title: "", body: "" })
            }, "남겼습니다")
          }
        >
          남기기
        </button>
      </div>
      {note}
    </section>
  )
}

export function DeleteNote({ id }: { id: string }) {
  const { run, busy } = useRun()
  return (
    <button
      className="underline text-[#8a8a84] hover:text-[#d92d20]"
      disabled={busy}
      onClick={() => {
        if (confirm("이 기록을 지울까요?")) run(() => api(`/api/work/notes/${id}`, { method: "DELETE" }))
      }}
    >
      삭제
    </button>
  )
}

/** 정산 탭의 재무 점검(대표) */
export function FinanceReview({ clinicId, month, opsClosed, financeAt, financeBy, billStates, allPaid }: { clinicId: string; month: string; opsClosed: boolean; financeAt: string | null; financeBy: string | null; billStates: string[]; allPaid: boolean }) {
  const { run, busy, note } = useRun()
  const steps = [
    { label: "운영 마감", ok: opsClosed },
    { label: "청구", ok: billStates.length > 0 && !billStates.includes("청구 전") },
    { label: "입금 확인", ok: allPaid },
    { label: "최종 마감(재무 점검)", ok: !!financeAt },
  ]
  return (
    <section className={box}>
      <Head title="재무 점검" desc="대표만 보입니다" />
      <ul className="divide-y divide-[#f2f2ef]">
        {steps.map((s) => (
          <li key={s.label} className="px-4 py-2 flex items-center gap-2.5 text-[14px]">
            {s.ok ? <CheckIcon size={16} className="text-[#1a7f37]" aria-label="완료" /> : <X size={16} className="text-[#8a8a84]" aria-label="미완" />}
            {s.label}
          </li>
        ))}
      </ul>
      {note}
      <div className="px-4 py-3 border-t border-[#f2f2ef] text-[13px]">
        {financeAt ? (
          <p className="text-[#1a7f37]">
            최종 마감 · {financeBy ?? ""} {financeAt}
          </p>
        ) : opsClosed ? (
          <button className={`${btn} w-full`} disabled={busy} onClick={() => run(() => api("/api/work/close", { method: "POST", json: { clinicId, month, action: "finance" } }), "재무 점검을 기록했습니다")}>
            재무 점검 완료{allPaid ? "" : " (미입금 있음)"}
          </button>
        ) : (
          <p className="text-[#6f6f6a]">운영 마감 후 재무 점검을 할 수 있습니다.</p>
        )}
      </div>
    </section>
  )
}
