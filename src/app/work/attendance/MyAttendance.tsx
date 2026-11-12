"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { LogIn, LogOut, CalendarPlus, Clock } from "lucide-react"
import { field, btn, btnLine, card, api, Empty, Th, Td, PresenceNote, type Presence } from "../ui"
import { C, Kpi, MonthNav, WeekColumns, hm, hours, hhmm, md, kstMonth, statusOf, useAutoRefresh, type Day, type Limits, type Overtime } from "./parts"

type Leave = { id: string; startOn: string; endOn: string; unit: "FULL" | "HALF_AM" | "HALF_PM"; requestedDays: number; status: string }
type Data = {
  month: string
  limits: Limits
  employee: { name: string; workStart: string; workEnd: string; workMode: "OFFICE" | "REMOTE" } | null
  days: Day[]
  weeks: { start: string; end: string; totalMin: number; otMin: number; level: string }[]
  kpi: { workedMin: number; extraMin: number; approvedOtMin: number; pendingOtMin: number; late: number; early: number; missing: number; workdays: number; leaveDays: number; leaveBalance: number; leavePending: number }
  overtime: Overtime[]
  leaves: Leave[]
  today: { clockInAt: string | null; clockOutAt: string | null } | null
  presence: Presence
}

const UNIT = { FULL: "연차", HALF_AM: "오전 반차", HALF_PM: "오후 반차" }
const LSTATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "대기", color: C.amber },
  APPROVED: { label: "승인", color: C.green },
  REJECTED: { label: "반려", color: C.red },
  CANCELLED: { label: "취소", color: C.gray2 },
}
const kstYmd = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export default function MyAttendance({ tab, tabHref }: { tab: "clock" | "overtime"; tabHref: (t: "clock" | "overtime") => string }) {
  const [month, setMonth] = useState(kstMonth())
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(`/api/work/attendance?summary=me&month=${month}`))
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [month])
  useAutoRefresh(load, 60_000)

  const act = async (fn: () => Promise<unknown>) => {
    setErr("")
    try {
      await fn()
      await load()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  if (data && !data.employee) return <div className={`${card} p-4 text-[14px] text-[#6f6f6a]`}>직원 정보가 없는 계정입니다. 대표 &gt; 직원 관리에서 등록하면 근태가 보입니다.</div>

  const k = data?.kpi
  const t = data?.today
  const shown = (data?.days ?? []).filter((d) => !d.future || d.leaveUnit)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label="이번 달 근무시간" value={k ? hours(k.workedMin) : "-"} sub={k ? `출근 ${k.workdays}일` : undefined} />
        <Kpi label="연장근무" value={k ? hours(k.extraMin) : "-"} sub={k ? `승인 추가근무 ${hhmm(k.approvedOtMin) || "0:00"}${k.pendingOtMin ? ` · 대기 ${hhmm(k.pendingOtMin)}` : ""}` : undefined} />
        <Kpi label="잔여 연차" value={k ? `${k.leaveBalance}일` : "-"} sub={k?.leavePending ? `승인 대기 ${k.leavePending}일` : k ? `이번 달 사용 ${k.leaveDays}일` : undefined} color={k && k.leaveBalance < 0 ? C.red : undefined} />
        <Kpi label="미기록" value={k ? `${k.missing}일` : "-"} sub={k ? `지각 ${k.late} · 조퇴 ${k.early}` : undefined} color={k?.missing ? C.red : undefined} />
      </div>

      <div className="flex items-center gap-4 border-b border-[#d1d1cc] text-[14px]">
        {(
          [
            ["clock", "출퇴근"],
            ["overtime", "추가근무"],
          ] as const
        ).map(([key, label]) => (
          <Link key={key} href={tabHref(key)} className={`-mb-px border-b-2 px-1 pb-2 ${tab === key ? "border-[#0062ff] font-medium text-[#191f28]" : "border-transparent text-[#6f6f6a]"}`}>
            {label}
          </Link>
        ))}
        <div className="ml-auto pb-1">
          <MonthNav month={month} onChange={setMonth} />
        </div>
      </div>
      {err && <p className="text-[13px] text-[#d92d20]">{err}</p>}

      <div className="grid gap-3 lg:grid-cols-[7fr_3fr]">
        <div className={`${card} min-w-0 overflow-x-auto`}>
          {tab === "clock" ? (
            !data ? (
              <Empty>불러오는 중…</Empty>
            ) : !shown.length ? (
              <Empty>이 달 기록이 없습니다.</Empty>
            ) : (
              <table className="w-full text-[14px] tabular-nums">
                <thead>
                  <tr>
                    <Th className="w-[96px]">날짜</Th>
                    <Th className="w-[70px]">출근</Th>
                    <Th className="w-[70px]">퇴근</Th>
                    <Th className="w-[80px]">실근무</Th>
                    <Th className="w-[70px]">연장</Th>
                    <Th>상태</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...shown].reverse().map((d) => {
                    const s = statusOf(d)
                    return (
                      <tr key={d.date} className={d.workday ? "" : "bg-[#fafaf8]"}>
                        <Td className={d.isToday ? "font-bold text-[#0062ff]" : d.workday ? "" : "text-[#8a8a84]"}>{d.isToday ? "오늘" : md(d.date)}</Td>
                        <Td>{hm(d.in)}</Td>
                        <Td>{hm(d.out)}</Td>
                        <Td>{hhmm(d.workedMin)}</Td>
                        <Td className="text-[#6f6f6a]">{hhmm(d.otMin + d.beyondMin)}</Td>
                        <Td>
                          <span style={{ color: s.color }}>{s.label}</span>
                          {d.source === "MANAGER" && <span className="ml-2 text-[12px] text-[#8a8a84]">대표 수정{d.note ? ` · ${d.note}` : ""}</span>}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          ) : (
            <OvertimeList rows={data?.overtime ?? []} onReload={load} setErr={setErr} />
          )}
        </div>

        <div className="space-y-3">
          <div className={`${card} p-4`}>
            <div className="text-[12px] text-[#6f6f6a]">오늘 {data?.employee ? `· 근무 ${data.employee.workStart}~${data.employee.workEnd}` : ""}</div>
            <div className="mt-1 text-[15px] tabular-nums">
              출근 <b>{hm(t?.clockInAt ?? null) || "-"}</b> · 퇴근 <b>{hm(t?.clockOutAt ?? null) || "-"}</b>
            </div>
            <div className="mt-3 flex gap-2">
              <button className={`${btn} inline-flex flex-1 items-center justify-center gap-1`} disabled={!data || !!t?.clockInAt} onClick={() => act(() => api("/api/work/attendance", { method: "POST", json: { action: "in" } }))}>
                <LogIn size={15} /> 출근
              </button>
              <button className={`${btnLine} inline-flex flex-1 items-center justify-center gap-1`} disabled={!t?.clockInAt || !!t?.clockOutAt} onClick={() => act(() => api("/api/work/attendance", { method: "POST", json: { action: "out" } }))}>
                <LogOut size={15} /> 퇴근
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-0.5">
              <PresenceNote p={data?.presence ?? null} />
              <span className="text-[12px] text-[#8a8a84]">시각은 서버 시각으로 기록됩니다. 잘못 찍었으면 대표에게 수정을 요청하세요.</span>
            </div>
          </div>

          <Link href="/work/leave" className={`${card} flex items-center gap-2 p-4 text-[14px] hover:bg-[#fafaf8]`}>
            <CalendarPlus size={16} className="text-[#0062ff]" />
            <span>연차·반차 신청</span>
            <span className="ml-auto text-[13px] text-[#6f6f6a] tabular-nums">잔여 {k?.leaveBalance ?? "-"}일</span>
          </Link>

          <OvertimeForm onSaved={load} />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[7fr_3fr]">
        <div className={card}>
          <div className="flex items-center border-b border-[#ecece9] px-4 py-2 text-[14px] font-medium">
            주별 근무시간
            <span className="ml-2 text-[12px] font-normal text-[#8a8a84]">실근무 + 출퇴근 밖 승인 추가근무, 주 40시간 정상 · 48시간 주의 · 52시간 한도</span>
          </div>
          {data && <WeekColumns weeks={data.weeks} limits={data.limits} />}
        </div>
        <div className={card}>
          <div className="border-b border-[#ecece9] px-4 py-2 text-[14px] font-medium">연차 사용 이력 ({month.slice(0, 4)}년)</div>
          {!data?.leaves.length ? (
            <Empty>올해 신청한 연차가 없습니다.</Empty>
          ) : (
            <ul className="max-h-[240px] overflow-y-auto text-[13px]">
              {data.leaves.map((l) => {
                const s = LSTATUS[l.status] ?? LSTATUS.CANCELLED
                return (
                  <li key={l.id} className="flex items-center gap-2 border-b border-[#ecece9] px-4 py-2 tabular-nums">
                    <span>
                      {md(l.startOn)}
                      {l.endOn.slice(0, 10) !== l.startOn.slice(0, 10) && `~${md(l.endOn)}`}
                    </span>
                    <span className="text-[#6f6f6a]">
                      {UNIT[l.unit]} {l.requestedDays}일
                    </span>
                    <span className="ml-auto" style={{ color: s.color }}>
                      {s.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function OvertimeList({ rows, onReload, setErr }: { rows: Overtime[]; onReload: () => Promise<void>; setErr: (s: string) => void }) {
  if (!rows.length) return <Empty>이 달 등록한 추가근무가 없습니다. 오른쪽에서 등록하세요.</Empty>
  const remove = async (id: string) => {
    if (!confirm("이 추가근무 신청을 지울까요?")) return
    setErr("")
    try {
      await api(`/api/work/overtime/${id}`, { method: "DELETE" })
      await onReload()
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  return (
    <table className="w-full text-[14px] tabular-nums">
      <thead>
        <tr>
          <Th className="w-[96px]">날짜</Th>
          <Th className="w-[120px]">시간</Th>
          <Th className="w-[70px]">길이</Th>
          <Th>사유</Th>
          <Th className="w-[120px]">상태</Th>
          <Th className="w-[50px]" />
        </tr>
      </thead>
      <tbody>
        {rows.map((o) => {
          const s = LSTATUS[o.status]
          return (
            <tr key={o.id}>
              <Td>{md(o.workDate)}</Td>
              <Td>
                {hm(o.startAt)}~{hm(o.endAt)}
              </Td>
              <Td>{hhmm(o.minutes)}</Td>
              <Td className="text-[13px]">{o.reason}</Td>
              <Td>
                <span style={{ color: s.color }}>{s.label}</span>
                {o.source === "MANAGER" && <span className="ml-1 text-[12px] text-[#8a8a84]">대표 등록</span>}
                {o.decisionNote && <div className="text-[12px] text-[#6f6f6a]">{o.decisionNote}</div>}
              </Td>
              <Td>
                {o.status === "PENDING" && (
                  <button className="text-[13px] text-[#d92d20]" onClick={() => remove(o.id)}>
                    삭제
                  </button>
                )}
              </Td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function OvertimeForm({ onSaved }: { onSaved: () => void }) {
  const [f, setF] = useState({ workDate: kstYmd(), start: "18:00", end: "20:00", reason: "" })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await api("/api/work/overtime", { method: "POST", json: f })
      setF({ ...f, reason: "" })
      setMsg({ ok: true, text: "등록했습니다. 대표 승인 후 근무시간에 들어갑니다." })
      onSaved()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={`${card} p-4`}>
      <div className="mb-2 flex items-center gap-1 text-[14px] font-medium">
        <Clock size={15} className="text-[#6f6f6a]" /> 추가근무 등록
      </div>
      <div className="space-y-2 text-[13px]">
        <input type="date" className={`${field} w-full`} value={f.workDate} onChange={(e) => setF({ ...f, workDate: e.target.value })} aria-label="날짜" />
        <div className="flex items-center gap-1">
          <input type="time" className={`${field} min-w-0 flex-1`} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} aria-label="시작" />
          <span>~</span>
          <input type="time" className={`${field} min-w-0 flex-1`} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} aria-label="끝" />
        </div>
        <input className={`${field} w-full`} placeholder="사유 (예: 월보고서 마감)" maxLength={300} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        <button className={`${btn} w-full`} disabled={busy || !f.reason.trim()} onClick={save}>
          신청
        </button>
        {msg && <p className="text-[12px]" style={{ color: msg.ok ? C.green : C.red }}>{msg.text}</p>}
        <p className="text-[12px] text-[#8a8a84]">끝이 시작보다 이르면 다음 날 새벽까지로 봅니다. 출퇴근 기록은 바뀌지 않습니다.</p>
      </div>
    </div>
  )
}
