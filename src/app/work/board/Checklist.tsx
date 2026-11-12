"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { GripVertical, X } from "lucide-react"

// 업무 상세 서랍의 체크리스트(하위 단계). 추가·완료 표시·이름 바꾸기·순서 이동·삭제.

type Item = { id: string; title: string; sortOrder: number; doneAt: string | null }

async function call<T>(url: string, method: string, json?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: json !== undefined ? { "content-type": "application/json" } : undefined, body: json !== undefined ? JSON.stringify(json) : undefined })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? "저장 실패")
  return j as T
}

const PRESET = ["원고", "내부 확인", "원장 검수", "발행"]

export default function ChecklistSection({ taskId, onChanged }: { taskId: string; onChanged?: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [v, setV] = useState("")
  const [err, setErr] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [drag, setDrag] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const base = `/api/work/tasks/${taskId}/checklist`

  const load = useCallback(() => call<{ items: Item[] }>(base, "GET").then((j) => setItems(j.items)).catch((e) => setErr(e.message)), [base])
  useEffect(() => {
    setItems(null)
    load()
  }, [load])

  const run = async (fn: () => Promise<unknown>) => {
    setErr("")
    try {
      await fn()
    } catch (e) {
      setErr((e as Error).message)
    }
    await load()
    onChanged?.()
  }

  const add = async (title: string) => {
    if (!title.trim()) return
    await run(() => call(base, "POST", { title }))
  }

  const done = items?.filter((i) => i.doneAt).length ?? 0
  const total = items?.length ?? 0

  return (
    <section aria-label="체크리스트">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-[14px] font-bold">체크리스트</h3>
        {total > 0 && (
          <>
            <span className={`text-[12px] tabular-nums ${done === total ? "text-[#1a7f37]" : "text-[#6f6f6a]"}`}>
              {done}/{total}
            </span>
            <span className="w-20 h-1 rounded-full bg-[#ecece9] overflow-hidden" aria-hidden="true">
              <span className="block h-full bg-[#1a7f37]" style={{ width: `${Math.round((done / total) * 100)}%` }} />
            </span>
          </>
        )}
      </div>
      {items === null ? (
        <p className="text-[12px] text-[#6f6f6a]">{err || "불러오는 중…"}</p>
      ) : (
        <ul className="space-y-px">
          {items.map((it) => (
            <li
              key={it.id}
              className={`group/ck flex items-center gap-1.5 h-8 px-1 rounded hover:bg-[#f7f7f5] ${drag === it.id ? "opacity-40" : ""}`}
              onDragOver={(e) => drag && drag !== it.id && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (!drag || drag === it.id) return
                const ids = items.map((i) => i.id).filter((id) => id !== drag)
                ids.splice(ids.indexOf(it.id), 0, drag)
                setDrag(null)
                setItems(ids.map((id) => items.find((i) => i.id === id)!))
                run(() => call(base, "PATCH", { order: ids }))
              }}
            >
              <span
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move"
                  e.dataTransfer.setData("text/plain", it.id)
                  setDrag(it.id)
                }}
                onDragEnd={() => setDrag(null)}
                className="cursor-grab text-[#b0b0aa] opacity-0 group-hover/ck:opacity-100"
                title="끌어서 순서 이동"
                aria-hidden="true"
              >
                <GripVertical className="w-3 h-3" />
              </span>
              <input
                type="checkbox"
                className="w-4 h-4 accent-[#1a7f37]"
                aria-label={`${it.title} 완료`}
                checked={!!it.doneAt}
                onChange={(e) => {
                  const on = e.target.checked
                  setItems(items.map((i) => (i.id === it.id ? { ...i, doneAt: on ? new Date().toISOString() : null } : i)))
                  run(() => call(`${base}/${it.id}`, "PATCH", { done: on }))
                }}
              />
              {editing === it.id ? (
                <input
                  autoFocus
                  aria-label="항목 이름"
                  defaultValue={it.title}
                  className="flex-1 h-7 px-1.5 rounded border border-[#0062ff] text-[14px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                    if (e.key === "Escape") setEditing(null)
                  }}
                  onBlur={(e) => {
                    const t = e.target.value.trim()
                    setEditing(null)
                    if (t && t !== it.title) run(() => call(`${base}/${it.id}`, "PATCH", { title: t }))
                  }}
                />
              ) : (
                <button className={`flex-1 min-w-0 truncate text-left text-[14px] ${it.doneAt ? "text-[#8a8a84] line-through" : ""}`} onClick={() => setEditing(it.id)} title="눌러서 이름 바꾸기">
                  {it.title}
                </button>
              )}
              <button
                className="w-6 h-6 flex items-center justify-center rounded text-[#8a8a84] hover:bg-[#ecece9] hover:text-[#d92d20] opacity-0 group-hover/ck:opacity-100 focus:opacity-100"
                aria-label={`${it.title} 삭제`}
                onClick={() => {
                  setItems(items.filter((i) => i.id !== it.id))
                  run(() => call(`${base}/${it.id}`, "DELETE"))
                }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-1 flex items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          const t = v.trim()
          if (!t) return
          setV("")
          await add(t)
          inputRef.current?.focus()
        }}
      >
        <input
          ref={inputRef}
          aria-label="체크리스트 항목 추가"
          className="flex-1 h-8 px-2 rounded border border-[#d1d1cc] text-[14px]"
          placeholder="단계 추가 (입력 후 Enter)"
          value={v}
          onChange={(e) => setV(e.target.value)}
        />
      </form>
      {items !== null && total === 0 && (
        <button
          className="mt-1 text-[12px] text-[#0062ff] hover:underline"
          onClick={() =>
            run(async () => {
              for (const t of PRESET) await call(base, "POST", { title: t })
            })
          }
        >
          기본 단계 넣기 (원고 → 내부 확인 → 원장 검수 → 발행)
        </button>
      )}
      {err && <p className="mt-1 text-[12px] text-[#d92d20]">{err}</p>}
    </section>
  )
}
