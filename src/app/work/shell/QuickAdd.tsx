"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Plus, Archive, ArrowRightLeft, X } from "lucide-react"
import { usePopover, readLocal, writeLocal, isTyping, kstToday } from "./store"

// 빠른 추가: 업무 / 일정 / 메모. 상단 [+ 빠른 추가] 또는 Alt+N(업무).
// 다른 화면에서 열기: window.dispatchEvent(new CustomEvent("work:quick-add", { detail: { kind, clinicId?, groupId? } }))
// 만들고 나면 work:task-created / work:event-created / work:memo-created 이벤트를 보낸다(목록 새로고침용, detail.id).

type Kind = "task" | "event" | "memo"
type Opt = { id: string; name: string }
type Memo = { id: string; body: string; clinicId: string | null; createdAt: string }

const CATEGORY: [string, string][] = [
  ["BLOG", "블로그"], ["IMAGE", "이미지"], ["WEBSITE", "홈페이지"], ["REPORT", "보고서"], ["ADS", "광고"], ["MEETING", "미팅"], ["OTHER", "기타"],
]
const PRIORITY: [string, string][] = [["LOW", "낮음"], ["NORMAL", "보통"], ["HIGH", "높음"]]
const EVENT_TYPE: [string, string][] = [
  ["CLINIC_MEETING", "치과 미팅"], ["SALES_MEETING", "영업 미팅"], ["INTERNAL_MEETING", "사내 회의"], ["EXTERNAL", "외부 일정"], ["OTHER", "기타"],
]
const VISIBILITY: [string, string][] = [["INTERNAL", "사내 공개"], ["PRIVATE", "나만 보기"], ["CLINIC", "원장에게도 공개"]]
const TABS: [Kind, string][] = [["task", "업무"], ["event", "일정"], ["memo", "메모"]]
const LAST_KEY = "work:quick-add:last"

const input = "w-full h-9 px-2.5 border border-[#d1d1cc] rounded text-[14px] bg-white outline-none focus:border-[#0062ff]"
const labelCls = "block text-[12px] text-[#6f6f6a] mb-1"

async function post(url: string, body: unknown, method = "POST") {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  return { ok: r.ok, j }
}

export default function QuickAdd() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Kind>("task")
  const [clinics, setClinics] = useState<Opt[]>([])
  const [preset, setPreset] = useState<{ clinicId?: string; groupId?: string } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  usePopover(box, open, () => setOpen(false))

  const show = useCallback((kind: Kind, p?: { clinicId?: string; groupId?: string }) => {
    setTab(kind)
    setPreset(p && (p.clinicId || p.groupId) ? p : null)
    setOpen(true)
  }, [])

  // 외부 이벤트 + Alt+N
  useEffect(() => {
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {}
      const kind: Kind = d.kind === "event" || d.kind === "memo" ? d.kind : "task"
      show(kind, { clinicId: typeof d.clinicId === "string" ? d.clinicId : undefined, groupId: typeof d.groupId === "string" ? d.groupId : undefined })
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyN" && !isTyping(e)) {
        e.preventDefault()
        show("task")
      }
    }
    window.addEventListener("work:quick-add", onEvent)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("work:quick-add", onEvent)
      window.removeEventListener("keydown", onKey)
    }
  }, [show])

  // 치과 목록(사내 포함)은 처음 열 때 한 번
  useEffect(() => {
    if (!open || clinics.length) return
    fetch("/api/work/task-groups")
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((j) => setClinics((j.categories ?? []).map((c: Opt) => ({ id: c.id, name: c.name }))))
      .catch(() => {})
  }, [open, clinics.length])

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="빠른 추가 (Alt+N)"
        onClick={() => (open ? setOpen(false) : show("task"))}
        className="h-8 flex items-center gap-1 px-2.5 rounded bg-[#0062ff] text-white text-[12px] font-semibold hover:bg-[#0052d6] whitespace-nowrap"
      >
        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">빠른 추가</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="빠른 추가"
          className="fixed right-2 sm:right-4 top-[56px] z-50 w-[min(400px,calc(100vw-16px))] max-h-[calc(100vh-72px)] overflow-y-auto bg-white border border-[#d1d1cc] rounded shadow-[0_8px_24px_rgb(0_0_0/0.14)]"
        >
          <div className="flex items-center border-b border-[#e3e3de] pl-2 pr-1" role="tablist" aria-label="추가할 종류">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`h-[42px] px-3 text-[13px] ${tab === k ? "font-semibold text-[#0a0a0a] shadow-[inset_0_-2px_0_#0062ff]" : "text-[#6f6f6a] hover:text-[#0a0a0a]"}`}
              >
                {label}
              </button>
            ))}
            <button type="button" aria-label="닫기" onClick={() => setOpen(false)} className="ml-auto w-8 h-8 flex items-center justify-center rounded text-[#6f6f6a] hover:bg-[#f2f2ef]">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <div className="p-3" role="tabpanel">
            {tab === "task" && <TaskForm clinics={clinics} preset={preset} onDone={() => setOpen(false)} />}
            {tab === "event" && <EventForm clinics={clinics} preset={preset} />}
            {tab === "memo" && <MemoForm clinics={clinics} preset={preset} />}
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────── 업무 ───────── */
function TaskForm({ clinics, preset, onDone }: { clinics: Opt[]; preset: { clinicId?: string; groupId?: string } | null; onDone: () => void }) {
  const last = readLocal<{ clinicId?: string; groupId?: string }>(LAST_KEY, {})
  const [clinicId, setClinicId] = useState(preset?.clinicId ?? last.clinicId ?? "internal")
  const [groupId, setGroupId] = useState(preset?.clinicId ? preset.groupId ?? "" : preset?.groupId ?? last.groupId ?? "")
  const [groups, setGroups] = useState<Opt[]>([])
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("OTHER")
  const [priority, setPriority] = useState("NORMAL")
  const [dueOn, setDueOn] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string; id?: string } | null>(null)

  // 고른 치과의 그룹
  useEffect(() => {
    let alive = true
    setGroups([])
    fetch(`/api/work/task-groups?scope=${encodeURIComponent(clinicId)}`)
      .then((r) => (r.ok ? r.json() : { groups: [] }))
      .then((j) => {
        if (!alive) return
        const gs: Opt[] = (j.groups ?? []).map((g: Opt) => ({ id: g.id, name: g.name }))
        setGroups(gs)
        setGroupId((cur) => (gs.some((g) => g.id === cur) ? cur : ""))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [clinicId])

  // 목록에 없는 치과(권한 밖)로 기억돼 있으면 사내로
  useEffect(() => {
    if (clinics.length && !clinics.some((c) => c.id === clinicId)) setClinicId("internal")
  }, [clinics, clinicId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return setResult({ ok: false, text: "제목을 입력하세요" })
    setBusy(true)
    setResult(null)
    const { ok, j } = await post("/api/work/tasks", {
      clinicId,
      groupId: groupId || undefined,
      title: title.trim(),
      category,
      priority,
      dueOn: dueOn || undefined,
      assigneeUserId: "__me__",
    })
    setBusy(false)
    writeLocal(LAST_KEY, { clinicId, groupId })
    const id: string | undefined = j.id
    if (id) window.dispatchEvent(new CustomEvent("work:task-created", { detail: { id, clinicId } }))
    if (!ok) return setResult({ ok: false, text: id ? `업무는 만들었지만 ${j.error ?? "날짜·담당 저장 실패"}` : j.error ?? "추가하지 못했습니다", id })
    setTitle("")
    setDueOn("")
    setResult({ ok: true, text: "업무를 추가했습니다", id })
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <div>
        <label className={labelCls} htmlFor="qa-task-title">제목</label>
        <input id="qa-task-title" data-autofocus className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="예: 11월 블로그 2편 초안" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls} htmlFor="qa-task-clinic">치과</label>
          <select id="qa-task-clinic" className={input} value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
            {!clinics.length && <option value="internal">THINKLAB 사내</option>}
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="qa-task-group">그룹</label>
          <select id="qa-task-group" className={input} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">그룹 없음</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="qa-task-cat">종류</label>
          <select id="qa-task-cat" className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="qa-task-pri">중요도</label>
          <select id="qa-task-pri" className={input} value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITY.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls} htmlFor="qa-task-due">마감일</label>
          <input id="qa-task-due" type="date" className={input} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        </div>
      </div>
      <p className="text-[12px] text-[#8a8a84]">담당은 나로 정해집니다.</p>
      <Footer busy={busy} label="업무 추가" result={result} link={result?.id ? { href: `/work/tasks?open=${result.id}`, label: "열기", onClick: onDone } : undefined} />
    </form>
  )
}

/* ───────── 일정 ───────── */
function EventForm({ clinics, preset }: { clinics: Opt[]; preset: { clinicId?: string } | null }) {
  const [title, setTitle] = useState("")
  const [type, setType] = useState("CLINIC_MEETING")
  const [date, setDate] = useState(kstToday())
  const [allDay, setAllDay] = useState(false)
  const [startTime, setStartTime] = useState("10:00")
  const [endTime, setEndTime] = useState("11:00")
  const [clinicId, setClinicId] = useState(preset?.clinicId && preset.clinicId !== "internal" ? preset.clinicId : "")
  const [visibility, setVisibility] = useState("INTERNAL")
  const [location, setLocation] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string; id?: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setResult(null)
    const { ok, j } = await post("/api/work/calendar/events", {
      title: title.trim(), type, visibility, date, endDate: date, allDay,
      startTime: allDay ? undefined : startTime, endTime: allDay ? undefined : endTime,
      clinicId: clinicId || null, location: location.trim() || null,
    })
    setBusy(false)
    if (!ok) return setResult({ ok: false, text: j.error ?? "추가하지 못했습니다" })
    window.dispatchEvent(new CustomEvent("work:event-created", { detail: { id: j.id } }))
    setTitle("")
    setLocation("")
    setResult({ ok: true, text: "일정을 추가했습니다", id: j.id })
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <div>
        <label className={labelCls} htmlFor="qa-ev-title">제목</label>
        <input id="qa-ev-title" data-autofocus className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="예: 하얀드림 월 회의" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls} htmlFor="qa-ev-type">종류</label>
          <select id="qa-ev-type" className={input} value={type} onChange={(e) => setType(e.target.value)}>
            {EVENT_TYPE.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="qa-ev-date">날짜</label>
          <input id="qa-ev-date" type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <label className="col-span-2 flex items-center gap-2 text-[13px] text-[#3d3d3a]">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          종일
        </label>
        {!allDay && (
          <>
            <div>
              <label className={labelCls} htmlFor="qa-ev-st">시작</label>
              <input id="qa-ev-st" type="time" className={input} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="qa-ev-et">끝</label>
              <input id="qa-ev-et" type="time" className={input} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </>
        )}
        <div>
          <label className={labelCls} htmlFor="qa-ev-clinic">치과</label>
          <select id="qa-ev-clinic" className={input} value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
            <option value="">치과 없음</option>
            {clinics.filter((c) => c.id !== "internal").map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="qa-ev-vis">공개 범위</label>
          <select id="qa-ev-vis" className={input} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            {VISIBILITY.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls} htmlFor="qa-ev-loc">장소</label>
          <input id="qa-ev-loc" className={input} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
        </div>
      </div>
      <Footer busy={busy} label="일정 추가" result={result} link={result?.id ? { href: `/work/calendar?event=${result.id}`, label: "달력에서 보기" } : undefined} />
    </form>
  )
}

/* ───────── 메모 ───────── */
function MemoForm({ clinics, preset }: { clinics: Opt[]; preset: { clinicId?: string } | null }) {
  const [body, setBody] = useState("")
  const [clinicId, setClinicId] = useState(preset?.clinicId && preset.clinicId !== "internal" ? preset.clinicId : "")
  const [memos, setMemos] = useState<Memo[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string; id?: string } | null>(null)
  const name = (id: string | null) => (id ? clinics.find((c) => c.id === id)?.name ?? "치과" : "사내")

  const load = useCallback(() => {
    fetch("/api/work/memos?take=10")
      .then((r) => (r.ok ? r.json() : { memos: [] }))
      .then((j) => setMemos(j.memos ?? []))
      .catch(() => {})
  }, [])
  useEffect(load, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setResult(null)
    const { ok, j } = await post("/api/work/memos", { body, clinicId: clinicId || null })
    setBusy(false)
    if (!ok) return setResult({ ok: false, text: j.error ?? "저장하지 못했습니다" })
    window.dispatchEvent(new CustomEvent("work:memo-created", { detail: { id: j.id } }))
    setBody("")
    setResult({ ok: true, text: "메모를 저장했습니다" })
    load()
  }

  const archive = async (m: Memo) => {
    const { ok, j } = await post(`/api/work/memos/${m.id}`, { archive: true }, "PATCH")
    if (!ok) return setResult({ ok: false, text: j.error ?? "보관하지 못했습니다" })
    load()
  }

  // 메모 → 업무: 첫 줄을 제목, 전체를 설명으로. 담당은 나.
  const convert = async (m: Memo) => {
    const firstLine = m.body.split("\n").find((l) => l.trim())?.trim() ?? m.body
    const t = await post("/api/work/tasks", {
      clinicId: m.clinicId ?? "internal",
      title: firstLine.slice(0, 200),
      description: m.body,
      category: "OTHER",
      priority: "NORMAL",
      assigneeUserId: "__me__",
    })
    const id: string | undefined = t.j.id
    if (!id) return setResult({ ok: false, text: t.j.error ?? "업무로 바꾸지 못했습니다" })
    window.dispatchEvent(new CustomEvent("work:task-created", { detail: { id, clinicId: m.clinicId ?? "internal" } }))
    const p = await post(`/api/work/memos/${m.id}`, { convertedTaskId: id }, "PATCH")
    setResult(p.ok ? { ok: true, text: "업무로 바꿨습니다", id } : { ok: false, text: p.j.error ?? "메모 정리 실패(업무는 만들어짐)", id })
    load()
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="space-y-2.5">
        <div>
          <label className={labelCls} htmlFor="qa-memo-body">메모</label>
          <textarea
            id="qa-memo-body"
            data-autofocus
            className={`${input} h-[88px] py-2 resize-none`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            placeholder="잊기 전에 적어 두기. 나중에 업무로 바꿀 수 있습니다"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()
            }}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="qa-memo-clinic">치과(선택)</label>
          <select id="qa-memo-clinic" className={input} value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
            <option value="">치과 없음</option>
            {clinics.filter((c) => c.id !== "internal").map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <Footer busy={busy} label="메모 저장" result={result} link={result?.id ? { href: `/work/tasks?open=${result.id}`, label: "업무 열기" } : undefined} />
      </form>

      <div className="border-t border-[#ecece9] pt-2">
        <div className="text-[12px] font-semibold text-[#6f6f6a] mb-1">내 메모</div>
        {!memos.length && <p className="text-[12px] text-[#8a8a84] py-1">아직 없습니다</p>}
        <ul className="divide-y divide-[#ecece9]">
          {memos.map((m) => (
            <li key={m.id} className="py-2">
              <p className="text-[13px] text-[#0a0a0a] whitespace-pre-wrap line-clamp-3 break-words">{m.body}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-[#8a8a84] tabular-nums">
                <span>{name(m.clinicId)} · {new Date(new Date(m.createdAt).getTime() + 9 * 3600_000).toISOString().slice(5, 16).replace("-", ".").replace("T", " ")}</span>
                <button type="button" onClick={() => convert(m)} className="ml-auto flex items-center gap-1 text-[#0062ff] hover:underline">
                  <ArrowRightLeft className="w-3 h-3" aria-hidden="true" />
                  업무로 바꾸기
                </button>
                <button type="button" onClick={() => archive(m)} className="flex items-center gap-1 text-[#6f6f6a] hover:text-[#0a0a0a]">
                  <Archive className="w-3 h-3" aria-hidden="true" />
                  보관
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Footer({ busy, label, result, link }: { busy: boolean; label: string; result: { ok: boolean; text: string } | null; link?: { href: string; label: string; onClick?: () => void } }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <button type="submit" disabled={busy} className="h-9 px-4 rounded bg-[#0062ff] text-white text-[13px] font-semibold disabled:bg-[#d1d1cc]">
        {busy ? "저장 중" : label}
      </button>
      {result && (
        <p role="status" className={`text-[12px] ${result.ok ? "text-[#1a7f37]" : "text-[#d92d20]"}`}>
          {result.text}
          {link && (
            <>
              {" "}
              <Link href={link.href} prefetch={false} onClick={link.onClick} className="text-[#0062ff] underline">
                {link.label}
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  )
}
