"use client"

import Link from "next/link"
import { Fragment, useCallback, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { field, btn, btnLine, card, api, Empty, Th, Td } from "../ui"
import { C, Kpi, MonthNav, PeopleBars, DayCalendar, RecordEditor, hm, hours, hhmm, md, kstMonth, levelColor, useAutoRefresh, type Day, type Limits, type Overtime } from "./parts"

type Row = {
  userId: string
  name: string
  workMode: "OFFICE" | "REMOTE"
  workStart: string
  workEnd: string
  left: boolean
  workedMin: number
  extraMin: number
  late: number
  early: number
  missing: number
  workdays: number
  leaveDays: number
  leaveBalance: number
  weekMin: number
  weekLevel: "OK" | "WARN" | "OVER"
  todayStatus: Day["status"] | null
  days: Day[]
}
type Data = {
  month: string
  today: string
  limits: Limits
  week: { start: string; end: string }
  snapshot: { in: number; leave: number; missing: number; risk: number }
  rows: Row[]
  pendingLeave: { id: string; name: string; startOn: string; endOn: string; unit: "FULL" | "HALF_AM" | "HALF_PM"; requestedDays: number }[]
  pendingOvertime: Overtime[]
  remoteMissed: { userId: string; name: string; count: number; dates: string[] }[]
}
const UNIT = { FULL: "연차", HALF_AM: "오전 반차", HALF_PM: "오후 반차" }

function TdC({ color, children }: { color?: string; children?: React.ReactNode }) {
  return (
    <Td>
      <span style={color ? { color } : undefined}>{children}</span>
    </Td>
  )
}

function rowState(r: Row, l: Limits) {
  if (r.left) return { label: "퇴사", color: C.gray2 }
  if (r.weekMin >= l.limit) return { label: "52시간 초과", color: C.red }
  if (r.weekMin >= l.warn) return { label: "48시간 주의", color: C.amber }
  if (r.missing) return { label: `미기록 ${r.missing}일`, color: C.red }
  return { label: "정상", color: C.gray }
}

export default function TeamAttendance() {
  const [month, setMonth] = useState(kstMonth())
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const [picked, setPicked] = useState<Day | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(`/api/work/attendance?summary=team&month=${month}`))
      setErr("")
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [month])
  useAutoRefresh(load, 45_000)

  const s = data?.snapshot
  const L = data?.limits
  const toggle = (id: string) => {
    setOpen(open === id ? null : id)
    setPicked(null)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label="오늘 출근" value={s ? `${s.in}명` : "-"} sub={data ? `${md(data.today)} 기준` : undefined} />
        <Kpi label="휴가·출장" value={s ? `${s.leave}명` : "-"} />
        <Kpi label="미기록" value={s ? `${s.missing}명` : "-"} sub="오늘 근무일인데 출근 기록 없음" color={s?.missing ? C.red : undefined} />
        <Kpi label="52시간 위험" value={s ? `${s.risk}명` : "-"} sub="이번 주 48시간 이상" color={s?.risk ? C.amber : undefined} />
      </div>

      <div className="flex items-center gap-3">
        <h2 className="text-[15px] font-medium">직원별 월간 근태</h2>
        <MonthNav month={month} onChange={(m) => (setMonth(m), setPicked(null))} />
      </div>
      {err && <p className="text-[13px] text-[#d92d20]">{err}</p>}

      <div className="grid gap-3 lg:grid-cols-[7fr_3fr]">
        <div className={`${card} min-w-0 overflow-x-auto`}>
          {!data ? (
            <Empty>불러오는 중…</Empty>
          ) : !data.rows.length ? (
            <Empty>등록된 직원이 없습니다.</Empty>
          ) : (
            <table className="w-full text-[14px] tabular-nums">
              <thead>
                <tr>
                  <Th className="w-[120px]">직원</Th>
                  <Th className="w-[60px]">근무일</Th>
                  <Th className="w-[90px]">실근무</Th>
                  <Th className="w-[80px]">연장</Th>
                  <Th className="w-[50px]">지각</Th>
                  <Th className="w-[60px]">미기록</Th>
                  <Th className="w-[70px]">연차 잔여</Th>
                  <Th className="w-[80px]">이번 주</Th>
                  <Th>상태</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const st = rowState(r, data.limits)
                  const isOpen = open === r.userId
                  return (
                    <Fragment key={r.userId}>
                      <tr className="cursor-pointer hover:bg-[#fafaf8]" onClick={() => toggle(r.userId)}>
                        <Td>
                          <span className="inline-flex items-center gap-1">
                            {isOpen ? <ChevronDown size={14} className="text-[#6f6f6a]" /> : <ChevronRight size={14} className="text-[#6f6f6a]" />}
                            {r.name}
                            {r.workMode === "REMOTE" && <span className="text-[12px] text-[#8a8a84]">재택</span>}
                          </span>
                        </Td>
                        <Td>{r.workdays}일</Td>
                        <Td>{hhmm(r.workedMin) || "0:00"}</Td>
                        <Td className="text-[#6f6f6a]">{hhmm(r.extraMin)}</Td>
                        <TdC color={r.late ? C.red : undefined}>{r.late || ""}</TdC>
                        <TdC color={r.missing ? C.red : undefined}>{r.missing || ""}</TdC>
                        <Td>{r.leaveBalance}일</Td>
                        <TdC color={levelColor(r.weekMin, data.limits)}>{hhmm(r.weekMin) || "0:00"}</TdC>
                        <TdC color={st.color}>{st.label}</TdC>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={9} className="border-b border-[#d1d1cc] bg-white p-3">
                            <div className="mb-2 flex items-center gap-2 text-[13px] text-[#6f6f6a]">
                              <b className="text-[#191f28]">{r.name}</b> {month.replace("-", ".")} · 근무 {r.workStart}~{r.workEnd} · 날짜를 누르면 기록을 고칠 수 있습니다.
                            </div>
                            <DayCalendar days={r.days} picked={picked?.date} onPick={setPicked} />
                            {picked && (
                              <RecordEditor
                                userId={r.userId}
                                day={picked}
                                onDone={async () => {
                                  setPicked(null)
                                  await load()
                                }}
                              />
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-3">
          <div className={card}>
            <div className="flex items-center border-b border-[#ecece9] px-4 py-2 text-[14px] font-medium">
              연차 승인 대기 <span className="ml-1 tabular-nums text-[#b54708]">{data?.pendingLeave.length || ""}</span>
              <Link href="/work/leave" className="ml-auto text-[13px] font-normal text-[#0062ff]">
                연차 화면
              </Link>
            </div>
            {!data?.pendingLeave.length ? (
              <Empty>대기 중인 신청이 없습니다.</Empty>
            ) : (
              <ul className="text-[13px]">
                {data.pendingLeave.slice(0, 6).map((l) => (
                  <li key={l.id} className="flex gap-2 border-b border-[#ecece9] px-4 py-2 tabular-nums">
                    <span className="w-[56px] truncate">{l.name}</span>
                    <span>
                      {md(l.startOn)}
                      {l.endOn.slice(0, 10) !== l.startOn.slice(0, 10) && `~${md(l.endOn)}`}
                    </span>
                    <span className="ml-auto text-[#6f6f6a]">
                      {UNIT[l.unit]} {l.requestedDays}일
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <OvertimeApprovals rows={data?.pendingOvertime ?? []} onDone={load} employees={data?.rows ?? []} />

          <div className={card}>
            <div className="border-b border-[#ecece9] px-4 py-2 text-[14px] font-medium">재택 미인증 (이번 주)</div>
            {!data?.remoteMissed.length ? (
              <Empty>이번 주 놓친 인증이 없습니다.</Empty>
            ) : (
              <ul className="text-[13px]">
                {data.remoteMissed.map((m) => (
                  <li key={m.userId} className="flex gap-2 border-b border-[#ecece9] px-4 py-2 tabular-nums">
                    <span className="w-[56px] truncate">{m.name}</span>
                    <span className="text-[#6f6f6a]">{m.dates.map(md).join(", ")}</span>
                    <span className="ml-auto text-[#d92d20]">{m.count}회</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/work/presence" className="block px-4 py-2 text-[12px] text-[#0062ff]">
              재택 인증 기록 보기
            </Link>
          </div>
        </div>
      </div>

      <div className={card}>
        <div className="flex items-center border-b border-[#ecece9] px-4 py-2 text-[14px] font-medium">
          이번 주 직원별 근무시간
          {data && <span className="ml-2 text-[12px] font-normal text-[#8a8a84] tabular-nums">{md(data.week.start)}~{md(data.week.end)} · 실근무 + 출퇴근 밖 승인 추가근무</span>}
        </div>
        {data && L && <PeopleBars rows={data.rows.filter((r) => !r.left)} limits={L} />}
      </div>
    </div>
  )
}

function OvertimeApprovals({ rows, onDone, employees }: { rows: Overtime[]; onDone: () => Promise<void>; employees: Row[] }) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [err, setErr] = useState("")
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ userId: "", workDate: new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10), start: "18:00", end: "20:00", reason: "" })
  const decide = async (id: string, action: "approve" | "reject") => {
    setErr("")
    try {
      await api(`/api/work/overtime/${id}`, { method: "PATCH", json: { action, note: notes[id] ?? "" } })
      await onDone()
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const add = async () => {
    setErr("")
    try {
      await api("/api/work/overtime", { method: "POST", json: { ...f, userId: f.userId || employees[0]?.userId } })
      setAdding(false)
      setF({ ...f, reason: "" })
      await onDone()
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  return (
    <div className={card}>
      <div className="flex items-center border-b border-[#ecece9] px-4 py-2 text-[14px] font-medium">
        추가근무 승인 <span className="ml-1 tabular-nums text-[#b54708]">{rows.length || ""}</span>
        <button className="ml-auto text-[13px] font-normal text-[#0062ff]" onClick={() => setAdding(!adding)}>
          {adding ? "닫기" : "직접 등록"}
        </button>
      </div>
      {adding && (
        <div className="space-y-2 border-b border-[#ecece9] px-4 py-3 text-[13px]">
          <select className={`${field} w-full`} value={f.userId || employees[0]?.userId || ""} onChange={(e) => setF({ ...f, userId: e.target.value })}>
            {employees
              .filter((e) => !e.left)
              .map((e) => (
                <option key={e.userId} value={e.userId}>
                  {e.name}
                </option>
              ))}
          </select>
          <input type="date" className={`${field} w-full`} value={f.workDate} onChange={(e) => setF({ ...f, workDate: e.target.value })} />
          <div className="flex items-center gap-1">
            <input type="time" className={`${field} min-w-0 flex-1`} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
            <span>~</span>
            <input type="time" className={`${field} min-w-0 flex-1`} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
          </div>
          <input className={`${field} w-full`} placeholder="사유" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <button className={`${btn} w-full`} disabled={!f.reason.trim()} onClick={add}>
            등록(바로 승인)
          </button>
        </div>
      )}
      {err && <p className="px-4 pt-2 text-[12px] text-[#d92d20]">{err}</p>}
      {!rows.length ? (
        <Empty>승인할 추가근무가 없습니다.</Empty>
      ) : (
        <ul className="max-h-[360px] overflow-y-auto text-[13px]">
          {rows.map((o) => (
            <li key={o.id} className="border-b border-[#ecece9] px-4 py-2">
              <div className="flex gap-2 tabular-nums">
                <b className="font-medium">{o.name}</b>
                <span>{md(o.workDate)}</span>
                <span className="text-[#6f6f6a]">
                  {hm(o.startAt)}~{hm(o.endAt)} · {hours(o.minutes)}
                </span>
              </div>
              <div className="mt-0.5 text-[#6f6f6a]">{o.reason}</div>
              <div className="mt-1.5 flex items-center gap-1">
                <input className={`${field} h-7 min-w-0 flex-1 text-[13px]`} placeholder="메모(반려 시 필수)" value={notes[o.id] ?? ""} onChange={(e) => setNotes({ ...notes, [o.id]: e.target.value })} />
                <button className={`${btn} h-7 px-2 text-[13px]`} onClick={() => decide(o.id, "approve")}>
                  승인
                </button>
                <button className={`${btnLine} h-7 px-2 text-[13px]`} onClick={() => decide(o.id, "reject")}>
                  반려
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
