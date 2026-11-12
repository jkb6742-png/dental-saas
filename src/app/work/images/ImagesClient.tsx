"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Download, ExternalLink, Folder, FolderOpen, FolderPlus, ImageIcon, MoreHorizontal, Pencil, Search, Trash2, Upload, X } from "lucide-react"
import { api, btn, btnLine, field } from "../ui"

type Clinic = { id: string; name: string }
type Img = {
  id: string
  title: string
  name: string
  bytes: number
  createdAt: string
  visibility: string
  uploadedBy: string
  onNas: boolean
  taskId: string | null
  folderId: string | null
  taskTitle: string | null
  groupId: string | null
  groupName: string | null
}
type TaskOpt = { id: string; title: string; groupId: string | null }
type GroupOpt = { id: string; name: string }
type FolderT = { id: string; parentId: string | null; name: string; path: string }

const TINTS = [
  ["#e8f0ff", "#0045b5"],
  ["#e7f6ec", "#1a7f37"],
  ["#fff1e6", "#b54708"],
  ["#f1ecff", "#5b3fd1"],
  ["#e6f6f8", "#0e7490"],
  ["#fdebec", "#b42318"],
]
const NO_GROUP = "__nogroup"
const NO_TASK = "__notask"
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`)
const ymd = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10)
const src = (id: string) => `/api/work/files/${id}/download?inline=1`

// 폴더 키: 그룹/업무 단위. 업무 없는 이미지는 '업무 없음', 그룹 없는 업무는 '그룹 없음' 아래.
type Sel = { kind: "all" } | { kind: "group"; id: string } | { kind: "task"; id: string } | { kind: "notask" } | { kind: "folder"; id: string }

export default function ImagesClient({ clinics, initialScope }: { clinics: Clinic[]; initialScope: string }) {
  const [scope, setScope] = useState(initialScope)
  const [images, setImages] = useState<Img[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [sel, setSel] = useState<Sel>({ kind: "all" })
  const [q, setQ] = useState("")
  const [view, setView] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [folders, setFolders] = useState<FolderT[]>([])
  const [menu, setMenu] = useState<string | null>(null) // 이미지 카드 메뉴
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    try {
      const [j, f] = await Promise.all([
        api<{ images: Img[]; counts: Record<string, number> }>(`/api/work/images?scope=${scope}`),
        api<{ folders: FolderT[] }>(`/api/work/image-folders?scope=${scope}`),
      ])
      setImages(j.images)
      setCounts(j.counts)
      setFolders(f.folders)
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [scope])
  useEffect(() => {
    setImages(null)
    setSel({ kind: "all" })
    load()
    try {
      window.history.replaceState(null, "", `/work/images?scope=${scope}`)
    } catch {}
  }, [load, scope])

  // 폴더 트리: 그룹 → 업무
  const tree = useMemo(() => {
    const groups = new Map<string, { name: string; tasks: Map<string, { title: string; n: number }>; n: number }>()
    let notask = 0
    for (const im of images ?? []) {
      if (im.folderId) continue
      if (!im.taskId) {
        notask++
        continue
      }
      const gk = im.groupId ?? NO_GROUP
      const g = groups.get(gk) ?? { name: im.groupName ?? "그룹 없음", tasks: new Map(), n: 0 }
      g.n++
      const t = g.tasks.get(im.taskId) ?? { title: im.taskTitle ?? "업무", n: 0 }
      t.n++
      g.tasks.set(im.taskId, t)
      groups.set(gk, g)
    }
    const list = [...groups.entries()].sort((a, b) => (a[0] === NO_GROUP ? 1 : b[0] === NO_GROUP ? -1 : a[1].name.localeCompare(b[1].name, "ko")))
    return { list, notask }
  }, [images])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (images ?? []).filter((im) => {
      if (sel.kind === "group" && (im.groupId ?? NO_GROUP) !== sel.id) return false
      if (sel.kind === "group" && !im.taskId) return false
      if (sel.kind === "task" && im.taskId !== sel.id) return false
      if (sel.kind === "notask" && (im.taskId || im.folderId)) return false
      if (sel.kind === "folder" && im.folderId !== sel.id) return false
      return !s || [im.name, im.title, im.taskTitle, im.groupName, im.uploadedBy].some((v) => v?.toLowerCase().includes(s))
    })
  }, [images, sel, q])

  // 키보드: 크게 보기에서 ← → Esc
  useEffect(() => {
    if (view === null) return
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setView(null)
      if (e.key === "ArrowRight") setView((v) => (v === null ? v : Math.min(shown.length - 1, v + 1)))
      if (e.key === "ArrowLeft") setView((v) => (v === null ? v : Math.max(0, v - 1)))
    }
    document.addEventListener("keydown", k)
    return () => document.removeEventListener("keydown", k)
  }, [view, shown.length])

  const cats = [{ id: "internal", name: "THINKLAB 사내" }, ...clinics]
  const current = cats.find((c) => c.id === scope)

  // 폴더 만들기·이름 바꾸기·삭제 — NAS 폴더에도 바로 반영
  const run = async (fn: () => Promise<unknown>) => {
    setErr("")
    try {
      await fn()
      await load()
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const newFolder = (parentId: string | null) => {
    const name = window.prompt(parentId ? "하위 폴더 이름" : "새 폴더 이름")
    if (name?.trim()) run(() => api("/api/work/image-folders", { method: "POST", json: { scope, parentId, name } }))
  }
  const renameF = (f: FolderT) => {
    const name = window.prompt("폴더 이름 바꾸기", f.name)
    if (name?.trim() && name !== f.name) run(() => api(`/api/work/image-folders/${f.id}`, { method: "PATCH", json: { name } }))
  }
  const deleteF = (f: FolderT) => {
    const n = (images ?? []).filter((im) => im.folderId === f.id).length
    if (!window.confirm(`'${f.name}' 폴더를 지웁니다.${n ? ` 안의 이미지 ${n}장은 지우지 않고 상위 폴더로 옮깁니다.` : ""} NAS 폴더도 함께 지워집니다.`)) return
    run(async () => {
      await api(`/api/work/image-folders/${f.id}`, { method: "DELETE" })
      if (sel.kind === "folder" && sel.id === f.id) setSel({ kind: "all" })
    })
  }
  const moveImg = (id: string, folderId: string | null) => run(() => api(`/api/work/images/${id}`, { method: "PATCH", json: { folderId } }))
  const deleteImg = (im: Img) => window.confirm(`'${im.name}' 이미지를 지웁니다. 30일 뒤 NAS 에서도 완전히 지워집니다.`) && run(() => api(`/api/work/files/${im.id}`, { method: "DELETE" }))
  const folderCount = (id: string) => (images ?? []).filter((im) => im.folderId === id).length
  const childrenOf = (pid: string | null) => folders.filter((f) => f.parentId === pid)
  const folderLabel =
    sel.kind === "all"
      ? "전체"
      : sel.kind === "notask"
        ? "업무 없음"
        : sel.kind === "folder"
          ? folders.find((f) => f.id === sel.id)?.name
        : sel.kind === "group"
          ? tree.list.find(([k]) => k === sel.id)?.[1].name
          : tree.list.flatMap(([, g]) => [...g.tasks.entries()]).find(([k]) => k === sel.id)?.[1].title

  return (
    <div className="flex gap-4 items-start">
      {/* 카테고리 */}
      <nav aria-label="이미지 카테고리" className="w-[232px] shrink-0 bg-white rounded-md border border-[#d1d1cc] overflow-hidden sticky top-3">
        <div className="h-11 px-4 flex items-center border-b border-[#d1d1cc]">
          <span className="text-[14px] font-bold">이미지 폴더함</span>
          <span className="ml-auto text-[11px] text-[#8a8a84]">장수</span>
        </div>
        {[
          { title: "사내", items: cats.slice(0, 1) },
          { title: `치과 ${clinics.length}곳`, items: cats.slice(1) },
        ].map((sec) => (
          <section key={sec.title} className="border-b border-[#d1d1cc] last:border-b-0">
            <h2 className="h-8 px-4 flex items-center text-[12px] font-semibold text-[#6f6f6a] bg-[#f7f7f5] border-b border-[#ecece9]">{sec.title}</h2>
            <ul className="py-1">
              {sec.items.map((c, i) => {
                const active = c.id === scope
                const [bg, fg] = c.id === "internal" ? ["#191f28", "#ffffff"] : TINTS[i % TINTS.length]
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setScope(c.id)}
                      aria-current={active ? "page" : undefined}
                      className={`w-full h-11 flex items-center gap-2.5 pl-4 pr-4 text-left text-[15px] ${active ? "bg-[#e8f0ff] text-[#0045b5] font-semibold shadow-[inset_3px_0_0_#0062ff]" : "text-[#222220] hover:bg-[#f5f5f2]"}`}
                    >
                      <span className="w-6 h-6 shrink-0 rounded flex items-center justify-center text-[12px] font-bold" style={{ background: bg, color: fg }} aria-hidden="true">
                        {c.id === "internal" ? "T" : c.name.slice(0, 1)}
                      </span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className={`text-[13px] tabular-nums ${counts[c.id] ? "text-[#3d3d3a] font-medium" : "text-[#c4c4be]"}`}>{counts[c.id] ?? 0}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </nav>

      {/* 폴더 트리 */}
      <aside aria-label="폴더" className="w-[240px] shrink-0 bg-white rounded-md border border-[#d1d1cc] overflow-hidden sticky top-3 max-h-[calc(100vh-24px)] overflow-y-auto">
        <div className="h-11 px-4 flex items-center border-b border-[#d1d1cc] text-[14px] font-bold truncate">{current?.name}</div>
        <ul className="py-1 text-[14px]">
          <FolderRow active={sel.kind === "all"} depth={0} label="전체" n={images?.length ?? 0} open onClick={() => setSel({ kind: "all" })} />
          {tree.list.map(([gk, g]) => {
            const gActive = sel.kind === "group" && sel.id === gk
            const inGroup = gActive || (sel.kind === "task" && g.tasks.has(sel.id))
            return (
              <li key={gk}>
                <ul>
                  <FolderRow active={gActive} depth={1} label={g.name} n={g.n} open={inGroup} onClick={() => setSel({ kind: "group", id: gk })} />
                  {inGroup &&
                    [...g.tasks.entries()].map(([tk, t]) => (
                      <FolderRow key={tk} active={sel.kind === "task" && sel.id === tk} depth={2} label={t.title} n={t.n} onClick={() => setSel({ kind: "task", id: tk })} />
                    ))}
                </ul>
              </li>
            )
          })}
          {tree.notask > 0 && <FolderRow active={sel.kind === "notask"} depth={1} label="업무 없음" n={tree.notask} onClick={() => setSel({ kind: "notask" })} />}
        </ul>
        <div className="border-t border-[#ecece9]">
          <div className="h-9 px-4 flex items-center bg-[#f7f7f5] border-b border-[#ecece9]">
            <span className="text-[12px] font-semibold text-[#6f6f6a]">내 폴더</span>
            <button className="ml-auto h-7 px-2 inline-flex items-center gap-1 rounded text-[12px] text-[#0062ff] hover:bg-[#e8f0ff]" onClick={() => newFolder(null)}>
              <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" /> 새 폴더
            </button>
          </div>
          {folders.length === 0 ? (
            <p className="px-4 py-3 text-[12px] text-[#8a8a84]">폴더를 만들면 NAS 에도 같은 폴더가 바로 생깁니다.</p>
          ) : (
            <ul className="py-1 text-[14px]">
              <FolderTree
                nodes={childrenOf(null)}
                depth={1}
                childrenOf={childrenOf}
                count={folderCount}
                selId={sel.kind === "folder" ? sel.id : null}
                onPick={(id) => setSel({ kind: "folder", id })}
                onAdd={newFolder}
                onRename={renameF}
                onDelete={deleteF}
              />
            </ul>
          )}
        </div>
        <p className="px-4 py-3 text-[12px] text-[#8a8a84] border-t border-[#ecece9]">NAS 공유\업무자료\{current?.id === "internal" ? "THINKLAB 사내" : current?.name}\그룹\업무 폴더와 같습니다.</p>
      </aside>

      {/* 이미지 */}
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[20px] font-bold">{folderLabel}</h1>
          <span className="text-[13px] text-[#8a8a84]">{shown.length}장</span>
          <div className="ml-4 relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a8a84]" aria-hidden="true" />
            <input aria-label="이미지 검색" className={`${field} w-[240px] pl-8`} placeholder="파일명·업무·올린 사람" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className={`${btn} ml-auto inline-flex items-center gap-1`} onClick={() => setUploading(true)}>
            <Upload className="w-4 h-4" aria-hidden="true" />
            이미지 올리기
          </button>
        </div>
        {err && (
          <p role="alert" className="text-[13px] text-[#d92d20]">
            {err}{" "}
            <button className="underline" onClick={() => setErr("")}>
              닫기
            </button>
          </p>
        )}
        {!images ? (
          <p className="text-[13px] text-[#8a8a84]">불러오는 중…</p>
        ) : !shown.length ? (
          <div className="bg-white rounded-md border border-[#d1d1cc] px-6 py-14 text-center">
            <ImageIcon className="w-8 h-8 mx-auto text-[#c4c4be]" aria-hidden="true" />
            <p className="mt-2 text-[14px] text-[#6f6f6a]">{q ? "검색 결과가 없습니다." : "이 폴더에 이미지가 없습니다."}</p>
            {!q && (
              <button className="mt-2 text-[14px] text-[#0062ff] hover:underline" onClick={() => setUploading(true)}>
                이미지 올리기
              </button>
            )}
          </div>
        ) : (
          <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
            {shown.map((im, i) => (
              <li key={im.id} className="bg-white rounded-md border border-[#d1d1cc] overflow-hidden group">
                <button className="block w-full aspect-square bg-[#f2f2ef] overflow-hidden" onClick={() => setView(i)} aria-label={`${im.name} 크게 보기`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src(im.id)} alt={im.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200" />
                </button>
                <div className="px-2.5 py-2 relative">
                  <button
                    className="absolute right-1.5 top-1.5 w-7 h-7 flex items-center justify-center rounded text-[#8a8a84] hover:bg-[#ecece9]"
                    aria-label={`${im.name} 메뉴`}
                    onClick={() => setMenu(menu === im.id ? null : im.id)}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {menu === im.id && (
                    <div className="absolute right-1.5 top-9 z-20 w-[200px] bg-white border border-[#d1d1cc] rounded shadow-[0_6px_18px_rgb(0_0_0/0.12)] py-1 text-[13px]" onMouseLeave={() => setMenu(null)}>
                      <div className="px-3 py-1 text-[11px] text-[#8a8a84]">폴더로 옮기기</div>
                      <button className="w-full text-left px-3 h-8 hover:bg-[#f2f2ef]" onClick={() => (setMenu(null), moveImg(im.id, null))}>
                        {im.taskId ? "업무 폴더로 되돌리기" : "치과 폴더(폴더 없음)"}
                      </button>
                      {folders.map((f) => (
                        <button key={f.id} disabled={f.id === im.folderId} className="w-full text-left px-3 h-8 hover:bg-[#f2f2ef] truncate disabled:text-[#b0b0aa]" onClick={() => (setMenu(null), moveImg(im.id, f.id))}>
                          {f.path.split("/").slice(1).join(" / ")}
                        </button>
                      ))}
                      <div className="my-1 border-t border-[#ecece9]" />
                      <button className="w-full text-left px-3 h-8 hover:bg-[#fdebec] text-[#d92d20] inline-flex items-center gap-1.5" onClick={() => (setMenu(null), deleteImg(im))}>
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> 삭제
                      </button>
                    </div>
                  )}
                  <div className="text-[13px] font-medium truncate pr-7" title={im.name}>
                    {im.name}
                  </div>
                  <div className="text-[12px] text-[#8a8a84] truncate">
                    {im.folderId ? folders.find((f) => f.id === im.folderId)?.name ?? "폴더" : im.taskTitle ?? "업무 없음"} · {ymd(im.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {view !== null && shown[view] && (
        <Lightbox
          im={shown[view]}
          index={view}
          total={shown.length}
          onPrev={() => setView(Math.max(0, view - 1))}
          onNext={() => setView(Math.min(shown.length - 1, view + 1))}
          onClose={() => setView(null)}
        />
      )}
      {uploading && (
        <UploadDialog
          scope={scope}
          folders={folders}
          preset={sel.kind === "task" ? sel.id : sel.kind === "folder" ? `f:${sel.id}` : null}
          onClose={() => setUploading(false)}
          onDone={() => {
            setUploading(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function FolderRow({ active, depth, label, n, open, onClick }: { active: boolean; depth: number; label: string; n: number; open?: boolean; onClick: () => void }) {
  const Icon = open || active ? FolderOpen : Folder
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full h-10 flex items-center gap-2 pr-4 text-left ${active ? "bg-[#e8f0ff] text-[#0045b5] font-semibold" : "text-[#222220] hover:bg-[#f5f5f2]"}`}
        style={{ paddingLeft: 16 + depth * 16 }}
      >
        <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[#0062ff]" : depth === 2 ? "text-[#8a8a84]" : "text-[#b54708]"}`} aria-hidden="true" />
        <span className="flex-1 truncate">{label}</span>
        <span className="text-[12px] tabular-nums text-[#8a8a84]">{n}</span>
      </button>
    </li>
  )
}

function Lightbox({ im, index, total, onPrev, onNext, onClose }: { im: Img; index: number; total: number; onPrev: () => void; onNext: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/85 flex flex-col" role="dialog" aria-modal="true" aria-label={im.name} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="h-14 shrink-0 flex items-center gap-3 px-4 text-white">
        <span className="text-[14px] font-medium truncate">{im.name}</span>
        <span className="text-[12px] text-white/60 truncate">
          {[im.groupName, im.taskTitle].filter(Boolean).join(" / ") || "업무 없음"} · {im.uploadedBy} · {ymd(im.createdAt)} · {kb(im.bytes)}
        </span>
        <span className="ml-auto text-[12px] text-white/60 tabular-nums">
          {index + 1} / {total}
        </span>
        {im.taskId && (
          <a href={`/work/tasks?open=${im.taskId}`} className="h-8 px-3 inline-flex items-center gap-1 rounded text-[13px] bg-white/10 hover:bg-white/20">
            업무 열기 <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        )}
        <a href={`/api/work/files/${im.id}/download`} className="h-8 px-3 inline-flex items-center gap-1 rounded text-[13px] bg-white/10 hover:bg-white/20">
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> 받기
        </a>
        <button className="w-9 h-9 flex items-center justify-center rounded hover:bg-white/15" aria-label="닫기" onClick={onClose}>
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center gap-2 px-2 pb-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <button className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-white hover:bg-white/15 disabled:opacity-20" aria-label="이전" disabled={index === 0} onClick={onPrev}>
          <ChevronLeft className="w-6 h-6" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src(im.id)} alt={im.title} className="max-w-full max-h-full object-contain rounded" />
        <button className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-white hover:bg-white/15 disabled:opacity-20" aria-label="다음" disabled={index === total - 1} onClick={onNext}>
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  )
}

// 이미지 올리기: 업무 폴더를 고르면 NAS 공유\업무자료\<치과>\<그룹>\<업무> 에 저장된다
function UploadDialog({ scope, folders, preset, onClose, onDone }: { scope: string; folders: FolderT[]; preset: string | null; onClose: () => void; onDone: () => void }) {
  const [groups, setGroups] = useState<GroupOpt[]>([])
  const [tasks, setTasks] = useState<TaskOpt[]>([])
  const [taskId, setTaskId] = useState(preset ?? "")
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [err, setErr] = useState("")
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api<{ groups: GroupOpt[]; tasks: TaskOpt[] }>(`/api/work/task-groups?scope=${scope}&done=1`)
      .then((j) => {
        setGroups(j.groups)
        setTasks(j.tasks)
      })
      .catch((e) => setErr(e.message))
  }, [scope])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose()
    document.addEventListener("keydown", k)
    return () => document.removeEventListener("keydown", k)
  }, [busy, onClose])

  const send = async () => {
    setBusy(true)
    setErr("")
    setDone(0)
    for (const f of files) {
      const fd = new FormData()
      fd.set("file", f)
      if (taskId.startsWith("f:")) {
        fd.set("imageFolderId", taskId.slice(2))
        if (scope !== "internal") fd.set("clinicId", scope)
      } else if (taskId) fd.set("taskId", taskId)
      else if (scope !== "internal") fd.set("clinicId", scope)
      fd.set("visibility", "INTERNAL")
      const r = await fetch("/api/work/files", { method: "POST", body: fd })
      if (!r.ok) {
        setErr(`${f.name}: ${(await r.json().catch(() => ({}))).error ?? "올리지 못했습니다"}`)
        setBusy(false)
        return
      }
      setDone((n) => n + 1)
    }
    setBusy(false)
    onDone()
  }

  const byGroup = [...groups.map((g) => ({ id: g.id, name: g.name })), { id: "", name: "그룹 없음" }]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="up-title" className="w-full max-w-[480px] bg-white rounded-md border border-[#d1d1cc] shadow-[0_12px_32px_rgb(0_0_0/0.18)]">
        <div className="h-12 px-4 flex items-center border-b border-[#d1d1cc]">
          <h2 id="up-title" className="text-[15px] font-bold">
            이미지 올리기
          </h2>
          <button className="ml-auto w-8 h-8 flex items-center justify-center rounded hover:bg-[#ecece9]" aria-label="닫기" disabled={busy} onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <label className="block">
            <span className="text-[13px] text-[#555555]">넣을 폴더</span>
            <select aria-label="업무 폴더" className={`${field} w-full mt-1 h-9`} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">{scope === "internal" ? "업무 없이(회사 공통)" : "업무 없음(치과 폴더)"}</option>
              {folders.length > 0 && (
                <optgroup label="내 폴더">
                  {folders.map((f) => (
                    <option key={f.id} value={`f:${f.id}`}>
                      {f.path.split("/").slice(1).join(" / ")}
                    </option>
                  ))}
                </optgroup>
              )}
              {byGroup.map((g) => {
                const list = tasks.filter((t) => (t.groupId ?? "") === g.id)
                return list.length ? (
                  <optgroup key={g.id || "none"} label={g.name}>
                    {list.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </optgroup>
                ) : null
              })}
            </select>
          </label>
          <div
            className="rounded border border-dashed border-[#b9b9b3] px-4 py-6 text-center cursor-pointer hover:bg-[#fafaf8]"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              setFiles([...files, ...[...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"))])
            }}
          >
            <Upload className="w-6 h-6 mx-auto text-[#8a8a84]" aria-hidden="true" />
            <p className="mt-1 text-[14px] text-[#555555]">이미지를 끌어다 놓거나 눌러서 고르세요</p>
            <p className="text-[12px] text-[#8a8a84]">여러 장 가능 · 같은 이름이 있으면 (2), (3)… 이 붙습니다</p>
            <input
              ref={input}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                setFiles([...files, ...[...(e.target.files ?? [])]])
                e.target.value = ""
              }}
            />
          </div>
          {files.length > 0 && (
            <ul className="max-h-[160px] overflow-y-auto text-[13px] divide-y divide-[#f2f2ef] border border-[#ecece9] rounded">
              {files.map((f, i) => (
                <li key={i} className="px-3 py-1.5 flex items-center gap-2">
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-[#8a8a84]">{kb(f.size)}</span>
                  {!busy && (
                    <button className="text-[#8a8a84] hover:text-[#d92d20]" aria-label={`${f.name} 빼기`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {err && <p className="text-[13px] text-[#d92d20]">{err}</p>}
        </div>
        <div className="px-4 py-3 border-t border-[#d1d1cc] flex items-center gap-2">
          {busy && (
            <span className="text-[13px] text-[#6f6f6a]">
              올리는 중 {done}/{files.length}
            </span>
          )}
          <button className={`${btnLine} ml-auto`} disabled={busy} onClick={onClose}>
            취소
          </button>
          <button className={btn} disabled={busy || !files.length} onClick={send}>
            {files.length ? `${files.length}장 올리기` : "올리기"}
          </button>
        </div>
      </div>
    </div>
  )
}

function FolderTree({
  nodes,
  depth,
  childrenOf,
  count,
  selId,
  onPick,
  onAdd,
  onRename,
  onDelete,
}: {
  nodes: FolderT[]
  depth: number
  childrenOf: (id: string | null) => FolderT[]
  count: (id: string) => number
  selId: string | null
  onPick: (id: string) => void
  onAdd: (parentId: string | null) => void
  onRename: (f: FolderT) => void
  onDelete: (f: FolderT) => void
}) {
  return (
    <>
      {nodes.map((f) => {
        const active = selId === f.id
        const kids = childrenOf(f.id)
        return (
          <li key={f.id}>
            <div className={`group/f flex items-center h-10 pr-1.5 ${active ? "bg-[#e8f0ff]" : "hover:bg-[#f5f5f2]"}`} style={{ paddingLeft: 16 + (depth - 1) * 16 }}>
              <button className={`flex-1 min-w-0 flex items-center gap-2 text-left ${active ? "text-[#0045b5] font-semibold" : "text-[#222220]"}`} onClick={() => onPick(f.id)}>
                {active ? <FolderOpen className="w-4 h-4 shrink-0 text-[#0062ff]" aria-hidden="true" /> : <Folder className="w-4 h-4 shrink-0 text-[#0e7490]" aria-hidden="true" />}
                <span className="truncate">{f.name}</span>
                <span className="ml-auto text-[12px] tabular-nums text-[#8a8a84]">{count(f.id)}</span>
              </button>
              <span className="flex opacity-0 group-hover/f:opacity-100 focus-within:opacity-100">
                <button className="w-6 h-6 flex items-center justify-center rounded text-[#6f6f6a] hover:bg-white" aria-label={`${f.name} 안에 폴더 만들기`} title="하위 폴더" onClick={() => onAdd(f.id)}>
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
                <button className="w-6 h-6 flex items-center justify-center rounded text-[#6f6f6a] hover:bg-white" aria-label={`${f.name} 이름 바꾸기`} title="이름 바꾸기" onClick={() => onRename(f)}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button className="w-6 h-6 flex items-center justify-center rounded text-[#6f6f6a] hover:bg-white hover:text-[#d92d20]" aria-label={`${f.name} 삭제`} title="삭제" onClick={() => onDelete(f)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
            {kids.length > 0 && (
              <ul>
                <FolderTree nodes={kids} depth={depth + 1} childrenOf={childrenOf} count={count} selId={selId} onPick={onPick} onAdd={onAdd} onRename={onRename} onDelete={onDelete} />
              </ul>
            )}
          </li>
        )
      })}
    </>
  )
}
