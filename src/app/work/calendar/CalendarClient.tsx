"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import DayPanel from "./DayPanel"
import EventForm from "./EventForm"
import MonthView from "./MonthView"
import PeopleView from "./PeopleView"
import WeekView from "./WeekView"
import {
  addDays, btn, canDrag, daysBetween, field, fmtDay, KIND, kstParts, kstToday, mondayOf, pad, RED, spreadByDay, ymd,
  type Clinic, type EditInit, type Item, type Kind, type Person, type View,
} from "./shared"

const VIEWS: { key: View; label: string }[] = [
  { key: "month", label: "월간" },
  { key: "week", label: "주간" },
  { key: "people", label: "사람별" },
]
const ALL_KINDS: Kind[] = ["TASK", "EVENT", "LEAVE", "PAYMENT"]

export default function CalendarClient({ clinics, people, staff, me, isMaster }: {
  clinics: Clinic[]
  people: Person[]
  staff: Person[]
  me: string
  isMaster: boolean
}) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const today = kstToday()
  const v = params.get("view")
  const view: View = v === "week" || v === "people" ? v : "month"

  const [month, setMonth] = useState(today.slice(0, 7)) // YYYY-MM (월간)
  const [selected, setSelected] = useState<string>(today) // 주간·사람별은 이 날이 든 주
  const [clinicId, setClinicId] = useState("")
  // ?kind=EVENT|LEAVE|PAYMENT 로 들어오면 그 종류만 켠다(team=1 도 연차만)
  const [kinds, setKinds] = useState<Record<Kind, boolean>>(() => {
    const k = (params.get("team") === "1" ? "LEAVE" : params.get("kind")) as Kind | null
    const only = k && ALL_KINDS.includes(k) ? k : null
    return { TASK: !only || only === "TASK", EVENT: !only || only === "EVENT", LEAVE: !only || only === "LEAVE", PAYMENT: !only || only === "PAYMENT" }
  })
  const [items, setItems] = useState<Item[]>([])
  const [editing, setEditing] = useState<EditInit | null>(params.get("event") ? { id: params.get("event")!, date: today } : null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const setView = (next: View) => {
    const q = new URLSearchParams(params.toString())
    if (next === "month") q.delete("view")
    else q.set("view", next)
    q.delete("event")
    if (next === "month") setMonth(selected.slice(0, 7))
    router.replace(`${pathname}${q.size ? `?${q}` : ""}`, { scroll: false })
  }

  // 월간: 그 달 1일이 든 주의 일요일부터 6주
  const grid = useMemo(() => {
    const [y, m] = month.split("-").map(Number)
    const first = ymd(y, m, 1)
    const start = addDays(first, -new Date(`${first}T00:00:00Z`).getUTCDay())
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [month])
  const weekStart = mondayOf(selected)
  const range = view === "month" ? { from: grid[0], to: addDays(grid[41], 1) } : { from: weekStart, to: addDays(weekStart, 7) }

  const load = useCallback(async () => {
    const q = new URLSearchParams({ from: range.from, to: range.to })
    if (clinicId) q.set("clinicId", clinicId)
    const r = await fetch(`/api/work/calendar?${q}`)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return setError(j.error ?? "불러오기 실패")
    setItems(j.items)
  }, [range.from, range.to, clinicId])
  useEffect(() => {
    load()
  }, [load])
  // 다시 보기·빠른 추가로 일정이 생기면 새로 읽기, 1분마다 갱신
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && load()
    const onCreated = () => load()
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("work:event-created", onCreated)
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60_000)
    return () => {
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("work:event-created", onCreated)
      clearInterval(t)
    }
  }, [load])

  const byDay = useMemo(() => spreadByDay(items, range.from, addDays(range.to, -1), (it) => kinds[it.kind]), [items, kinds, range.from, range.to])
  const dayItems = useMemo(() => items.filter((it) => kinds[it.kind] && it.date <= selected && it.endDate >= selected), [items, kinds, selected])

  const shift = (n: number) => {
    if (view === "month") {
      const [y, m] = month.split("-").map(Number)
      const d = new Date(Date.UTC(y, m - 1 + n, 1))
      setMonth(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`)
    } else setSelected(addDays(selected, 7 * n))
  }
  const goToday = () => {
    setMonth(today.slice(0, 7))
    setSelected(today)
  }

  /** 끌어 놓기: 업무는 마감일, 일정은 길이 그대로 날짜(주간 시간표면 시각도) 옮김 */
  const move = async (key: string, date: string, time?: string) => {
    const i = key.indexOf(":")
    const kind = key.slice(0, i)
    const id = key.slice(i + 1)
    const it = items.find((x) => x.kind === kind && x.id === id)
    if (!it) return
    if (!canDrag(it, me, isMaster)) return setError(it.kind === "EVENT" ? "만든 사람만 옮길 수 있습니다" : "옮길 수 없는 항목입니다")
    setError("")
    try {
      setBusy(true)
      if (it.kind === "TASK") {
        if (it.date === date) return
        setItems((xs) => xs.map((x) => (x === it ? { ...x, date, endDate: date, overdue: x.status !== "DONE" && date < today } : x)))
        const r = await fetch(`/api/work/tasks/${it.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ dueOn: date }) })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error ?? "마감일을 옮기지 못했습니다")
      } else {
        const r0 = await fetch(`/api/work/calendar/events/${it.id}`)
        const e = await r0.json().catch(() => ({}))
        if (!r0.ok) throw new Error(e.error ?? "일정을 불러오지 못했습니다")
        const oldStart = new Date(e.startAt).getTime()
        const dur = new Date(e.endAt).getTime() - oldStart
        const newStart = time && !e.allDay ? new Date(`${date}T${time}:00+09:00`).getTime() : oldStart + daysBetween(it.date, date) * 86400_000
        if (newStart === oldStart) return
        const s = kstParts(new Date(newStart).toISOString())
        const en = kstParts(new Date(newStart + dur - (e.allDay ? 1 : 0)).toISOString())
        const body = {
          title: e.title, type: e.type, visibility: e.visibility, clinicId: e.clinicId, publicTitle: e.publicTitle,
          location: e.location, internalNotes: e.internalNotes,
          participantIds: (e.participants ?? []).map((p: { userId: string }) => p.userId),
          allDay: e.allDay, date: s.date, endDate: en.date,
          startTime: e.allDay ? null : s.time, endTime: e.allDay ? null : en.time,
        }
        const r = await fetch(`/api/work/calendar/events/${it.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error ?? "일정을 옮기지 못했습니다")
      }
      setSelected(date)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      load()
    }
  }

  const openItem = (it: Item) => {
    setSelected(it.date >= range.from ? it.date : range.from)
    if (it.kind === "EVENT") setEditing({ id: it.id, date: it.date })
  }

  const title = view === "month" ? month.replace("-", ". ") : `${fmtDay(weekStart)} – ${fmtDay(addDays(weekStart, 6))}`
  const unit = view === "month" ? "달" : "주"

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[20px] font-bold mr-2">통합 달력</h1>
        <div className="flex h-8 rounded border border-[#d1d1cc] bg-white overflow-hidden text-[13px]" role="tablist">
          {VIEWS.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={view === x.key}
              onClick={() => setView(x.key)}
              className={`px-3 border-r border-[#d1d1cc] last:border-r-0 ${view === x.key ? "bg-[#0062ff] text-white font-medium" : "text-[#333] hover:bg-[#fafaf8]"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <button className="h-8 w-8 grid place-items-center rounded border border-[#d1d1cc] bg-white" onClick={() => shift(-1)} aria-label={`이전 ${unit}`}>
          <ChevronLeft size={16} />
        </button>
        <span className="text-[15px] font-bold tabular-nums min-w-[90px] text-center">{title}</span>
        <button className="h-8 w-8 grid place-items-center rounded border border-[#d1d1cc] bg-white" onClick={() => shift(1)} aria-label={`다음 ${unit}`}>
          <ChevronRight size={16} />
        </button>
        <button className="h-8 px-2 rounded border border-[#d1d1cc] bg-white text-[13px]" onClick={goToday}>오늘</button>
        <select className={field} value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
          <option value="">담당 치과 전체</option>
          {clinics.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-3 ml-1">
          {ALL_KINDS.filter((k) => k !== "PAYMENT" || isMaster).map((k) => (
            <label key={k} className="flex items-center gap-1 text-[13px] cursor-pointer select-none">
              <input type="checkbox" checked={kinds[k]} onChange={(e) => setKinds({ ...kinds, [k]: e.target.checked })} />
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: KIND[k].color }} />
              {KIND[k].label}
            </label>
          ))}
          <span className="flex items-center gap-1 text-[12px] text-[#6f6f6a]">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: RED }} />지연
          </span>
          <span className="flex items-center gap-1 text-[12px] text-[#6f6f6a]">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ border: `1px dashed ${KIND.LEAVE.color}` }} />승인 대기
          </span>
        </div>
        <button className={`${btn} ml-auto flex items-center gap-1`} onClick={() => setEditing({ date: selected })}>
          <Plus size={15} />일정 추가
        </button>
      </div>
      {(error || busy) && (
        <p className="text-[13px] flex items-center gap-2" style={{ color: error ? RED : "#6f6f6a" }}>
          {error || "옮기는 중…"}
          {error && <button className="text-[#6f6f6a] underline" onClick={() => setError("")}>닫기</button>}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)] gap-3">
        {view === "month" ? (
          <MonthView grid={grid} month={month} today={today} selected={selected} byDay={byDay} me={me} isMaster={isMaster} onSelect={setSelected} onMove={move} onOpen={openItem} />
        ) : view === "week" ? (
          <WeekView
            weekStart={weekStart} today={today} selected={selected} items={items} kinds={kinds} me={me} isMaster={isMaster}
            onSelect={setSelected} onMove={move} onOpen={openItem}
            onCreate={(date, startTime, endTime) => setEditing({ date, startTime, endTime })}
          />
        ) : (
          <PeopleView weekStart={weekStart} today={today} selected={selected} items={items} kinds={kinds} staff={staff} me={me} isMaster={isMaster} onSelect={setSelected} onOpen={openItem} />
        )}
        <DayPanel day={selected} today={today} items={dayItems} onAdd={() => setEditing({ date: selected })} onOpen={openItem} />
      </div>

      {view !== "people" && <p className="text-[12px] text-[#8a8a84]">업무·일정은 끌어서 다른 날로 옮길 수 있습니다.{view === "week" ? " 빈 시간을 누르면 그 시각으로 일정을 추가합니다." : ""}</p>}

      {editing && (
        <EventForm
          key={`${editing.id ?? "new"}${editing.date}${editing.startTime ?? ""}`}
          init={editing}
          clinics={clinics}
          people={people}
          me={me}
          isMaster={isMaster}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
