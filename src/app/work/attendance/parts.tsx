"use client"

import { useEffect, useState } from "react"
import { field, btn, btnLine, kst, api } from "../ui"

// 근태 화면 공통 부품: 형식·상태 이름·주별 막대·일자 달력·기록 고침

export type Day = {
  date: string
  wd: number
  workday: boolean
  future: boolean
  isToday: boolean
  in: string | null
  out: string | null
  breakMin: number
  workedMin: number
  otMin: number
  beyondMin: number
  totalMin: number
  status: "NORMAL" | "LATE" | "EARLY" | "LATE_EARLY" | "MISSING" | "LEAVE" | "HALF" | "TRIP" | "ABSENT" | "EXCLUDED" | "WORKING" | "NONE" | "OFF"
  remote: boolean
  leaveUnit: "FULL" | "HALF_AM" | "HALF_PM" | null
  leavePending: boolean
  cls: string | null
  source: string | null
  note: string | null
}
export type Limits = { normal: number; warn: number; limit: number }
export type Overtime = {
  id: string
  employeeUserId: string
  workDate: string
  startAt: string
  endAt: string
  minutes: number
  reason: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  decisionNote: string | null
  source: string
  name?: string
}

export const C = { blue: "#0062ff", red: "#d92d20", amber: "#b54708", green: "#1a7f37", gray: "#6f6f6a", gray2: "#8a8a84", line: "#d1d1cc" }
const WD = ["", "월", "화", "수", "목", "금", "토", "일"]

export const hm = (iso: string | null) => (iso ? kst(iso).slice(11, 16) : "")
/** 152시간 30분 */
export const hours = (m: number) => (m <= 0 ? "0시간" : m % 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m / 60}시간`)
/** 8:30 */
export const hhmm = (m: number) => (m ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}` : "")
/** 11.18(수) */
export const md = (ymd: string) => {
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00Z`)
  const wd = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
  return `${Number(ymd.slice(5, 7))}.${Number(ymd.slice(8, 10))}(${WD[wd]})`
}
export const kstMonth = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7)
export const shift = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7)
}
export const levelColor = (min: number, l: Limits) => (min >= l.limit ? C.red : min >= l.warn ? C.amber : min >= l.normal ? "#191f28" : C.blue)

export function statusOf(d: Day): { label: string; color: string } {
  const remote = d.remote ? " · 재택" : ""
  const half = d.leaveUnit === "HALF_AM" ? "오전 반차" : d.leaveUnit === "HALF_PM" ? "오후 반차" : ""
  switch (d.status) {
    case "NORMAL":
      if (!d.workday) return { label: "휴일 근무" + remote, color: C.blue }
      return d.remote ? { label: "재택", color: C.gray } : { label: "정상", color: C.gray }
    case "HALF":
      return { label: half + remote, color: C.green }
    case "LATE":
      return { label: "지각" + remote, color: C.red }
    case "EARLY":
      return { label: "조퇴" + remote, color: C.amber }
    case "LATE_EARLY":
      return { label: "지각·조퇴" + remote, color: C.red }
    case "MISSING":
      return { label: half ? `미기록(${half})` : "미기록", color: C.red }
    case "LEAVE":
      return { label: "연차", color: C.green }
    case "TRIP":
      return { label: "출장", color: C.gray }
    case "ABSENT":
      return { label: "결근", color: C.red }
    case "EXCLUDED":
      return { label: "제외", color: C.gray2 }
    case "WORKING":
      return { label: "근무 중" + remote, color: C.blue }
    case "OFF":
      return { label: "휴무", color: C.gray2 }
    default:
      return { label: d.leavePending ? "연차 대기" : "", color: d.leavePending ? C.amber : C.gray2 }
  }
}

/** 30~60초마다, 탭이 다시 보이면 바로 다시 읽기 */
export function useAutoRefresh(load: () => void, ms = 60_000) {
  useEffect(() => {
    load()
    const t = setInterval(() => document.visibilityState === "visible" && load(), ms)
    const v = () => document.visibilityState === "visible" && load()
    document.addEventListener("visibilitychange", v)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", v)
    }
  }, [load, ms])
}

export function Kpi({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: React.ReactNode; color?: string }) {
  return (
    <div className="bg-white rounded border border-[#d1d1cc] px-4 py-3">
      <div className="text-[12px] text-[#6f6f6a]">{label}</div>
      <div className="mt-1 text-[22px] font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[12px] text-[#8a8a84] tabular-nums">{sub}</div>}
    </div>
  )
}

export function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button className={`${btnLine} px-2`} onClick={() => onChange(shift(month, -1))} aria-label="이전 달">
        ‹
      </button>
      <span className="w-[86px] text-center text-[14px] font-medium tabular-nums">{month.replace("-", ".")}</span>
      <button className={`${btnLine} px-2`} onClick={() => onChange(shift(month, 1))} aria-label="다음 달">
        ›
      </button>
      {month !== kstMonth() && (
        <button className="ml-1 text-[13px] text-[#0062ff]" onClick={() => onChange(kstMonth())}>
          이번 달
        </button>
      )}
    </div>
  )
}

/** 세로 막대 + 40·48·52시간 기준선 (주별) */
export function WeekColumns({ weeks, limits }: { weeks: { start: string; end: string; totalMin: number }[]; limits: Limits }) {
  if (!weeks.some((w) => w.totalMin > 0)) return <p className="px-4 py-8 text-center text-[13px] text-[#8a8a84]">데이터 모으는 중입니다. 출퇴근을 찍으면 여기에 쌓입니다.</p>
  const max = Math.max(limits.limit + 4 * 60, ...weeks.map((w) => w.totalMin))
  const H = 160
  const y = (m: number) => H - (m / max) * H
  const refs = [
    { m: limits.normal, label: "40", color: "#c4c4be", dash: "" },
    { m: limits.warn, label: "48", color: C.amber, dash: "4 3" },
    { m: limits.limit, label: "52", color: C.red, dash: "4 3" },
  ]
  return (
    <div className="px-4 pt-3 pb-2">
      <div className="relative" style={{ height: H }}>
        {refs.map((r) => (
          <div key={r.label} className="absolute left-0 right-0" style={{ top: y(r.m) }}>
            <div className="border-t" style={{ borderColor: r.color, borderTopStyle: r.dash ? "dashed" : "solid" }} />
            <span className="absolute -top-[9px] right-0 bg-white pl-1 text-[11px] tabular-nums" style={{ color: r.color }}>
              {r.label}h
            </span>
          </div>
        ))}
        <div className="absolute inset-0 right-8 flex items-end justify-around gap-2">
          {weeks.map((w) => (
            <div key={w.start} className="flex h-full w-full max-w-[56px] flex-col items-center justify-end" title={`${md(w.start)}~${md(w.end)} ${hours(w.totalMin)}`}>
              <span className="mb-1 text-[11px] tabular-nums" style={{ color: levelColor(w.totalMin, limits) }}>
                {w.totalMin ? hhmm(w.totalMin) : ""}
              </span>
              <div className="w-full rounded-t-sm" style={{ height: Math.max(w.totalMin ? 2 : 0, (w.totalMin / max) * H), background: w.totalMin >= limits.warn ? levelColor(w.totalMin, limits) : C.blue }} />
            </div>
          ))}
        </div>
      </div>
      <div className="mr-8 mt-1 flex justify-around gap-2 border-t border-[#d1d1cc] pt-1">
        {weeks.map((w) => (
          <span key={w.start} className="w-full max-w-[56px] text-center text-[11px] text-[#6f6f6a] tabular-nums">
            {Number(w.start.slice(5, 7))}.{Number(w.start.slice(8, 10))}~
          </span>
        ))}
      </div>
    </div>
  )
}

/** 가로 막대: 이번 주 직원별 */
export function PeopleBars({ rows, limits }: { rows: { userId: string; name: string; weekMin: number }[]; limits: Limits }) {
  if (!rows.some((r) => r.weekMin > 0)) return <p className="px-4 py-8 text-center text-[13px] text-[#8a8a84]">데이터 모으는 중입니다. 이번 주 출퇴근 기록이 쌓이면 보입니다.</p>
  const max = Math.max(limits.limit + 4 * 60, ...rows.map((r) => r.weekMin))
  const pct = (m: number) => `${(m / max) * 100}%`
  return (
    <div className="px-4 py-3 space-y-2">
      {rows.map((r) => (
        <div key={r.userId} className="flex items-center gap-3 text-[13px]">
          <span className="w-[72px] shrink-0 truncate">{r.name}</span>
          <div className="relative h-4 flex-1">
            <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: pct(r.weekMin), background: r.weekMin >= limits.warn ? levelColor(r.weekMin, limits) : C.blue }} />
            {[limits.normal, limits.warn, limits.limit].map((m, i) => (
              <div key={m} className="absolute -inset-y-1 border-l" style={{ left: pct(m), borderColor: i === 0 ? "#c4c4be" : i === 1 ? C.amber : C.red, borderLeftStyle: i ? "dashed" : "solid" }} />
            ))}
          </div>
          <span className="w-[64px] shrink-0 text-right tabular-nums" style={{ color: levelColor(r.weekMin, limits) }}>
            {hhmm(r.weekMin) || "0:00"}
          </span>
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-1 text-[11px] text-[#8a8a84]">
        <span>회색선 40h</span>
        <span style={{ color: C.amber }}>주황 점선 48h 주의</span>
        <span style={{ color: C.red }}>빨강 점선 52h 한도</span>
      </div>
    </div>
  )
}

/** 한 달 일자 달력(월~일). 날짜를 누르면 onPick */
export function DayCalendar({ days, onPick, picked }: { days: Day[]; onPick?: (d: Day) => void; picked?: string }) {
  if (!days.length) return null
  const lead = days[0].wd - 1
  const cells: (Day | null)[] = [...Array(lead).fill(null), ...days]
  while (cells.length % 7) cells.push(null)
  return (
    <div className="grid grid-cols-7 border-l border-t border-[#ecece9] text-[12px]">
      {["월", "화", "수", "목", "금", "토", "일"].map((w) => (
        <div key={w} className="border-b border-r border-[#ecece9] bg-[#fafaf8] px-2 py-1 text-[#6f6f6a]">
          {w}
        </div>
      ))}
      {cells.map((d, i) => {
        if (!d) return <div key={i} className="border-b border-r border-[#ecece9]" />
        const s = statusOf(d)
        return (
          <button
            key={d.date}
            type="button"
            disabled={!onPick}
            onClick={() => onPick?.(d)}
            className={`min-h-[64px] border-b border-r border-[#ecece9] px-2 py-1 text-left align-top hover:bg-[#fafaf8] ${picked === d.date ? "outline outline-2 -outline-offset-2 outline-[#0062ff]" : ""}`}
          >
            <div className={`tabular-nums ${d.isToday ? "font-bold text-[#0062ff]" : d.workday ? "" : "text-[#8a8a84]"}`}>{Number(d.date.slice(8, 10))}</div>
            {(d.in || d.out) && (
              <div className="tabular-nums text-[#191f28]">
                {hm(d.in) || "--:--"}~{hm(d.out) || "--:--"}
              </div>
            )}
            {s.label && d.status !== "NORMAL" && d.status !== "OFF" && <div style={{ color: s.color }}>{s.label}</div>}
            {d.otMin > 0 && <div className="text-[#6f6f6a]">추가 {hhmm(d.otMin)}</div>}
          </button>
        )
      })}
    </div>
  )
}

const CLASS: Record<string, string> = { WORKED: "근무", PAID_LEAVE: "유급휴가", BUSINESS_TRIP: "출장", ABSENT: "결근", EXCLUDED: "제외(휴직 등)" }

/** 대표가 하루 기록을 넣거나 고친다(POST action:set) */
export function RecordEditor({ userId, day, onDone }: { userId: string; day: Day; onDone: () => void }) {
  const [f, setF] = useState({ clockIn: hm(day.in), clockOut: hm(day.out), breakMinutes: String(day.breakMin || (day.in ? 0 : 60)), class: day.cls ?? "WORKED", note: day.note ?? "" })
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setF({ clockIn: hm(day.in), clockOut: hm(day.out), breakMinutes: String(day.breakMin || (day.in ? 0 : 60)), class: day.cls ?? "WORKED", note: day.note ?? "" })
    setErr("")
  }, [day])
  const save = async () => {
    setBusy(true)
    setErr("")
    try {
      await api("/api/work/attendance", { method: "POST", json: { action: "set", userId, workDate: day.date, ...f, breakMinutes: Number(f.breakMinutes) } })
      onDone()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[#ecece9] px-3 py-3 text-[13px]">
      <b className="mr-1 tabular-nums">{md(day.date)} 기록 고치기</b>
      <input type="time" className={field} value={f.clockIn} onChange={(e) => setF({ ...f, clockIn: e.target.value })} aria-label="출근" />
      <span>~</span>
      <input type="time" className={field} value={f.clockOut} onChange={(e) => setF({ ...f, clockOut: e.target.value })} aria-label="퇴근" />
      <span>휴게</span>
      <input type="number" className={`${field} w-[64px]`} value={f.breakMinutes} onChange={(e) => setF({ ...f, breakMinutes: e.target.value })} />
      <span>분</span>
      <select className={field} value={f.class} onChange={(e) => setF({ ...f, class: e.target.value })}>
        {Object.entries(CLASS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <input className={`${field} w-[200px]`} placeholder="수정 사유" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <button className={btn} disabled={busy} onClick={save}>
        저장
      </button>
      {day.source === "MANAGER" && <span className="text-[12px] text-[#8a8a84]">대표가 고친 기록</span>}
      {err && <span className="text-[12px] text-[#d92d20]">{err}</span>}
    </div>
  )
}
