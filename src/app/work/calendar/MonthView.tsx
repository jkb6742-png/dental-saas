"use client"

import { useState } from "react"
import Chip, { dropZone } from "./Chip"
import { RED, WEEK, type Item } from "./shared"

export default function MonthView({ grid, month, today, selected, byDay, me, isMaster, onSelect, onMove, onOpen }: {
  grid: string[]
  month: string
  today: string
  selected: string
  byDay: Map<string, Item[]>
  me: string
  isMaster: boolean
  onSelect: (d: string) => void
  onMove: (key: string, date: string) => void
  onOpen: (it: Item) => void
}) {
  const [over, setOver] = useState<string | null>(null)
  return (
    <div className="bg-white rounded border border-[#d1d1cc] overflow-hidden">
      <div className="grid grid-cols-7 text-[12px] text-[#6f6f6a] border-b border-[#d1d1cc]">
        {WEEK.map((w, i) => (
          <div key={w} className="px-2 py-1" style={i === 0 ? { color: RED } : undefined}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((d, i) => {
          const inMonth = d.startsWith(month)
          const list = byDay.get(d) ?? []
          const z = dropZone((key) => {
            setOver(null)
            onMove(key, d)
          })
          return (
            <div
              key={d}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(d)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(d)}
              onDragOver={(e) => {
                z.onDragOver(e)
                if (over !== d) setOver(d)
              }}
              onDragLeave={() => setOver((o) => (o === d ? null : o))}
              onDrop={z.onDrop}
              className={`min-h-[104px] min-w-0 flex flex-col gap-[2px] p-1 border-b border-r border-[#ecece9] cursor-pointer ${i % 7 === 6 ? "border-r-0" : ""} ${over === d ? "bg-[#e6efff] outline outline-1 outline-[#0062ff]" : selected === d ? "bg-[#eef4ff]" : "hover:bg-[#fafaf8]"}`}
            >
              <div
                className={`text-[12px] tabular-nums ${d === today ? "font-bold text-[#0062ff]" : !inMonth ? "text-[#c4c4be]" : "text-[#333]"}`}
                style={inMonth && d !== today && i % 7 === 0 ? { color: RED } : undefined}
              >
                {Number(d.slice(8))}
                {d === today && <span className="ml-1 text-[11px] font-medium">오늘</span>}
              </div>
              {list.slice(0, 3).map((it) => (
                <Chip key={`${it.kind}${it.id}`} it={it} me={me} isMaster={isMaster} onClick={it.kind === "EVENT" ? onOpen : () => onSelect(d)} />
              ))}
              {list.length > 3 && <div className="text-[11px] text-[#6f6f6a] px-1">+{list.length - 3}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
