"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowUpDown, Bookmark, CalendarDays, Check, Columns3, Filter as FilterIcon, FolderInput, Plus, Search, Table2, X } from "lucide-react"
import { api } from "../ui"
import { TaskDrawer } from "../tasks/TasksClient"
import TableView, { type Act, type PopType, type Section } from "./TableView"
import KanbanView from "./KanbanView"
import CalendarView from "./CalendarView"
import CategoryPanel from "./CategoryPanel"
import {
  Avatar,
  DatePick,
  KIND,
  MenuItem,
  PRIORITY,
  PRIORITY_RANK,
  Popover,
  PriorityFlag,
  STATUS,
  StatusDot,
  canAssign,
  isCross,
  isOpen,
  kstToday,
  weekRange,
  type Board,
  type Category,
  type Quick,
  type Task,
} from "./shared"

// 업무 보드: 카테고리 패널 + 도구 모음(빠른 보기·검색·필터·정렬·보기 전환·저장된 보기) + 표/칸반/달력 + 일괄 작업 바

type View = "table" | "kanban" | "calendar"
type Sort = "manual" | "due" | "priority" | "updated"
type QuickTab = "all" | "mine" | "late" | "week" | "review"
type Filter = { assignees: string[]; groups: string[]; statuses: string[]; kinds: string[]; review: boolean; request: boolean; from: string; to: string }
type SavedView = { name: string; quick: QuickTab; filter: Filter; sort: Sort; view: View; search: string }
type Pop = { kind: string; anchor: DOMRect; taskId?: string; groupId?: string }

const EMPTY: Filter = { assignees: [], groups: [], statuses: [], kinds: [], review: false, request: false, from: "", to: "" }
const QUICK_TABS: [QuickTab, string][] = [
  ["all", "전체"],
  ["mine", "내 업무"],
  ["late", "지연"],
  ["week", "이번 주 마감"],
  ["review", "검토 대기"],
]
const SORTS: [Sort, string][] = [
  ["manual", "수동"],
  ["due", "마감"],
  ["priority", "우선순위"],
  ["updated", "최근 수정"],
]
const CROSS_NAME: Record<string, string> = { all: "전체 업무", mine: "내 업무", overdue: "지연 업무" }
const PREFS_KEY = "work.board.prefs"
const VIEWS_KEY = "work.board.views"

function readLS<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key)
    return v ? { ...fallback, ...JSON.parse(v) } : fallback
  } catch {
    return fallback
  }
}
function readViews(): SavedView[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(VIEWS_KEY) ?? "[]")
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
function writeLS(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}
const filterCount = (f: Filter) => f.assignees.length + f.groups.length + f.statuses.length + f.kinds.length + (f.review ? 1 : 0) + (f.request ? 1 : 0) + (f.from || f.to ? 1 : 0)
const d10 = (v: string | null) => (v ? v.slice(0, 10) : "")

export default function BoardClient({ me, initialScope }: { me: { id: string; name: string }; initialScope: string }) {
  const [cats, setCats] = useState<Category[]>([])
  const [quickCounts, setQuickCounts] = useState<Quick | null>(null)
  const [scope, setScope] = useState(initialScope)
  const [board, setBoard] = useState<Board | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [view, setView] = useState<View>("table")
  const [sort, setSort] = useState<Sort>("manual")
  const [quick, setQuick] = useState<QuickTab>("all")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>(EMPTY)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pop, setPop] = useState<Pop | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; bad: boolean } | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [pinned, setPinned] = useState<string[]>([])
  const [saved, setSaved] = useState<SavedView[]>([])
  const addRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const lastSel = useRef<string | null>(null)
  const today = kstToday()
  const cross = isCross(scope)

  // 개인 설정(브라우저 저장)
  useEffect(() => {
    const p = readLS(PREFS_KEY, { view: "table" as View, sort: "manual" as Sort, collapsed: false, pinned: [] as string[] })
    setView(p.view)
    setSort(p.sort)
    setCollapsed(p.collapsed)
    setPinned(Array.isArray(p.pinned) ? p.pinned : [])
    setSaved(readViews())
  }, [])
  const prefsReady = useRef(false)
  useEffect(() => {
    if (!prefsReady.current) {
      prefsReady.current = true
      return
    }
    writeLS(PREFS_KEY, { view, sort, collapsed, pinned })
  }, [view, sort, collapsed, pinned])

  const flash = useCallback((msg: string, bad = false) => setToast({ msg, bad }), [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.bad ? 6000 : 3000)
    return () => clearTimeout(t)
  }, [toast])

  const loadCats = useCallback(
    () =>
      api<{ categories: Category[]; quick?: Quick }>("/api/work/task-groups")
        .then((j) => {
          setCats(j.categories)
          setQuickCounts(j.quick ?? null)
        })
        .catch((e) => flash(e.message, true)),
    [flash]
  )
  const loadBoard = useCallback(
    () =>
      api<Board>(`/api/work/task-groups?scope=${encodeURIComponent(scope)}${showDone ? "&done=1" : ""}`)
        .then(setBoard)
        .catch((e) => flash(e.message, true)),
    [scope, showDone, flash]
  )
  useEffect(() => {
    loadCats()
  }, [loadCats])
  useEffect(() => {
    setBoard(null)
    setSelected(new Set())
    setRenaming(null)
    loadBoard()
    try {
      window.history.replaceState(null, "", `/work/board?scope=${encodeURIComponent(scope)}`)
    } catch {}
  }, [loadBoard, scope])

  const refresh = useCallback(() => {
    loadBoard()
    loadCats()
  }, [loadBoard, loadCats])
  // 탭으로 돌아오면 즉시 갱신
  useEffect(() => {
    const on = () => document.visibilityState === "visible" && refresh()
    document.addEventListener("visibilitychange", on)
    return () => document.removeEventListener("visibilitychange", on)
  }, [refresh])
  // 저장 후 한꺼번에 다시 읽기
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshSoon = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(refresh, 400)
  }, [refresh])

  // ── 저장(낙관적 반영 → 실패 시 알림 + 다시 읽기) ──
  const applyLocal = useCallback(
    (t: Task, p: Record<string, unknown>, b: Board): Task => {
      const n: Task = { ...t }
      if ("status" in p) {
        n.status = String(p.status)
        n.completedAt = p.status === "DONE" ? new Date().toISOString() : null
      }
      if ("priority" in p) n.priority = String(p.priority)
      if ("dueOn" in p) n.dueOn = p.dueOn ? String(p.dueOn) : null
      if ("assigneeUserId" in p) {
        n.assigneeUserId = (p.assigneeUserId as string | null) ?? null
        const who = b.assignable.find((a) => a.id === n.assigneeUserId)
        n.assignee = who ? { user: { name: who.name } } : null
      }
      if ("groupId" in p) {
        n.groupId = (p.groupId as string | null) ?? null
        const g = b.groups.find((x) => x.id === n.groupId)
        n.group = g ? { name: g.name } : null
      }
      if ("sortOrder" in p) n.sortOrder = Number(p.sortOrder)
      n.updatedAt = new Date().toISOString()
      return n
    },
    []
  )
  const patchTask = useCallback(
    async (id: string, p: Record<string, unknown>) => {
      setBoard((b) => (b ? { ...b, tasks: b.tasks.map((t) => (t.id === id ? applyLocal(t, p, b) : t)) } : b))
      try {
        await api(`/api/work/tasks/${id}`, { method: "PATCH", json: p })
        refreshSoon()
      } catch (e) {
        flash((e as Error).message, true)
        refresh()
      }
    },
    [applyLocal, flash, refresh, refreshSoon]
  )
  const bulk = useCallback(
    async (body: { ids: string[]; patch: Record<string, unknown> } | { items: { id: string; patch: Record<string, unknown> }[] }, label?: string) => {
      const items = "items" in body ? body.items : body.ids.map((id) => ({ id, patch: body.patch }))
      setBoard((b) => {
        if (!b) return b
        const m = new Map(items.map((i) => [i.id, i.patch]))
        return { ...b, tasks: b.tasks.map((t) => (m.has(t.id) ? applyLocal(t, m.get(t.id)!, b) : t)) }
      })
      try {
        const r = await api<{ ok: string[]; errors: Record<string, string> }>("/api/work/tasks/bulk", { method: "POST", json: body })
        const errs = Object.values(r.errors)
        if (errs.length) flash(`${r.ok.length}건 변경, ${errs.length}건 실패: ${Array.from(new Set(errs)).join(" / ")}`, true)
        else if (label) flash(`${r.ok.length}건 ${label}`)
        if (errs.length) refresh()
        else refreshSoon()
      } catch (e) {
        flash((e as Error).message, true)
        refresh()
      }
    },
    [applyLocal, flash, refresh, refreshSoon]
  )

  // ── 필터·정렬 ──
  const visible = useMemo(() => {
    if (!board) return []
    const q = search.trim().toLowerCase()
    const wk = weekRange(today)
    const f = filter
    return board.tasks.filter((t) => {
      const due = d10(t.dueOn)
      if (quick === "mine" && t.assigneeUserId !== me.id) return false
      if (quick === "late" && !(isOpen(t) && due && due < today)) return false
      if (quick === "week" && !(isOpen(t) && due && due >= wk.start && due <= wk.end)) return false
      if (quick === "review" && t.status !== "IN_REVIEW") return false
      if (q && !t.title.toLowerCase().includes(q) && !(t.clinic?.name ?? "사내").toLowerCase().includes(q) && !(t.assignee?.user.name ?? "").toLowerCase().includes(q)) return false
      if (f.assignees.length && !f.assignees.includes(t.assigneeUserId ?? "none")) return false
      if (f.groups.length && !f.groups.includes(t.groupId ?? "none")) return false
      if (f.statuses.length && !f.statuses.includes(t.status)) return false
      if (f.kinds.length && !f.kinds.includes(t.category)) return false
      if (f.review && !t.reviewRequired) return false
      if (f.request && !t.serviceRequestId) return false
      if (f.from && (!due || due < f.from)) return false
      if (f.to && (!due || due > f.to)) return false
      return true
    })
  }, [board, search, filter, quick, today, me.id])

  const sorted = useMemo(() => {
    const list = [...visible]
    const byManual = (a: Task, b: Task) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
    const byDue = (a: Task, b: Task) => (d10(a.dueOn) || "9999").localeCompare(d10(b.dueOn) || "9999")
    if (sort === "manual") list.sort(cross ? (a, b) => byDue(a, b) || byManual(a, b) : byManual)
    else if (sort === "due") list.sort((a, b) => byDue(a, b) || byManual(a, b))
    else if (sort === "priority") list.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1) || byDue(a, b))
    else list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return list
  }, [visible, sort, cross])

  const narrowed = quick !== "all" || !!search.trim() || filterCount(filter) > 0

  const sections = useMemo<Section[]>(() => {
    if (!board) return []
    if (cross) {
      const m = new Map<string, Task[]>()
      for (const t of sorted) m.set(t.clinicId ?? "internal", [...(m.get(t.clinicId ?? "internal") ?? []), t])
      const keys = Array.from(m.keys()).sort((a, b) => (a === "internal" ? -1 : b === "internal" ? 1 : (m.get(a)![0].clinic?.name ?? "").localeCompare(m.get(b)![0].clinic?.name ?? "")))
      return keys.map((k) => ({ key: `c:${k}`, title: k === "internal" ? "THINKLAB 사내" : m.get(k)![0].clinic?.name ?? "치과", group: null, clinicId: k === "internal" ? null : k, tasks: m.get(k)! }))
    }
    const clinicId = scope === "internal" ? null : scope
    const ids = new Set(board.groups.map((g) => g.id))
    const list: Section[] = board.groups
      .filter((g) => !filter.groups.length || filter.groups.includes(g.id))
      .map((g) => ({ key: g.id, title: g.name, group: g, clinicId, tasks: sorted.filter((t) => t.groupId === g.id) }))
    const loose = sorted.filter((t) => !t.groupId || !ids.has(t.groupId))
    if (loose.length || (!board.groups.length && !narrowed)) list.push({ key: "none", title: "그룹 없음", group: null, clinicId, tasks: loose })
    return narrowed ? list.filter((s) => s.tasks.length) : list
  }, [board, sorted, cross, scope, filter.groups, narrowed])

  const flatIds = useMemo(() => sections.flatMap((s) => s.tasks.map((t) => t.id)), [sections])
  const taskById = useMemo(() => new Map((board?.tasks ?? []).map((t) => [t.id, t])), [board])
  const selectedTasks = useMemo(() => Array.from(selected).map((id) => taskById.get(id)).filter((t): t is Task => !!t), [selected, taskById])

  // ── 동작(행·헤더에서 호출, 참조 고정) ──
  const live = useRef({ board, sort, cross, flatIds, patchTask, bulk, refresh, flash, scope })
  live.current = { board, sort, cross, flatIds, patchTask, bulk, refresh, flash, scope }
  const act = useMemo<Act>(
    () => ({
      open: (id) => setOpenId(id),
      pop: (kind: PopType, taskId, el) => setPop({ kind, taskId, anchor: el.getBoundingClientRect() }),
      groupMenu: (groupId, el) => setPop({ kind: "group-menu", groupId, anchor: el.getBoundingClientRect() }),
      toggleSel: (id, shift) => {
        setSelected((cur) => {
          const next = new Set(cur)
          const ids = live.current.flatIds
          if (shift && lastSel.current && ids.includes(lastSel.current)) {
            const [a, b] = [ids.indexOf(lastSel.current), ids.indexOf(id)].sort((x, y) => x - y)
            for (const x of ids.slice(a, b + 1)) next.add(x)
          } else if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
        lastSel.current = id
      },
      toggleSection: (ids, on) =>
        setSelected((cur) => {
          const next = new Set(cur)
          for (const id of ids) (on ? next.add(id) : next.delete(id))
          return next
        }),
      add: async (section, title) => {
        try {
          await api("/api/work/tasks", { method: "POST", json: { clinicId: section.clinicId ?? "internal", groupId: section.group?.id ?? null, title, category: "OTHER", assigneeUserId: "__me__" } })
          live.current.refresh()
          return true
        } catch (e) {
          live.current.flash((e as Error).message, true)
          live.current.refresh()
          return false
        }
      },
      dropOnRow: (dragId, targetId, after) => {
        const b = live.current.board
        if (!b) return
        const drag = b.tasks.find((t) => t.id === dragId)
        const target = b.tasks.find((t) => t.id === targetId)
        if (!drag || !target || drag.clinicId !== target.clinicId) return
        const gid = target.groupId ?? null
        const list = b.tasks
          .filter((t) => t.id !== dragId && t.clinicId === target.clinicId && (t.groupId ?? null) === gid)
          .sort((x, y) => x.sortOrder - y.sortOrder || x.createdAt.localeCompare(y.createdAt))
        const at = list.findIndex((t) => t.id === targetId) + (after ? 1 : 0)
        list.splice(at, 0, drag)
        const items = list
          .map((t, k) => ({ t, k: k + 1 }))
          .filter(({ t, k }) => t.sortOrder !== k || (t.id === dragId && (drag.groupId ?? null) !== gid))
          .map(({ t, k }) => ({ id: t.id, patch: t.id === dragId && (drag.groupId ?? null) !== gid ? { groupId: gid, sortOrder: k } : { sortOrder: k } }))
        if (items.length) live.current.bulk({ items })
      },
      dropOnGroup: (dragId, section) => {
        const b = live.current.board
        if (!b) return
        const gid = section.group?.id ?? null
        const max = b.tasks.filter((t) => (t.groupId ?? null) === gid && t.clinicId === section.clinicId).reduce((m, t) => Math.max(m, t.sortOrder), 0)
        live.current.patchTask(dragId, { groupId: gid, sortOrder: max + 1 })
      },
      renameGroup: async (groupId, name) => {
        setRenaming(null)
        if (!name) return
        try {
          await api(`/api/work/task-groups/${groupId}`, { method: "PATCH", json: { name } })
        } catch (e) {
          live.current.flash((e as Error).message, true)
        }
        live.current.refresh()
      },
    }),
    []
  )
  const closePop = useCallback(() => setPop(null), [])

  const groupCall = async (fn: () => Promise<unknown>) => {
    setPop(null)
    try {
      await fn()
    } catch (e) {
      flash((e as Error).message, true)
    }
    refresh()
  }

  const duplicate = async (t: Task) => {
    setPop(null)
    try {
      const copy = await api<{ id: string }>("/api/work/tasks", {
        method: "POST",
        json: { clinicId: t.clinicId ?? "internal", groupId: t.groupId, title: `${t.title} (복사)`.slice(0, 200), category: t.category, priority: t.priority, dueOn: d10(t.dueOn) || null, assigneeUserId: t.assigneeUserId ?? undefined },
      })
      if (t._count.checklist > 0) {
        const { items } = await api<{ items: { title: string }[] }>(`/api/work/tasks/${t.id}/checklist`)
        for (const it of items) await api(`/api/work/tasks/${copy.id}/checklist`, { method: "POST", json: { title: it.title } })
      }
      flash("복제했습니다")
    } catch (e) {
      flash((e as Error).message, true)
    }
    refresh()
  }

  const applySaved = (v: SavedView) => {
    setQuick(v.quick)
    setFilter({ ...EMPTY, ...v.filter })
    setSort(v.sort)
    setView(v.view)
    setSearch(v.search ?? "")
    setPop(null)
  }
  const saveView = (name: string) => {
    const list = [...saved.filter((s) => s.name !== name), { name, quick, filter, sort, view, search }]
    setSaved(list)
    writeLS(VIEWS_KEY, list)
    flash(`'${name}' 보기를 저장했습니다`)
  }
  const removeView = (name: string) => {
    const list = saved.filter((s) => s.name !== name)
    setSaved(list)
    writeLS(VIEWS_KEY, list)
  }

  const cat = cats.find((c) => c.id === scope)
  const title = cross ? CROSS_NAME[scope] : cat?.name ?? (scope === "internal" ? "THINKLAB 사내" : "업무")
  const fc = filterCount(filter)
  const popTask = pop?.taskId ? taskById.get(pop.taskId) : undefined
  const anchorOf = (e: React.MouseEvent<HTMLElement>) => e.currentTarget.getBoundingClientRect()
  const bulkClinics = Array.from(new Set(selectedTasks.map((t) => t.clinicId)))
  const bulkSameClinic = bulkClinics.length === 1

  return (
    <div className="flex gap-4 min-h-[calc(100vh-100px)]">
      <CategoryPanel
        cats={cats}
        quick={quickCounts}
        scope={scope}
        onPick={(id) => {
          setScope(id)
          if (isCross(id)) setQuick("all")
        }}
        collapsed={collapsed}
        onCollapse={setCollapsed}
        pinned={pinned}
        onPin={(id) => setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
      />

      <div className="flex-1 min-w-0 space-y-3 pb-20">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[20px] font-bold truncate">{title}</h1>
          {board && (
            <span className="text-[13px] text-[#8a8a84] tabular-nums">
              {visible.length === board.tasks.length ? `${board.tasks.length}건` : `${visible.length} / ${board.tasks.length}건`}
            </span>
          )}
        </div>

        {/* 도구 모음 한 줄 */}
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="빠른 보기" className="flex h-8 rounded border border-[#d1d1cc] bg-white overflow-hidden text-[13px]">
            {QUICK_TABS.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={quick === k} onClick={() => setQuick(k)} className={`px-2.5 border-r last:border-r-0 border-[#ecece9] ${quick === k ? "bg-[#191f28] text-white font-medium" : "text-[#333] hover:bg-[#f2f2ef]"}`}>
                {l}
              </button>
            ))}
          </div>
          <label className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[#8a8a84]" aria-hidden="true" />
            <input aria-label="업무 검색" className="h-8 w-[180px] pl-7 pr-2 rounded border border-[#d1d1cc] bg-white text-[13px]" placeholder="업무·치과·담당 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <ToolBtn active={fc > 0} onClick={(e) => setPop({ kind: "filter", anchor: anchorOf(e) })} label="필터">
            <FilterIcon className="w-3.5 h-3.5" aria-hidden="true" />
            필터{fc > 0 && <span className="tabular-nums">{fc}</span>}
          </ToolBtn>
          <ToolBtn active={sort !== "manual"} onClick={(e) => setPop({ kind: "sort", anchor: anchorOf(e) })} label="정렬">
            <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
            {SORTS.find((s) => s[0] === sort)?.[1]}
          </ToolBtn>
          <ToolBtn active={false} onClick={(e) => setPop({ kind: "views", anchor: anchorOf(e) })} label="저장된 보기">
            <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
            보기
          </ToolBtn>
          {(fc > 0 || quick !== "all" || search) && (
            <button
              className="h-8 px-2 text-[12px] text-[#6f6f6a] hover:text-[#0a0a0a]"
              onClick={() => {
                setFilter(EMPTY)
                setQuick("all")
                setSearch("")
              }}
            >
              초기화
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div role="tablist" aria-label="보기 전환" className="flex h-8 rounded border border-[#d1d1cc] bg-white overflow-hidden">
              {(
                [
                  ["table", "표", Table2],
                  ["kanban", "칸반", Columns3],
                  ["calendar", "달력", CalendarDays],
                ] as const
              ).map(([k, l, I]) => (
                <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`px-2.5 flex items-center gap-1 text-[13px] border-r last:border-r-0 border-[#ecece9] ${view === k ? "bg-[#e8f0ff] text-[#0062ff] font-medium" : "text-[#333] hover:bg-[#f2f2ef]"}`}>
                  <I className="w-3.5 h-3.5" aria-hidden="true" />
                  {l}
                </button>
              ))}
            </div>
            {!cross && (
              <button className="h-8 px-3 rounded text-[13px] font-medium bg-[#191f28] text-white inline-flex items-center gap-1" onClick={(e) => setPop({ kind: "add-group", anchor: anchorOf(e) })}>
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                그룹 추가
              </button>
            )}
          </div>
        </div>

        {!board ? (
          <p className="text-[13px] text-[#6f6f6a]">불러오는 중…</p>
        ) : view === "table" ? (
          <TableView
            sections={sections}
            today={today}
            selected={selected}
            closed={closed}
            onToggleClosed={(k) => setClosed((c) => ({ ...c, [k]: !c[k] }))}
            act={act}
            canReorder={sort === "manual" && !cross}
            canDropToGroup={!cross}
            renaming={renaming}
            cross={cross}
            addRefs={addRefs}
          />
        ) : view === "kanban" ? (
          <KanbanView tasks={sorted} today={today} onOpen={setOpenId} onStatus={(id, status) => patchTask(id, { status })} />
        ) : (
          <CalendarView tasks={sorted} today={today} onOpen={setOpenId} onDue={(id, d) => patchTask(id, { dueOn: d })} />
        )}
      </div>

      {/* 일괄 작업 바 */}
      {selected.size > 0 && (
        <div role="toolbar" aria-label="일괄 작업" className="fixed z-40 bottom-5 left-1/2 -translate-x-1/2 h-11 px-2 flex items-center gap-1 bg-[#191f28] text-white rounded shadow-[0_8px_28px_rgba(0,0,0,0.25)] text-[13px]">
          <span className="px-2 font-semibold tabular-nums">{selected.size}건 선택</span>
          <span className="w-px h-5 bg-white/20" aria-hidden="true" />
          {(
            [
              ["bulk-assignee", "담당"],
              ["bulk-status", "상태"],
              ["bulk-priority", "우선순위"],
              ["bulk-due", "마감"],
              ["bulk-group", "그룹 이동"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              className="h-8 px-2.5 rounded hover:bg-white/10 disabled:opacity-40"
              disabled={k === "bulk-group" && !bulkSameClinic}
              title={k === "bulk-group" && !bulkSameClinic ? "같은 치과 업무끼리만 그룹을 옮길 수 있습니다" : undefined}
              onClick={(e) => setPop({ kind: k, anchor: anchorOf(e) })}
            >
              {l}
            </button>
          ))}
          <span className="w-px h-5 bg-white/20" aria-hidden="true" />
          <button className="h-8 px-2.5 rounded hover:bg-white/10 inline-flex items-center gap-1" onClick={() => setSelected(new Set())}>
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            선택 해제
          </button>
        </div>
      )}

      {toast && (
        <div role="status" className={`fixed z-[70] ${selected.size ? "bottom-20" : "bottom-5"} left-1/2 -translate-x-1/2 max-w-[560px] px-4 py-2.5 rounded text-[13px] shadow-[0_8px_28px_rgba(0,0,0,0.2)] ${toast.bad ? "bg-[#d92d20] text-white" : "bg-[#191f28] text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* 팝오버(하나만) */}
      {pop && board && (
        <PopContent
          pop={pop}
          close={closePop}
          board={board}
          task={popTask}
          selectedTasks={selectedTasks}
          me={me}
          sort={sort}
          setSort={setSort}
          filter={filter}
          setFilter={setFilter}
          showDone={showDone}
          setShowDone={setShowDone}
          cross={cross}
          saved={saved}
          applySaved={applySaved}
          saveView={saveView}
          removeView={removeView}
          patchTask={patchTask}
          bulk={bulk}
          duplicate={duplicate}
          sections={sections}
          onGroup={{
            rename: (id) => {
              setPop(null)
              setRenaming(id)
            },
            move: (id, move) => groupCall(() => api(`/api/work/task-groups/${id}`, { method: "PATCH", json: { move } })),
            remove: (id) => {
              const g = board.groups.find((x) => x.id === id)
              const n = board.tasks.filter((t) => t.groupId === id).length
              if (g && window.confirm(`'${g.name}' 그룹을 지웁니다. 안의 업무 ${n}건은 지우지 않고 '그룹 없음'으로 옮깁니다.`))
                groupCall(() => api(`/api/work/task-groups/${id}`, { method: "DELETE" }))
              else setPop(null)
            },
            create: (name) => groupCall(() => api("/api/work/task-groups", { method: "POST", json: { scope, name } })),
          }}
          clearSel={() => setSelected(new Set())}
        />
      )}

      {openId && <TaskDrawer id={openId} me={me} onClose={() => setOpenId(null)} onChanged={refreshSoon} />}
    </div>
  )
}

function ToolBtn({ children, onClick, active, label }: { children: React.ReactNode; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; active: boolean; label: string }) {
  return (
    <button aria-label={label} aria-haspopup="dialog" onClick={onClick} className={`h-8 px-2.5 rounded border text-[13px] inline-flex items-center gap-1 ${active ? "border-[#0062ff] text-[#0062ff] bg-[#f0f5ff]" : "border-[#d1d1cc] bg-white text-[#333] hover:bg-[#f2f2ef]"}`}>
      {children}
    </button>
  )
}

function PopContent(p: {
  pop: Pop
  close: () => void
  board: Board
  task: Task | undefined
  selectedTasks: Task[]
  me: { id: string; name: string }
  sort: Sort
  setSort: (s: Sort) => void
  filter: Filter
  setFilter: (f: Filter) => void
  showDone: boolean
  setShowDone: (v: boolean) => void
  cross: boolean
  saved: SavedView[]
  applySaved: (v: SavedView) => void
  saveView: (name: string) => void
  removeView: (name: string) => void
  patchTask: (id: string, patch: Record<string, unknown>) => void
  bulk: (body: { ids: string[]; patch: Record<string, unknown> }, label?: string) => void
  duplicate: (t: Task) => void
  sections: Section[]
  onGroup: { rename: (id: string) => void; move: (id: string, m: -1 | 1) => void; remove: (id: string) => void; create: (name: string) => void }
  clearSel: () => void
}) {
  const { pop, close, board, task: t } = p
  const ids = p.selectedTasks.map((x) => x.id)
  const one = (patch: Record<string, unknown>) => {
    if (t) p.patchTask(t.id, patch)
    close()
  }
  const many = (patch: Record<string, unknown>, label: string) => {
    p.bulk({ ids, patch }, label)
    close()
  }
  const L = (label: string, width: number, children: React.ReactNode) => (
    <Popover anchor={pop.anchor} onClose={close} width={width} label={label}>
      {children}
    </Popover>
  )

  switch (pop.kind) {
    case "assignee":
    case "bulk-assignee": {
      const clinics = pop.kind === "assignee" ? [t?.clinicId ?? null] : Array.from(new Set(p.selectedTasks.map((x) => x.clinicId)))
      const people = board.assignable.filter((a) => clinics.every((c) => canAssign(a, c)))
      const cur = pop.kind === "assignee" ? t?.assigneeUserId ?? null : undefined
      const pick = (v: string | null) => (pop.kind === "assignee" ? one({ assigneeUserId: v }) : many({ assigneeUserId: v }, "담당 변경"))
      return L("담당 선택", 220, <PeopleList people={people} cur={cur} meId={p.me.id} onPick={pick} />)
    }
    case "status":
    case "bulk-status":
      return L(
        "상태 선택",
        168,
        STATUS.map((s) => (
          <MenuItem key={s.key} active={t?.status === s.key && pop.kind === "status"} onClick={() => (pop.kind === "status" ? one({ status: s.key }) : many({ status: s.key }, "상태 변경"))}>
            <StatusDot s={s.key} />
            <span style={{ color: s.text }}>{s.label}</span>
            {t?.status === s.key && pop.kind === "status" && <Check className="w-3.5 h-3.5 ml-auto" aria-hidden="true" />}
          </MenuItem>
        ))
      )
    case "priority":
    case "bulk-priority":
      return L(
        "우선순위 선택",
        148,
        PRIORITY.map((x) => (
          <MenuItem key={x.key} active={t?.priority === x.key && pop.kind === "priority"} onClick={() => (pop.kind === "priority" ? one({ priority: x.key }) : many({ priority: x.key }, "우선순위 변경"))}>
            <PriorityFlag p={x.key} />
            {x.label}
          </MenuItem>
        ))
      )
    case "due":
    case "bulk-due":
      return L("마감 선택", 248, <DatePick value={pop.kind === "due" ? d10(t?.dueOn ?? null) : ""} onPick={(v) => (pop.kind === "due" ? one({ dueOn: v }) : many({ dueOn: v }, "마감 변경"))} />)
    case "bulk-group": {
      const clinic = p.selectedTasks[0]?.clinicId ?? null
      const groups = board.groups.filter((g) => g.clinicId === clinic)
      return L(
        "그룹 이동",
        220,
        <>
          {groups.map((g) => (
            <MenuItem key={g.id} onClick={() => many({ groupId: g.id }, "그룹 이동")}>
              <FolderInput className="w-3.5 h-3.5 text-[#8a8a84]" aria-hidden="true" />
              <span className="truncate">{g.name}</span>
            </MenuItem>
          ))}
          <MenuItem onClick={() => many({ groupId: null }, "그룹 이동")}>그룹 없음</MenuItem>
        </>
      )
    }
    case "task-menu": {
      if (!t) return null
      const groups = board.groups.filter((g) => g.clinicId === t.clinicId && g.id !== t.groupId)
      return L(
        "업무 메뉴",
        220,
        <>
          <p className="px-3 pt-1 pb-0.5 text-[11px] text-[#8a8a84]">그룹 이동</p>
          {groups.map((g) => (
            <MenuItem key={g.id} onClick={() => one({ groupId: g.id })}>
              <FolderInput className="w-3.5 h-3.5 text-[#8a8a84]" aria-hidden="true" />
              <span className="truncate">{g.name}</span>
            </MenuItem>
          ))}
          {t.groupId && <MenuItem onClick={() => one({ groupId: null })}>그룹 없음</MenuItem>}
          {!groups.length && !t.groupId && <p className="px-3 pb-1 text-[12px] text-[#b0b0aa]">옮길 그룹이 없습니다</p>}
          <div className="my-1 border-t border-[#ecece9]" />
          <MenuItem onClick={() => p.duplicate(t)}>복제</MenuItem>
          {t.status === "CANCELLED" ? (
            <MenuItem onClick={() => one({ status: "TODO" })}>취소 되돌리기</MenuItem>
          ) : (
            <MenuItem
              danger
              onClick={() => {
                if (window.confirm(`'${t.title}' 업무를 취소합니다. 기록은 남고 목록에서 '취소'로 표시됩니다.`)) one({ status: "CANCELLED" })
                else close()
              }}
            >
              업무 취소
            </MenuItem>
          )}
        </>
      )
    }
    case "group-menu": {
      const gid = pop.groupId!
      const order = board.groups.map((g) => g.id)
      const i = order.indexOf(gid)
      return L(
        "그룹 메뉴",
        168,
        <>
          <MenuItem onClick={() => p.onGroup.rename(gid)}>이름 바꾸기</MenuItem>
          <MenuItem disabled={i <= 0} onClick={() => p.onGroup.move(gid, -1)}>
            위로
          </MenuItem>
          <MenuItem disabled={i < 0 || i >= order.length - 1} onClick={() => p.onGroup.move(gid, 1)}>
            아래로
          </MenuItem>
          <div className="my-1 border-t border-[#ecece9]" />
          <MenuItem danger onClick={() => p.onGroup.remove(gid)}>
            그룹 삭제
          </MenuItem>
        </>
      )
    }
    case "add-group":
      return L("그룹 추가", 280, <NameForm placeholder="그룹 이름 (예: 11월 블로그)" button="만들기" onSubmit={(v) => p.onGroup.create(v)} />)
    case "sort":
      return L(
        "정렬",
        168,
        SORTS.map(([k, l]) => (
          <MenuItem
            key={k}
            active={p.sort === k}
            onClick={() => {
              p.setSort(k)
              close()
            }}
          >
            {l}
            {p.sort === k && <Check className="w-3.5 h-3.5 ml-auto" aria-hidden="true" />}
          </MenuItem>
        ))
      )
    case "views":
      return L(
        "저장된 보기",
        260,
        <>
          {p.saved.length === 0 && <p className="px-3 py-1.5 text-[12px] text-[#8a8a84]">저장된 보기가 없습니다. 지금 필터·정렬·보기를 이름 붙여 저장하세요.</p>}
          {p.saved.map((v) => (
            <div key={v.name} className="flex items-center pr-1">
              <MenuItem onClick={() => p.applySaved(v)}>
                <Bookmark className="w-3.5 h-3.5 text-[#8a8a84]" aria-hidden="true" />
                <span className="truncate">{v.name}</span>
              </MenuItem>
              <button className="w-6 h-6 shrink-0 flex items-center justify-center rounded text-[#8a8a84] hover:bg-[#ecece9] hover:text-[#d92d20]" aria-label={`${v.name} 보기 삭제`} onClick={() => p.removeView(v.name)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="my-1 border-t border-[#ecece9]" />
          <NameForm placeholder="지금 보기 이름" button="저장" onSubmit={(v) => p.saveView(v)} />
        </>
      )
    case "filter":
      return L("필터", 320, <FilterPanel {...p} />)
  }
  return null
}

function PeopleList({ people, cur, meId, onPick }: { people: { id: string; name: string }[]; cur: string | null | undefined; meId: string; onPick: (v: string | null) => void }) {
  const [q, setQ] = useState("")
  const list = people.filter((x) => !q || x.name.includes(q)).sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : 0))
  return (
    <>
      <div className="px-2 pb-1">
        <input aria-label="이름 검색" className="w-full h-7 px-2 rounded border border-[#d1d1cc] text-[13px]" placeholder="이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <MenuItem active={cur === null} onClick={() => onPick(null)}>
        <Avatar name={null} size={20} />
        미배정
      </MenuItem>
      {list.map((a) => (
        <MenuItem key={a.id} active={cur === a.id} onClick={() => onPick(a.id)}>
          <Avatar name={a.name} size={20} />
          <span className="truncate">{a.name}</span>
          {a.id === meId && <span className="text-[11px] text-[#8a8a84]">나</span>}
          {cur === a.id && <Check className="w-3.5 h-3.5 ml-auto" aria-hidden="true" />}
        </MenuItem>
      ))}
      {!list.length && <p className="px-3 py-1 text-[12px] text-[#8a8a84]">배정할 수 있는 직원이 없습니다</p>}
    </>
  )
}

function NameForm({ placeholder, button, onSubmit }: { placeholder: string; button: string; onSubmit: (v: string) => void }) {
  const [v, setV] = useState("")
  return (
    <form
      className="flex gap-1.5 px-2 py-1"
      onSubmit={(e) => {
        e.preventDefault()
        if (v.trim()) onSubmit(v.trim())
      }}
    >
      <input aria-label={placeholder} className="flex-1 min-w-0 h-8 px-2 rounded border border-[#d1d1cc] text-[13px]" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} />
      <button className="h-8 px-2.5 rounded bg-[#191f28] text-white text-[13px] disabled:opacity-40" disabled={!v.trim()}>
        {button}
      </button>
    </form>
  )
}

function FilterPanel({ filter, setFilter, board, cross, showDone, setShowDone, me }: { filter: Filter; setFilter: (f: Filter) => void; board: Board; cross: boolean; showDone: boolean; setShowDone: (v: boolean) => void; me: { id: string } }) {
  const tog = (k: "assignees" | "groups" | "statuses" | "kinds", v: string) => setFilter({ ...filter, [k]: filter[k].includes(v) ? filter[k].filter((x) => x !== v) : [...filter[k], v] })
  const box = "w-3.5 h-3.5 accent-[#0062ff]"
  const row = "flex items-center gap-1.5 h-7 px-1 rounded hover:bg-[#f7f7f5] cursor-pointer"
  const head = "px-1 pt-2 pb-0.5 text-[11px] font-semibold text-[#8a8a84]"
  // 담당 후보: 이 보드에 나온 사람 + 배정 가능한 사람
  const people = new Map<string, string>()
  for (const a of board.assignable) people.set(a.id, a.name)
  for (const t of board.tasks) if (t.assigneeUserId && t.assignee) people.set(t.assigneeUserId, t.assignee.user.name)
  const plist = Array.from(people.entries()).sort((a, b) => (a[0] === me.id ? -1 : b[0] === me.id ? 1 : a[1].localeCompare(b[1])))
  return (
    <div className="px-2 pb-2">
      <p className={head}>담당</p>
      <div className="max-h-[132px] overflow-y-auto">
        <label className={row}>
          <input type="checkbox" className={box} checked={filter.assignees.includes("none")} onChange={() => tog("assignees", "none")} />
          미배정
        </label>
        {plist.map(([id, name]) => (
          <label key={id} className={row}>
            <input type="checkbox" className={box} checked={filter.assignees.includes(id)} onChange={() => tog("assignees", id)} />
            {name}
            {id === me.id && <span className="text-[11px] text-[#8a8a84]">나</span>}
          </label>
        ))}
      </div>
      {!cross && board.groups.length > 0 && (
        <>
          <p className={head}>그룹</p>
          <div className="max-h-[112px] overflow-y-auto">
            {board.groups.map((g) => (
              <label key={g.id} className={row}>
                <input type="checkbox" className={box} checked={filter.groups.includes(g.id)} onChange={() => tog("groups", g.id)} />
                <span className="truncate">{g.name}</span>
              </label>
            ))}
            <label className={row}>
              <input type="checkbox" className={box} checked={filter.groups.includes("none")} onChange={() => tog("groups", "none")} />
              그룹 없음
            </label>
          </div>
        </>
      )}
      <p className={head}>상태</p>
      <div className="grid grid-cols-2">
        {STATUS.map((s) => (
          <label key={s.key} className={row}>
            <input type="checkbox" className={box} checked={filter.statuses.includes(s.key)} onChange={() => tog("statuses", s.key)} />
            {s.label}
          </label>
        ))}
      </div>
      <p className={head}>종류</p>
      <div className="grid grid-cols-2">
        {KIND.map((k) => (
          <label key={k.key} className={row}>
            <input type="checkbox" className={box} checked={filter.kinds.includes(k.key)} onChange={() => tog("kinds", k.key)} />
            {k.label}
          </label>
        ))}
      </div>
      <p className={head}>마감 기간</p>
      <div className="flex items-center gap-1 px-1">
        <input type="date" aria-label="마감 시작" className="flex-1 min-w-0 h-7 px-1 rounded border border-[#d1d1cc] text-[12px]" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
        <span className="text-[#8a8a84]">~</span>
        <input type="date" aria-label="마감 끝" className="flex-1 min-w-0 h-7 px-1 rounded border border-[#d1d1cc] text-[12px]" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
      </div>
      <p className={head}>기타</p>
      <label className={row}>
        <input type="checkbox" className={box} checked={filter.review} onChange={(e) => setFilter({ ...filter, review: e.target.checked })} />
        검수 필요
      </label>
      <label className={row}>
        <input type="checkbox" className={box} checked={filter.request} onChange={(e) => setFilter({ ...filter, request: e.target.checked })} />
        원장 요청
      </label>
      <label className={row}>
        <input type="checkbox" className={box} checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
        지난 완료 업무도 불러오기
      </label>
      <div className="flex justify-end pt-1">
        <button className="h-7 px-2 text-[12px] text-[#6f6f6a] hover:text-[#0a0a0a]" onClick={() => setFilter(EMPTY)}>
          필터 지우기
        </button>
      </div>
    </div>
  )
}
