"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Inbox, ListChecks, ShieldCheck } from "lucide-react"
import { Avatar, PriorityFlag, StatusDot, dueLabel, statusOf, type Task } from "./shared"

// 칸반: 할 일 · 자료 대기 · 진행 · 검토 4열 + 완료(접힘). 취소는 숨김. 카드 끌어 놓으면 상태 변경.

const COLUMNS = ["TODO", "BLOCKED", "IN_PROGRESS", "IN_REVIEW"]

export default function KanbanView({ tasks, today, onOpen, onStatus }: { tasks: Task[]; today: string; onOpen: (id: string) => void; onStatus: (id: string, status: string) => void }) {
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [doneOpen, setDoneOpen] = useState(false)
  const by = (s: string) => tasks.filter((t) => t.status === s)
  const dragTask = drag ? tasks.find((t) => t.id === drag) : undefined

  const zone = (status: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragTask || dragTask.status === status) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      if (over !== status) setOver(status)
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver(null)
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      if (dragTask && dragTask.status !== status) onStatus(dragTask.id, status)
      setDrag(null)
      setOver(null)
    },
  })

  const card = (t: Task) => {
    const due = dueLabel(t, today)
    return (
      <li
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
        className={`bg-white rounded border border-[#d1d1cc] p-2.5 cursor-grab active:cursor-grabbing hover:border-[#8a8a84] ${drag === t.id ? "opacity-50" : ""}`}
      >
        <button className="block w-full text-left text-[14px] leading-snug hover:text-[#0062ff] line-clamp-2" onClick={() => onOpen(t.id)}>
          {t.title}
        </button>
        <div className="mt-1 text-[12px] text-[#8a8a84] truncate">
          {t.clinic?.name ?? "사내"}
          {t.group ? ` · ${t.group.name}` : ""}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[12px]">
          <Avatar name={t.assignee?.user.name} size={20} />
          {due && <span className={`tabular-nums ${due.late ? "text-[#d92d20] font-medium" : "text-[#555]"}`}>{due.text}</span>}
          {t._count.checklist > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[#8a8a84] tabular-nums">
              <ListChecks className="w-3 h-3" aria-hidden="true" />
              {t.checklistDone}/{t._count.checklist}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1">
            {t.reviewRequired && <ShieldCheck className="w-3.5 h-3.5 text-[#b54708]" aria-label="검수 필요" />}
            {t.serviceRequestId && <Inbox className="w-3.5 h-3.5 text-[#0062ff]" aria-label="원장 요청" />}
            {t.priority !== "NORMAL" && <PriorityFlag p={t.priority} />}
          </span>
        </div>
      </li>
    )
  }

  const done = by("DONE")
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 items-start">
      {COLUMNS.map((s) => {
        const list = by(s)
        return (
          <section key={s} aria-label={statusOf(s).label} {...zone(s)} className={`w-[272px] shrink-0 rounded border ${over === s ? "border-[#0062ff] bg-[#eef4ff]" : "border-[#d1d1cc] bg-[#f7f7f5]"}`}>
            <h2 className="h-10 px-3 flex items-center gap-2 text-[13px] font-semibold">
              <StatusDot s={s} />
              {statusOf(s).label}
              <span className="text-[12px] font-normal text-[#8a8a84] tabular-nums">{list.length}</span>
            </h2>
            <ul className="px-2 pb-2 space-y-2 min-h-[80px] max-h-[calc(100vh-260px)] overflow-y-auto">{list.map(card)}</ul>
          </section>
        )
      })}
      {doneOpen ? (
        <section aria-label="완료" {...zone("DONE")} className={`w-[272px] shrink-0 rounded border ${over === "DONE" ? "border-[#0062ff] bg-[#eef4ff]" : "border-[#d1d1cc] bg-[#f7f7f5]"}`}>
          <h2 className="h-10 px-3 flex items-center gap-2 text-[13px] font-semibold">
            <StatusDot s="DONE" />
            완료
            <span className="text-[12px] font-normal text-[#8a8a84] tabular-nums">{done.length}</span>
            <button className="ml-auto w-7 h-7 flex items-center justify-center rounded hover:bg-[#ecece9]" aria-label="완료 열 접기" onClick={() => setDoneOpen(false)}>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </h2>
          <ul className="px-2 pb-2 space-y-2 min-h-[80px] max-h-[calc(100vh-260px)] overflow-y-auto">{done.map(card)}</ul>
        </section>
      ) : (
        <button
          {...zone("DONE")}
          onClick={() => setDoneOpen(true)}
          aria-label={`완료 ${done.length}건 펼치기`}
          className={`w-11 shrink-0 self-stretch min-h-[160px] rounded border flex flex-col items-center gap-2 pt-3 text-[13px] ${over === "DONE" ? "border-[#0062ff] bg-[#eef4ff]" : "border-[#d1d1cc] bg-[#f7f7f5] hover:bg-[#ecece9]"}`}
        >
          <ChevronRight className="w-4 h-4 text-[#6f6f6a]" aria-hidden="true" />
          <StatusDot s="DONE" />
          <span className="[writing-mode:vertical-rl] font-semibold">완료</span>
          <span className="text-[12px] text-[#8a8a84] tabular-nums">{done.length}</span>
        </button>
      )}
    </div>
  )
}
