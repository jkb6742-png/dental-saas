"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { StatusDot, addDays, isOpen, type Task } from "./shared"

// 달력: 마감일 기준 월 달력. 업무를 다른 날로 끌어 놓으면 마감 변경. 마감 없는 업무는 위 줄에서 끌어 놓기.

const HEAD = ["월", "화", "수", "목", "금", "토", "일"]
const MAX_CHIPS = 4

export default function CalendarView({ tasks, today, onOpen, onDue }: { tasks: Task[]; today: string; onOpen: (id: string) => void; onDue: (id: string, ymd: string) => void }) {
  const [month, setMonth] = useState(today.slice(0, 7))
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const days = useMemo(() => {
    const first = `${month}-01`
    const w = new Date(`${first}T00:00:00Z`).getUTCDay()
    const start = addDays(first, w === 0 ? -6 : 1 - w)
    const out: string[] = []
    for (let i = 0; i < 42; i++) out.push(addDays(start, i))
    // 마지막 줄이 전부 다음 달이면 뺀다
    return out.slice(35).every((d) => d.slice(0, 7) !== month) ? out.slice(0, 35) : out
  }, [month])

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.dueOn || t.status === "CANCELLED") continue
      const d = t.dueOn.slice(0, 10)
      m.set(d, [...(m.get(d) ?? []), t])
    }
    return m
  }, [tasks])
  const undated = tasks.filter((t) => !t.dueOn && isOpen(t))

  const shift = (n: number) => {
    const [y, m] = month.split("-").map(Number)
    const d = new Date(Date.UTC(y, m - 1 + n, 1))
    setMonth(d.toISOString().slice(0, 7))
  }

  const chip = (t: Task) => (
    <button
      key={t.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", t.id)
        setDrag(t.id)
      }}
      onDragEnd={() => {
        setDrag(null)
        setOver(null)
      }}
      onClick={() => onOpen(t.id)}
      title={`${t.clinic?.name ?? "사내"} · ${t.title}`}
      className={`w-full h-6 px-1.5 flex items-center gap-1 rounded text-left text-[12px] cursor-grab hover:bg-[#ecece9] ${drag === t.id ? "opacity-40" : ""} ${t.status === "DONE" ? "text-[#8a8a84] line-through" : "text-[#0a0a0a]"}`}
    >
      <StatusDot s={t.status} />
      {t.priority === "HIGH" && <span className="text-[#d92d20] font-bold" aria-label="긴급">!</span>}
      <span className="truncate">{t.title}</span>
    </button>
  )

  const [y, m] = month.split("-").map(Number)
  return (
    <div className="bg-white rounded border border-[#d1d1cc]">
      <div className="h-12 px-3 flex items-center gap-2 border-b border-[#ecece9]">
        <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#ecece9]" aria-label="이전 달" onClick={() => shift(-1)}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-[15px] font-semibold tabular-nums w-[96px] text-center">
          {y}년 {m}월
        </h2>
        <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#ecece9]" aria-label="다음 달" onClick={() => shift(1)}>
          <ChevronRight className="w-4 h-4" />
        </button>
        <button className="h-8 px-2.5 rounded border border-[#d1d1cc] text-[13px] hover:bg-[#ecece9]" onClick={() => setMonth(today.slice(0, 7))}>
          이번 달
        </button>
        <span className="ml-auto text-[12px] text-[#8a8a84]">업무를 다른 날로 끌어 놓으면 마감이 바뀝니다</span>
      </div>

      {undated.length > 0 && (
        <div className="px-3 py-2 border-b border-[#ecece9] flex items-center gap-2 overflow-x-auto">
          <span className="shrink-0 text-[12px] text-[#6f6f6a]">마감 없음 {undated.length}건</span>
          <div className="flex gap-1">
            {undated.slice(0, 30).map((t) => (
              <span key={t.id} className="w-[180px] shrink-0 border border-[#ecece9] rounded">
                {chip(t)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-7 text-[12px] text-[#8a8a84] border-b border-[#ecece9]">
        {HEAD.map((h, i) => (
          <div key={h} className={`h-8 px-2 flex items-center ${i >= 5 ? "text-[#b0b0aa]" : ""}`}>
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const list = byDay.get(d) ?? []
          const inMonth = d.slice(0, 7) === month
          const isToday = d === today
          const lateCount = d < today ? list.filter(isOpen).length : 0
          const show = expanded === d ? list : list.slice(0, MAX_CHIPS)
          return (
            <div
              key={d}
              className={`min-h-[112px] p-1 border-b border-[#f2f2ef] ${i % 7 !== 6 ? "border-r" : ""} ${over === d ? "bg-[#eef4ff]" : inMonth ? "" : "bg-[#fafaf8]"}`}
              onDragOver={(e) => {
                if (!drag) return
                e.preventDefault()
                if (over !== d) setOver(d)
              }}
              onDrop={(e) => {
                e.preventDefault()
                const t = drag ? tasks.find((x) => x.id === drag) : undefined
                if (t && t.dueOn?.slice(0, 10) !== d) onDue(t.id, d)
                setDrag(null)
                setOver(null)
              }}
            >
              <div className="h-6 px-1 flex items-center gap-1">
                <span
                  className={`text-[12px] tabular-nums ${isToday ? "w-5 h-5 rounded-full bg-[#0062ff] text-white flex items-center justify-center font-semibold" : inMonth ? "text-[#333]" : "text-[#c4c4be]"}`}
                >
                  {Number(d.slice(8))}
                </span>
                {lateCount > 0 && <span className="text-[11px] text-[#d92d20]">지연 {lateCount}</span>}
              </div>
              <div className="space-y-px">{show.map(chip)}</div>
              {list.length > MAX_CHIPS && (
                <button className="mt-0.5 px-1.5 text-[11px] text-[#6f6f6a] hover:text-[#0062ff]" onClick={() => setExpanded(expanded === d ? null : d)}>
                  {expanded === d ? "접기" : `+${list.length - MAX_CHIPS}건 더`}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
