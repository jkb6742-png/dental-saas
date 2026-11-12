"use client"

import { useRef, useState, type MouseEvent } from "react"
import Chip, { dropZone } from "./Chip"
import { addDays, canDrag, chipStyle, colorOf, DRAG_MIME, EVENT_TYPES, fmtDay, pad, RED, type Item } from "./shared"

const START_H = 8
const END_H = 20
const HOUR = 48 // px
const SNAP = 30 // 분

const isTimed = (it: Item) => it.kind === "EVENT" && !!it.time && !!it.startAt && !!it.endAt
const hm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`

type Seg = { it: Item; s: number; e: number; col: number; cols: number }

/** 그날 시간표에 놓을 조각(분 단위) + 겹치면 나란히 */
function layoutDay(items: Item[], day: string): Seg[] {
  const dayStart = new Date(`${day}T00:00:00+09:00`).getTime()
  const segs: Seg[] = []
  for (const it of items) {
    const st = Math.max(new Date(it.startAt!).getTime(), dayStart)
    const en = Math.min(new Date(it.endAt!).getTime(), dayStart + 86400_000)
    if (en < st) continue
    let s = Math.round((st - dayStart) / 60000)
    let e = Math.round((en - dayStart) / 60000)
    s = Math.min(Math.max(s, START_H * 60), END_H * 60 - 20)
    e = Math.max(Math.min(e, END_H * 60), s + 20) // 최소 20분 높이
    segs.push({ it, s, e, col: 0, cols: 1 })
  }
  segs.sort((a, b) => a.s - b.s || b.e - a.e)
  let cluster: Seg[] = []
  let clusterEnd = -1
  let colEnds: number[] = []
  const close = () => {
    for (const c of cluster) c.cols = colEnds.length
    cluster = []
    colEnds = []
  }
  for (const seg of segs) {
    if (seg.s >= clusterEnd) close()
    let idx = colEnds.findIndex((end) => end <= seg.s)
    if (idx < 0) idx = colEnds.push(0) - 1
    colEnds[idx] = seg.e
    seg.col = idx
    cluster.push(seg)
    clusterEnd = Math.max(clusterEnd, seg.e)
  }
  close()
  return segs
}

export default function WeekView({ weekStart, today, selected, items, kinds, me, isMaster, onSelect, onMove, onOpen, onCreate }: {
  weekStart: string
  today: string
  selected: string
  items: Item[]
  kinds: Record<Item["kind"], boolean>
  me: string
  isMaster: boolean
  onSelect: (d: string) => void
  onMove: (key: string, date: string, time?: string) => void
  onOpen: (it: Item) => void
  onCreate: (date: string, startTime: string, endTime: string) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const visible = items.filter((it) => kinds[it.kind])
  const grab = useRef(0) // 끄는 일정의 위쪽 끝과 잡은 지점 사이(분)
  const [over, setOver] = useState<string | null>(null)

  const minuteAt = (e: MouseEvent<HTMLElement>, offset = 0) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const raw = START_H * 60 + ((e.clientY - rect.top) / HOUR) * 60 - offset
    const snapped = Math.round(raw / SNAP) * SNAP
    return Math.min(Math.max(snapped, 0), 23 * 60 + 30)
  }

  return (
    <div className="bg-white rounded border border-[#d1d1cc] overflow-hidden">
      {/* 요일 머리 */}
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-[#d1d1cc] text-[12px]">
        <div />
        {days.map((d, i) => (
          <button
            key={d}
            onClick={() => onSelect(d)}
            className={`px-2 py-1.5 text-left border-l border-[#ecece9] tabular-nums ${selected === d ? "bg-[#eef4ff]" : "hover:bg-[#fafaf8]"} ${d === today ? "font-bold text-[#0062ff]" : "text-[#333]"}`}
            style={d !== today && i === 6 ? { color: RED } : undefined}
          >
            {fmtDay(d)}
            {d === today && <span className="ml-1 font-medium">오늘</span>}
          </button>
        ))}
      </div>

      {/* 종일 칸: 마감·연차·결제·종일 일정 */}
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-[#d1d1cc]">
        <div className="text-[11px] text-[#8a8a84] px-1.5 py-1">종일</div>
        {days.map((d) => {
          const list = visible.filter((it) => !isTimed(it) && it.date <= d && it.endDate >= d)
          const key = `all:${d}`
          const z = dropZone((k) => {
            setOver(null)
            onMove(k, d)
          })
          return (
            <div
              key={d}
              onClick={() => onSelect(d)}
              onDragOver={(e) => {
                z.onDragOver(e)
                if (over !== key) setOver(key)
              }}
              onDragLeave={() => setOver((o) => (o === key ? null : o))}
              onDrop={z.onDrop}
              className={`min-h-[40px] min-w-0 p-1 flex flex-col gap-[2px] border-l border-[#ecece9] ${over === key ? "bg-[#e6efff]" : ""}`}
            >
              {list.map((it) => (
                <Chip key={`${it.kind}${it.id}`} it={it} me={me} isMaster={isMaster} onClick={it.kind === "EVENT" ? onOpen : () => onSelect(d)} />
              ))}
            </div>
          )
        })}
      </div>

      {/* 시간표 08:00~20:00 */}
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] max-h-[640px] overflow-y-auto">
        <div className="relative" style={{ height: (END_H - START_H) * HOUR }}>
          {Array.from({ length: END_H - START_H }, (_, h) => (
            <div key={h} className="absolute right-1.5 text-[11px] text-[#8a8a84] tabular-nums -translate-y-1/2" style={{ top: h * HOUR }}>
              {h === 0 ? "" : `${pad(START_H + h)}:00`}
            </div>
          ))}
        </div>
        {days.map((d) => {
          const segs = layoutDay(visible.filter(isTimed).filter((it) => it.date <= d && it.endDate >= d), d)
          const key = `time:${d}`
          return (
            <div
              key={d}
              className={`relative border-l border-[#ecece9] cursor-cell ${over === key ? "bg-[#f3f7ff]" : d === today ? "bg-[#fbfcff]" : ""}`}
              style={{ height: (END_H - START_H) * HOUR }}
              onClick={(e) => {
                const m = Math.min(Math.max(minuteAt(e, 15), START_H * 60), END_H * 60 - 60)
                onSelect(d)
                onCreate(d, hm(m), hm(m + 60))
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DRAG_MIME)) return
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                if (over !== key) setOver(key)
              }}
              onDragLeave={() => setOver((o) => (o === key ? null : o))}
              onDrop={(e) => {
                const k = e.dataTransfer.getData(DRAG_MIME)
                if (!k) return
                e.preventDefault()
                setOver(null)
                // 업무는 날짜만, 일정은 놓은 시각으로(길이 유지)
                onMove(k, d, k.startsWith("EVENT:") ? hm(minuteAt(e, grab.current)) : undefined)
              }}
            >
              {Array.from({ length: END_H - START_H }, (_, h) => (
                <div key={h} className="absolute inset-x-0 border-t border-[#f0f0ed]" style={{ top: h * HOUR }} />
              ))}
              {segs.map(({ it, s, e, col, cols }) => {
                const draggable = canDrag(it, me, isMaster)
                const st = chipStyle(it)
                return (
                  <div
                    key={it.id}
                    draggable={draggable}
                    onDragStart={(ev) => {
                      const rect = ev.currentTarget.getBoundingClientRect()
                      grab.current = ((ev.clientY - rect.top) / HOUR) * 60
                      ev.dataTransfer.setData(DRAG_MIME, `${it.kind}:${it.id}`)
                      ev.dataTransfer.setData("text/plain", it.title)
                      ev.dataTransfer.effectAllowed = "move"
                    }}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onOpen(it)
                    }}
                    title={`${it.time}~${it.endTime ?? ""} ${it.title}`}
                    className={`absolute rounded px-1 py-0.5 overflow-hidden text-[11px] leading-[15px] ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                    style={{
                      ...st,
                      background: st.background === "#f5f5f3" ? st.background : `${colorOf(it)}1c`,
                      top: ((s - START_H * 60) / 60) * HOUR + 1,
                      height: ((e - s) / 60) * HOUR - 2,
                      left: `calc(${(col / cols) * 100}% + 2px)`,
                      width: `calc(${100 / cols}% - 4px)`,
                    }}
                  >
                    <div className="tabular-nums" style={{ color: colorOf(it) }}>{it.time}{it.endTime ? `~${it.endTime}` : ""}</div>
                    <div className="font-medium truncate">{it.title}</div>
                    {e - s >= 60 && (
                      <div className="truncate text-[#6f6f6a]">{[EVENT_TYPES[it.eventType ?? ""], it.clinicName, it.location].filter(Boolean).join(" · ")}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
