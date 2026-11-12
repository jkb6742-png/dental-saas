"use client"

import type { DragEvent } from "react"
import { canDrag, chipStyle, DRAG_MIME, isDone, type Item } from "./shared"

/** 달력 칸 안의 한 줄 항목. 옮길 수 있는 업무·일정은 끌어서 다른 날로 옮긴다. */
export default function Chip({ it, me, isMaster, onClick, showTime = true }: {
  it: Item
  me: string
  isMaster: boolean
  onClick?: (it: Item) => void
  showTime?: boolean
}) {
  const draggable = canDrag(it, me, isMaster)
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, `${it.kind}:${it.id}`)
        e.dataTransfer.setData("text/plain", it.title)
        e.dataTransfer.effectAllowed = "move"
      }}
      onClick={(e) => {
        if (!onClick) return
        e.stopPropagation()
        onClick(it)
      }}
      title={`${it.title}${it.clinicName ? ` · ${it.clinicName}` : ""}${it.sub ? ` · ${it.sub}` : ""}`}
      className={`flex items-center gap-1 rounded px-1 text-[11px] leading-[17px] truncate ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${onClick ? "hover:brightness-95" : ""}`}
      style={chipStyle(it)}
    >
      <span className={`truncate ${isDone(it) && it.kind === "TASK" ? "line-through" : ""}`}>
        {showTime && it.time ? <span className="tabular-nums">{it.time} </span> : null}
        {it.title}
      </span>
    </div>
  )
}

/** 끌어 놓기 받는 칸 */
export function dropZone(onDrop: (key: string, e: DragEvent<HTMLElement>) => void) {
  return {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!e.dataTransfer.types.includes(DRAG_MIME)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      const key = e.dataTransfer.getData(DRAG_MIME)
      if (!key) return
      e.preventDefault()
      onDrop(key, e)
    },
  }
}
