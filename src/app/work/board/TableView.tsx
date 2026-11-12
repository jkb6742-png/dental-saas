"use client"

import { memo, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronRight, GripVertical, Inbox, ListChecks, MessageSquare, MoreHorizontal, Paperclip, Plus, ShieldCheck } from "lucide-react"
import { Avatar, PriorityFlag, StatusDot, dueLabel, kindOf, statusOf, type Group, type Task } from "./shared"

// 표 보기: 그룹 헤더(52px) + 업무 행(48px) + 그룹 맨 아래 빠른 입력

export const COLS = "36px minmax(360px,1fr) 76px 108px 112px 56px 72px 36px"

export type Section = {
  key: string
  title: string
  group: Group | null
  clinicId: string | null
  tasks: Task[]
}

type Dnd = {
  start: (id: string) => void
  end: () => void
  over: (t: Task, after: boolean) => boolean
  drop: (t: Task, after: boolean) => void
}

export type PopType = "assignee" | "status" | "due" | "priority" | "task-menu"

/** 표·칸반·달력이 공통으로 부르는 동작(참조가 바뀌지 않음) */
export type Act = {
  open: (id: string) => void
  pop: (type: PopType, taskId: string, el: HTMLElement) => void
  groupMenu: (groupId: string, el: HTMLElement) => void
  toggleSel: (id: string, shift: boolean) => void
  toggleSection: (ids: string[], on: boolean) => void
  add: (section: Section, title: string) => Promise<boolean>
  dropOnRow: (dragId: string, targetId: string, after: boolean) => void
  dropOnGroup: (dragId: string, section: Section) => void
  renameGroup: (groupId: string, name: string | null) => void
}

export default function TableView({
  sections,
  today,
  selected,
  closed,
  onToggleClosed,
  act,
  canReorder,
  canDropToGroup,
  renaming,
  cross,
  addRefs,
}: {
  sections: Section[]
  today: string
  selected: Set<string>
  closed: Record<string, boolean>
  onToggleClosed: (key: string) => void
  act: Act
  canReorder: boolean
  canDropToGroup: boolean
  renaming: string | null
  cross: boolean
  addRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>
}) {
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null)
  const [overGroup, setOverGroup] = useState<string | null>(null)
  const anySel = selected.size > 0
  const dragTask = drag ? sections.flatMap((s) => s.tasks).find((t) => t.id === drag) : undefined

  const endDrag = () => {
    setDrag(null)
    setOver(null)
    setOverGroup(null)
  }
  // 행 드래그 콜백은 참조를 고정해 memo 된 행이 다시 그려지지 않게 한다
  const liveRef = useRef({ drag, over, dragTask, canReorder, act, endDrag })
  liveRef.current = { drag, over, dragTask, canReorder, act, endDrag }
  const dnd = useMemo<Dnd>(
    () => ({
      start: (id) => setDrag(id),
      end: () => liveRef.current.endDrag(),
      over: (t, after) => {
        const L = liveRef.current
        if (!L.canReorder || !L.drag || L.drag === t.id || L.dragTask?.clinicId !== t.clinicId) return false
        if (L.over?.id !== t.id || L.over.after !== after) setOver({ id: t.id, after })
        return true
      },
      drop: (t, after) => {
        const L = liveRef.current
        if (L.drag && L.drag !== t.id) L.act.dropOnRow(L.drag, t.id, after)
        L.endDrag()
      },
    }),
    []
  )

  if (!sections.length) return <p className="bg-white rounded border border-[#d1d1cc] p-4 text-[13px] text-[#6f6f6a]">조건에 맞는 업무가 없습니다.</p>

  return (
    <div className="space-y-3">
      {sections.map((s) => {
        const isClosed = !!closed[s.key]
        const live = s.tasks.filter((t) => t.status !== "CANCELLED")
        const done = live.filter((t) => t.status === "DONE").length
        const late = s.tasks.filter((t) => dueLabel(t, today)?.late).length
        const pct = live.length ? Math.round((done / live.length) * 100) : 0
        const allSel = s.tasks.length > 0 && s.tasks.every((t) => selected.has(t.id))
        // 그룹 헤더에 놓기 = 이 그룹으로 이동(같은 카테고리, 다른 그룹)
        const groupDroppable = canDropToGroup && !!dragTask && dragTask.clinicId === s.clinicId && (dragTask.groupId ?? null) !== (s.group?.id ?? null)
        return (
          <section key={s.key} className="bg-white rounded border border-[#d1d1cc]" aria-label={s.title}>
            <div
              className={`group/head h-[52px] flex items-center gap-2 pl-2 pr-2 border-b border-[#ecece9] ${isClosed ? "border-b-0" : ""} ${overGroup === s.key ? "bg-[#e8f0ff] outline outline-1 outline-[#0062ff]" : ""}`}
              onDragOver={(e) => {
                if (!groupDroppable) return
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                if (overGroup !== s.key) setOverGroup(s.key)
              }}
              onDragLeave={() => overGroup === s.key && setOverGroup(null)}
              onDrop={(e) => {
                if (!groupDroppable || !drag) return
                e.preventDefault()
                act.dropOnGroup(drag, s)
                endDrag()
              }}
            >
              <button
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#ecece9] text-[#6f6f6a]"
                aria-label={isClosed ? `${s.title} 펼치기` : `${s.title} 접기`}
                aria-expanded={!isClosed}
                onClick={() => onToggleClosed(s.key)}
              >
                {isClosed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {s.group && renaming === s.group.id ? (
                <RenameInput name={s.group.name} onDone={(v) => act.renameGroup(s.group!.id, v)} />
              ) : (
                <h2 className={`text-[15px] font-semibold truncate max-w-[320px] ${s.group || cross ? "text-[#0a0a0a]" : "text-[#6f6f6a]"}`}>{s.title}</h2>
              )}
              <span className="text-[12px] text-[#8a8a84] tabular-nums whitespace-nowrap">
                {s.tasks.length}건 · 완료 {done}/{live.length}
                {late > 0 && <span className="text-[#d92d20]"> · 지연 {late}</span>}
              </span>
              {live.length > 0 && (
                <span className="hidden sm:flex items-center gap-1.5 ml-1" aria-label={`완료율 ${pct}%`}>
                  <span className="w-20 h-1 rounded-full bg-[#ecece9] overflow-hidden">
                    <span className="block h-full bg-[#1a7f37]" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-[11px] text-[#8a8a84] tabular-nums">{pct}%</span>
                </span>
              )}
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  className="h-7 px-2 rounded text-[12px] text-[#6f6f6a] hover:bg-[#ecece9] inline-flex items-center gap-1"
                  onClick={() => {
                    if (isClosed) onToggleClosed(s.key)
                    setTimeout(() => addRefs.current[s.key]?.focus(), 0)
                  }}
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  업무
                </button>
                {s.group && (
                  <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#ecece9] text-[#6f6f6a]" aria-label={`${s.group.name} 그룹 메뉴`} onClick={(e) => act.groupMenu(s.group!.id, e.currentTarget)}>
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {!isClosed && (
              <div className="overflow-x-auto">
                <div className="min-w-[856px]" role="table" aria-label={`${s.title} 업무`}>
                  <div role="row" className="grid h-8 items-center text-[12px] text-[#8a8a84] border-b border-[#ecece9]" style={{ gridTemplateColumns: COLS }}>
                    <span role="columnheader" className="flex justify-center">
                      <input
                        type="checkbox"
                        aria-label={`${s.title} 전체 선택`}
                        className={`w-3.5 h-3.5 accent-[#0062ff] ${anySel ? "" : "opacity-0 hover:opacity-100 focus:opacity-100"}`}
                        checked={allSel}
                        onChange={(e) => act.toggleSection(s.tasks.map((t) => t.id), e.target.checked)}
                      />
                    </span>
                    <span role="columnheader" className="px-2">업무명</span>
                    <span role="columnheader" className="px-2">담당</span>
                    <span role="columnheader" className="px-2">상태</span>
                    <span role="columnheader" className="px-2">마감</span>
                    <span role="columnheader" className="px-1 text-center">우선</span>
                    <span role="columnheader" className="px-2">활동</span>
                    <span role="columnheader" />
                  </div>
                  {s.tasks.map((t) => (
                    <Row
                      key={t.id}
                      t={t}
                      today={today}
                      selected={selected.has(t.id)}
                      anySel={anySel}
                      act={act}
                      cross={cross}
                      draggable={canReorder || canDropToGroup}
                      dropLine={over?.id === t.id ? (over.after ? "after" : "before") : null}
                      dnd={dnd}
                    />
                  ))}
                  <AddRow section={s} act={act} addRefs={addRefs} />
                </div>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

const cellBtn = "h-8 w-full px-2 flex items-center gap-1.5 rounded hover:bg-[#ecece9] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#0062ff] text-left"

const Row = memo(function Row({
  t,
  today,
  selected,
  anySel,
  act,
  cross,
  draggable,
  dropLine,
  dnd,
}: {
  t: Task
  today: string
  selected: boolean
  anySel: boolean
  act: Act
  cross: boolean
  draggable: boolean
  dropLine: "before" | "after" | null
  dnd: Dnd
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const st = statusOf(t.status)
  const due = dueLabel(t, today)
  const K = kindOf(t.category).Icon
  const closedTask = t.status === "DONE" || t.status === "CANCELLED"
  const name = t.assignee?.user.name ?? null
  const afterOf = (e: React.DragEvent) => {
    const r = rowRef.current!.getBoundingClientRect()
    return e.clientY > r.top + r.height / 2
  }
  return (
    <div
      ref={rowRef}
      role="row"
      aria-selected={selected}
      className={`group/row relative grid h-12 items-center border-b border-[#f2f2ef] text-[13px] ${selected ? "bg-[#f0f5ff]" : "hover:bg-[#fafaf8]"}`}
      style={{ gridTemplateColumns: COLS }}
      onDragOver={(e) => {
        if (dnd.over(t, afterOf(e))) {
          e.preventDefault()
          e.dataTransfer.dropEffect = "move"
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        dnd.drop(t, afterOf(e))
      }}
    >
      {dropLine && <span className={`absolute left-0 right-0 h-0.5 bg-[#0062ff] pointer-events-none ${dropLine === "before" ? "top-0" : "bottom-0"}`} aria-hidden="true" />}
      <span role="cell" className="relative flex items-center justify-center h-full">
        {draggable && (
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move"
              e.dataTransfer.setData("text/plain", t.id)
              if (rowRef.current) e.dataTransfer.setDragImage(rowRef.current, 24, 24)
              dnd.start(t.id)
            }}
            onDragEnd={dnd.end}
            className="absolute left-0 top-0 h-full w-3 flex items-center justify-center cursor-grab text-[#b0b0aa] opacity-0 group-hover/row:opacity-100"
            title="끌어서 순서·그룹 이동"
            aria-hidden="true"
          >
            <GripVertical className="w-3 h-3" />
          </span>
        )}
        <input
          type="checkbox"
          aria-label={`${t.title} 선택`}
          className={`w-3.5 h-3.5 accent-[#0062ff] ${selected || anySel ? "" : "opacity-0 group-hover/row:opacity-100 focus:opacity-100"}`}
          checked={selected}
          onChange={() => {}}
          onClick={(e) => act.toggleSel(t.id, e.shiftKey)}
        />
      </span>

      <span role="cell" className="min-w-0 flex items-center gap-1.5 px-2">
        <K className="w-3.5 h-3.5 shrink-0 text-[#8a8a84]" aria-label={kindOf(t.category).label} />
        <button
          className={`min-w-0 truncate text-left text-[14px] hover:text-[#0062ff] hover:underline ${t.status === "CANCELLED" ? "line-through text-[#9a9a94]" : closedTask ? "text-[#8a8a84]" : "text-[#0a0a0a]"}`}
          onClick={() => act.open(t.id)}
          title={t.title}
        >
          {t.title}
        </button>
        {t.quotaSlot != null && (
          <span className="shrink-0 text-[11px] text-[#8a8a84] tabular-nums" title="계약 순번">
            {t.quotaSlot}
            {t.monthlyCommitment ? `/${t.monthlyCommitment.targetCount}` : ""}
          </span>
        )}
        {t.reviewRequired && <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-[#b54708]" aria-label="검수 필요" />}
        {t.serviceRequestId && <Inbox className="w-3.5 h-3.5 shrink-0 text-[#0062ff]" aria-label="원장 요청" />}
        {t._count.checklist > 0 && (
          <span className={`shrink-0 inline-flex items-center gap-0.5 text-[11px] tabular-nums ${t.checklistDone === t._count.checklist ? "text-[#1a7f37]" : "text-[#8a8a84]"}`} title="체크리스트">
            <ListChecks className="w-3 h-3" aria-hidden="true" />
            {t.checklistDone}/{t._count.checklist}
          </span>
        )}
        {cross && t.group && <span className="shrink-0 max-w-[120px] truncate text-[11px] text-[#9a9a94]">{t.group.name}</span>}
      </span>

      <span role="cell" className="px-1">
        <button className={cellBtn} aria-label={`담당: ${name ?? "미배정"}`} title={name ?? "미배정"} onClick={(e) => act.pop("assignee", t.id, e.currentTarget)}>
          <Avatar name={name} />
        </button>
      </span>

      <span role="cell" className="px-1">
        <button className={cellBtn} aria-label={`상태: ${st.label}`} onClick={(e) => act.pop("status", t.id, e.currentTarget)}>
          <StatusDot s={t.status} />
          <span className="truncate" style={{ color: st.text }}>
            {st.label}
          </span>
        </button>
      </span>

      <span role="cell" className="px-1">
        <button className={cellBtn} aria-label={`마감: ${due?.text ?? "없음"}`} onClick={(e) => act.pop("due", t.id, e.currentTarget)}>
          {due ? (
            <span className={`tabular-nums ${due.late ? "text-[#d92d20] font-medium" : due.soon ? "text-[#0a0a0a] font-medium" : "text-[#555]"}`}>{due.text}</span>
          ) : (
            <span className="text-[#c4c4be] opacity-0 group-hover/row:opacity-100">마감 지정</span>
          )}
        </button>
      </span>

      <span role="cell" className="px-1">
        <button className={`${cellBtn} justify-center`} aria-label={`우선순위: ${t.priority === "HIGH" ? "긴급" : t.priority === "LOW" ? "낮음" : "보통"}`} onClick={(e) => act.pop("priority", t.id, e.currentTarget)}>
          <PriorityFlag p={t.priority} />
        </button>
      </span>

      <span role="cell" className="px-2 flex items-center gap-2 text-[12px] text-[#8a8a84] tabular-nums">
        {t._count.comments > 0 && (
          <span className="inline-flex items-center gap-0.5" title={`댓글 ${t._count.comments}`}>
            <MessageSquare className="w-3 h-3" aria-hidden="true" />
            {t._count.comments}
          </span>
        )}
        {t._count.files > 0 && (
          <span className="inline-flex items-center gap-0.5" title={`첨부 ${t._count.files}`}>
            <Paperclip className="w-3 h-3" aria-hidden="true" />
            {t._count.files}
          </span>
        )}
      </span>

      <span role="cell" className="flex justify-center">
        <button className="w-7 h-7 flex items-center justify-center rounded text-[#8a8a84] hover:bg-[#ecece9] opacity-60 group-hover/row:opacity-100" aria-label={`${t.title} 메뉴`} onClick={(e) => act.pop("task-menu", t.id, e.currentTarget)}>
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </span>
    </div>
  )
})

function AddRow({ section, act, addRefs }: { section: Section; act: Act; addRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>> }) {
  const [v, setV] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="flex items-center gap-1.5 h-10 pl-[44px] pr-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const title = v.trim()
        if (!title || busy) return
        setBusy(true)
        const ok = await act.add(section, title)
        setBusy(false)
        if (ok) setV("")
        addRefs.current[section.key]?.focus()
      }}
    >
      <Plus className="w-3.5 h-3.5 text-[#9a9a94]" aria-hidden="true" />
      <input
        ref={(el) => {
          addRefs.current[section.key] = el
        }}
        aria-label={`${section.title}에 업무 추가`}
        className="flex-1 h-8 px-1 bg-transparent text-[14px] placeholder:text-[#9a9a94] focus:outline-none"
        placeholder="업무 추가 (입력 후 Enter, 이어서 입력)"
        value={v}
        disabled={busy}
        onChange={(e) => setV(e.target.value)}
      />
    </form>
  )
}

function RenameInput({ name, onDone }: { name: string; onDone: (v: string | null) => void }) {
  const [v, setV] = useState(name)
  const done = useRef(false)
  const finish = (val: string | null) => {
    if (done.current) return
    done.current = true
    onDone(val)
  }
  return (
    <input
      autoFocus
      aria-label="그룹 이름"
      className="h-8 w-[260px] px-2 rounded border border-[#0062ff] text-[14px] font-semibold"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(v.trim() && v.trim() !== name ? v.trim() : null)
        if (e.key === "Escape") finish(null)
      }}
      onBlur={() => finish(v.trim() && v.trim() !== name ? v.trim() : null)}
    />
  )
}
