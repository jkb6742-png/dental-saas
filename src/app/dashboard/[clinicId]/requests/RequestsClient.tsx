"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Inbox, Plus, Image as ImageIcon, PenLine, Globe, FileBarChart, Megaphone, HelpCircle,
  X, Paperclip, Send, Calendar, Clock, CheckCircle2, ChevronRight, Download, Trash2, AlertCircle,
} from "lucide-react"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import {
  REQUEST_CATEGORIES, CATEGORY_MAP, STATUS_META, PRIORITY_META, OPEN_STATUSES, MAX_FILES,
  type RequestCategory, type RequestStatus, type RequestPriority, type DetailField,
} from "@/lib/requests/categories"
import type { SerializedRequest } from "@/lib/requests/serialize"

type Req = SerializedRequest

const CATEGORY_ICON: Record<RequestCategory, React.ReactNode> = {
  IMAGE: <ImageIcon className="w-5 h-5" />,
  CONTENT: <PenLine className="w-5 h-5" />,
  WEBSITE: <Globe className="w-5 h-5" />,
  REPORT: <FileBarChart className="w-5 h-5" />,
  ADS: <Megaphone className="w-5 h-5" />,
  OTHER: <HelpCircle className="w-5 h-5" />,
}

const CATEGORY_TONE: Record<RequestCategory, string> = {
  IMAGE: "bg-[#fff4e6] text-[#f59e0b]",
  CONTENT: "bg-[#ebf3fe] text-[#3182f6]",
  WEBSITE: "bg-[#e8f7f1] text-[#05c072]",
  REPORT: "bg-[#f3eefe] text-[#7c5cff]",
  ADS: "bg-[#fff0f1] text-[#f04452]",
  OTHER: "bg-[#f2f4f6] text-[#6b7684]",
}

function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "-"
  const d = new Date(iso)
  const base = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`
  if (!withTime) return base
  return `${base} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function fmtSize(n: number) {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}

function toDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function daysLeft(iso: string | null) {
  if (!iso) return null
  const due = new Date(iso)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

const inputCls = "w-full px-3.5 py-2.5 rounded-[10px] border border-[#e5e8eb] bg-white text-[14px] text-[#191f28] placeholder:text-[#b0b8c1] focus:outline-none focus:border-[#3182f6] focus:ring-2 focus:ring-[#3182f6]/15 transition"
const labelCls = "block text-[13px] font-semibold text-[#4e5968] mb-1.5"

type Props = {
  clinicId: string
  initialRequests: Req[]
  isMaster: boolean
  userId: string
}

export default function RequestsClient({ clinicId, initialRequests, isMaster, userId }: Props) {
  const [requests, setRequests] = useState<Req[]>(initialRequests)
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | RequestStatus>("OPEN")
  const [categoryFilter, setCategoryFilter] = useState<RequestCategory | "ALL">("ALL")
  const [createOpen, setCreateOpen] = useState(false)
  const [presetCategory, setPresetCategory] = useState<RequestCategory | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 알림에서 ?open=<id> 로 들어오면 해당 요청을 바로 연다
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("open")
    if (id) {
      setSelectedId(id)
      const u = new URL(window.location.href); u.searchParams.delete("open"); window.history.replaceState(null, "", u.toString())
    }
  }, [])

  const selected = useMemo(() => requests.find((r) => r.id === selectedId) ?? null, [requests, selectedId])

  const counts = useMemo(() => {
    const c = { open: 0, inProgress: 0, doneThisMonth: 0, total: requests.length }
    const now = new Date()
    for (const r of requests) {
      if (OPEN_STATUSES.includes(r.status)) c.open++
      if (r.status === "IN_PROGRESS") c.inProgress++
      if (r.status === "DONE" && r.completedAt) {
        const d = new Date(r.completedAt)
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) c.doneThisMonth++
      }
    }
    return c
  }, [requests])

  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of requests) if (OPEN_STATUSES.includes(r.status)) m[r.category] = (m[r.category] ?? 0) + 1
    return m
  }, [requests])

  const visible = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter === "OPEN" && !OPEN_STATUSES.includes(r.status)) return false
      if (statusFilter !== "ALL" && statusFilter !== "OPEN" && r.status !== statusFilter) return false
      if (categoryFilter !== "ALL" && r.category !== categoryFilter) return false
      return true
    })
  }, [requests, statusFilter, categoryFilter])

  const upsert = (r: Req) => setRequests((prev) => (prev.some((p) => p.id === r.id) ? prev.map((p) => (p.id === r.id ? r : p)) : [r, ...prev]))

  const openCreate = (cat: RequestCategory | null) => {
    setPresetCategory(cat)
    setCreateOpen(true)
  }

  const statusTabs: Array<{ key: "ALL" | "OPEN" | RequestStatus; label: string }> = [
    { key: "OPEN", label: "진행 필요" },
    { key: "REQUESTED", label: "접수" },
    { key: "IN_REVIEW", label: "검토중" },
    { key: "IN_PROGRESS", label: "진행중" },
    { key: "DONE", label: "완료" },
    { key: "CANCELED", label: "취소" },
    { key: "ALL", label: "전체" },
  ]

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 border-b border-[#e5e8eb] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Inbox className="w-8 h-8 text-[#3182f6]" />
            <h1 className="text-[28px] font-bold text-[#191f28]">요청사항</h1>
          </div>
          <p className="text-[14px] text-[#6b7684]">
            이미지 제작, 원고, 홈페이지 수정 등 필요한 작업을 남겨 주세요. 접수 후 담당자가 진행 상황을 이곳에 업데이트합니다.
          </p>
        </div>
        <Button onClick={() => openCreate(null)} size="md">
          <Plus className="w-4 h-4" /> 새 요청
        </Button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="진행 필요" value={counts.open} tone="text-[#3182f6]" />
        <Stat label="진행중" value={counts.inProgress} tone="text-[#f59e0b]" />
        <Stat label="이달 완료" value={counts.doneThisMonth} tone="text-[#05c072]" />
        <Stat label="전체 요청" value={counts.total} tone="text-[#191f28]" />
      </div>

      {/* 카테고리 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-semibold text-[#191f28]">무엇이 필요하신가요?</h2>
          {categoryFilter !== "ALL" && (
            <button onClick={() => setCategoryFilter("ALL")} className="text-[13px] text-[#6b7684] hover:text-[#191f28]">
              카테고리 필터 해제
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {REQUEST_CATEGORIES.map((c) => {
            const active = categoryFilter === c.key
            return (
              <div
                key={c.key}
                className={`group relative bg-white rounded-2xl p-4 shadow-[0_1px_3px_0_rgb(0_0_0/0.06)] border transition-all ${
                  active ? "border-[#3182f6] ring-2 ring-[#3182f6]/15" : "border-transparent hover:border-[#e5e8eb]"
                }`}
              >
                <button onClick={() => setCategoryFilter(active ? "ALL" : c.key)} className="w-full text-left">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${CATEGORY_TONE[c.key]}`}>{CATEGORY_ICON[c.key]}</div>
                  <div className="text-[14px] font-semibold text-[#191f28] leading-tight">{c.label}</div>
                  <div className="text-[12px] text-[#8b95a1] mt-1 line-clamp-2 min-h-[32px]">{c.description}</div>
                </button>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[12px] text-[#6b7684]">
                    진행 {categoryCounts[c.key] ?? 0}건
                  </span>
                  <button
                    onClick={() => openCreate(c.key)}
                    className="text-[12px] font-semibold text-[#3182f6] hover:underline flex items-center gap-0.5"
                  >
                    요청하기 <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgb(0_0_0/0.06)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#f2f4f6] flex items-center gap-1 overflow-x-auto">
          {statusTabs.map((t) => {
            const active = statusFilter === t.key
            const n = t.key === "ALL" ? requests.length : t.key === "OPEN" ? counts.open : requests.filter((r) => r.status === t.key).length
            return (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition ${
                  active ? "bg-[#191f28] text-white" : "text-[#6b7684] hover:bg-[#f2f4f6]"
                }`}
              >
                {t.label} <span className={active ? "text-white/70" : "text-[#b0b8c1]"}>{n}</span>
              </button>
            )
          })}
        </div>

        {visible.length === 0 ? (
          <div className="py-16 text-center">
            <Inbox className="w-10 h-10 text-[#d1d6db] mx-auto mb-3" />
            <p className="text-[14px] text-[#8b95a1]">해당하는 요청이 없습니다.</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => openCreate(categoryFilter === "ALL" ? null : categoryFilter)}>
              <Plus className="w-4 h-4" /> 첫 요청 남기기
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-[#f2f4f6]">
            {visible.map((r) => (
              <RequestRow key={r.id} r={r} onClick={() => setSelectedId(r.id)} />
            ))}
          </ul>
        )}
      </div>

      {createOpen && (
        <CreateModal
          clinicId={clinicId}
          preset={presetCategory}
          onClose={() => setCreateOpen(false)}
          onCreated={(r) => {
            upsert(r)
            setCreateOpen(false)
            setStatusFilter("OPEN")
            setSelectedId(r.id)
          }}
        />
      )}

      {selected && (
        <DetailDrawer
          r={selected}
          isMaster={isMaster}
          userId={userId}
          onClose={() => setSelectedId(null)}
          onUpdated={upsert}
          onDeleted={(id) => {
            setRequests((prev) => prev.filter((p) => p.id !== id))
            setSelectedId(null)
          }}
        />
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="bg-white rounded-2xl px-5 py-4 shadow-[0_1px_3px_0_rgb(0_0_0/0.06)]">
      <div className="text-[13px] text-[#8b95a1]">{label}</div>
      <div className={`text-[26px] font-bold mt-1 ${tone}`}>
        {value}
        <span className="text-[14px] font-medium text-[#b0b8c1] ml-1">건</span>
      </div>
    </div>
  )
}

function RequestRow({ r, onClick }: { r: Req; onClick: () => void }) {
  const cat = CATEGORY_MAP[r.category]
  const st = STATUS_META[r.status]
  const pr = PRIORITY_META[r.priority]
  const left = daysLeft(r.dueDate)
  const overdue = left !== null && left < 0 && OPEN_STATUSES.includes(r.status)
  return (
    <li>
      <button onClick={onClick} className="w-full text-left px-5 py-4 hover:bg-[#f9fafb] transition flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${CATEGORY_TONE[r.category]}`}>{CATEGORY_ICON[r.category]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={st.color}>{st.label}</Badge>
            {r.priority === "HIGH" && <Badge variant="red">{pr.label}</Badge>}
            <span className="text-[12px] text-[#8b95a1]">{cat.short}</span>
          </div>
          <div className="text-[15px] font-semibold text-[#191f28] mt-1 truncate">{r.title}</div>
          <div className="text-[13px] text-[#6b7684] mt-0.5 line-clamp-1">{r.description}</div>
          <div className="flex items-center gap-3 text-[12px] text-[#8b95a1] mt-2 flex-wrap">
            <span>{r.author}</span>
            <span>·</span>
            <span>{fmtDate(r.createdAt)} 등록</span>
            {r.dueDate && (
              <span className={`flex items-center gap-1 ${overdue ? "text-[#f04452] font-semibold" : ""}`}>
                <Calendar className="w-3 h-3" /> 희망 {fmtDate(r.dueDate)}
                {overdue && ` (${-left!}일 지남)`}
              </span>
            )}
            {r.attachments.length > 0 && (
              <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> {r.attachments.length}</span>
            )}
            {r.comments.length > 0 && (
              <span className="flex items-center gap-1"><Send className="w-3 h-3" /> {r.comments.length}</span>
            )}
            {r.assignee && <span className="text-[#3182f6]">담당 {r.assignee}</span>}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#d1d6db] shrink-0 mt-3" />
      </button>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* 새 요청 모달                                                        */
/* ------------------------------------------------------------------ */

function CreateModal({ clinicId, preset, onClose, onCreated }: { clinicId: string; preset: RequestCategory | null; onClose: () => void; onCreated: (r: Req) => void }) {
  const [category, setCategory] = useState<RequestCategory | null>(preset)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<RequestPriority>("MEDIUM")
  const [dueDate, setDueDate] = useState(() => {
    if (!preset) return ""
    const d = new Date()
    d.setDate(d.getDate() + CATEGORY_MAP[preset].leadDays)
    return toDateInput(d)
  })
  const [details, setDetails] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const def = category ? CATEGORY_MAP[category] : null

  const pick = (c: RequestCategory) => {
    setCategory(c)
    setDetails({})
    setError(null)
    const d = new Date()
    d.setDate(d.getDate() + CATEGORY_MAP[c].leadDays)
    setDueDate(toDateInput(d))
  }

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const next = [...files, ...Array.from(list)].slice(0, MAX_FILES)
    setFiles(next)
  }

  const submit = async () => {
    if (!category) return setError("카테고리를 선택해 주세요")
    if (!title.trim()) return setError("제목을 입력해 주세요")
    if (!description.trim()) return setError("요청 내용을 입력해 주세요")
    for (const f of def!.fields) if (f.required && !details[f.key]?.trim()) return setError(`${f.label} 을(를) 입력해 주세요`)
    setSubmitting(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set("clinicId", clinicId)
      fd.set("category", category)
      fd.set("title", title.trim())
      fd.set("description", description.trim())
      fd.set("priority", priority)
      fd.set("dueDate", dueDate)
      fd.set("details", JSON.stringify(details))
      files.forEach((f) => fd.append("files", f))
      const res = await fetch("/api/requests", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "등록에 실패했습니다")
      onCreated(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-[720px] bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[#f2f4f6] flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-[#191f28]">새 요청</h2>
            <p className="text-[13px] text-[#8b95a1] mt-0.5">{def ? def.label : "먼저 요청 종류를 골라 주세요"}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-[#f2f4f6] flex items-center justify-center text-[#8b95a1]"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* 1. 카테고리 */}
          <div>
            <label className={labelCls}>요청 종류</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {REQUEST_CATEGORIES.map((c) => {
                const active = category === c.key
                return (
                  <button
                    key={c.key}
                    onClick={() => pick(c.key)}
                    className={`text-left p-3 rounded-xl border transition ${active ? "border-[#3182f6] bg-[#ebf3fe]" : "border-[#e5e8eb] hover:bg-[#f9fafb]"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${CATEGORY_TONE[c.key]}`}>{CATEGORY_ICON[c.key]}</span>
                      <span className="text-[13px] font-semibold text-[#191f28]">{c.label}</span>
                    </div>
                    <div className="text-[11px] text-[#8b95a1] mt-1.5 line-clamp-1">예) {c.examples.slice(0, 2).join(", ")}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {def && (
            <>
              <div>
                <label className={labelCls}>제목 <span className="text-[#f04452]">*</span></label>
                <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`예) ${def.examples[0]}`} maxLength={200} />
              </div>

              {def.fields.length > 0 && (
                <div className="rounded-xl bg-[#f9fafb] p-4 space-y-4">
                  <div className="text-[12px] font-semibold text-[#8b95a1] uppercase tracking-wide">{def.short} 세부 정보</div>
                  {def.fields.map((f) => (
                    <DetailInput key={f.key} field={f} value={details[f.key] ?? ""} onChange={(v) => setDetails((d) => ({ ...d, [f.key]: v }))} />
                  ))}
                </div>
              )}

              <div>
                <label className={labelCls}>요청 내용 <span className="text-[#f04452]">*</span></label>
                <textarea
                  className={`${inputCls} min-h-[110px] resize-y`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="원하시는 결과를 자유롭게 적어 주세요. 참고할 점, 피해야 할 표현, 기한 사유 등"
                  maxLength={5000}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>희망 완료일</label>
                  <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  <p className="text-[11px] text-[#8b95a1] mt-1">통상 {def.leadDays}일 소요. 급하면 우선순위를 긴급으로 바꿔 주세요.</p>
                </div>
                <div>
                  <label className={labelCls}>우선순위</label>
                  <div className="flex gap-1.5">
                    {(["HIGH", "MEDIUM", "LOW"] as RequestPriority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`flex-1 py-2.5 rounded-[10px] text-[13px] font-semibold border transition ${
                          priority === p
                            ? p === "HIGH" ? "bg-[#fff0f1] border-[#f04452] text-[#f04452]" : "bg-[#ebf3fe] border-[#3182f6] text-[#3182f6]"
                            : "border-[#e5e8eb] text-[#6b7684] hover:bg-[#f9fafb]"
                        }`}
                      >
                        {PRIORITY_META[p].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>참고 파일 <span className="text-[#8b95a1] font-normal">(이미지·PDF·문서, 최대 {MAX_FILES}개)</span></label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-[#e5e8eb] rounded-xl p-5 text-center cursor-pointer hover:border-[#3182f6] hover:bg-[#f9fafb] transition"
                >
                  <Paperclip className="w-5 h-5 text-[#b0b8c1] mx-auto mb-1" />
                  <p className="text-[13px] text-[#6b7684]">클릭하거나 파일을 끌어다 놓으세요</p>
                  <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                </div>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between text-[13px] bg-[#f9fafb] rounded-lg px-3 py-2">
                        <span className="truncate text-[#4e5968]">{f.name} <span className="text-[#b0b8c1]">{fmtSize(f.size)}</span></span>
                        <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-[#8b95a1] hover:text-[#f04452]"><X className="w-3.5 h-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 text-[13px] text-[#f04452] bg-[#fff0f1] rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#f2f4f6] flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button onClick={submit} loading={submitting} disabled={!category}>요청 등록</Button>
        </div>
      </div>
    </Overlay>
  )
}

function DetailInput({ field, value, onChange }: { field: DetailField; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelCls}>
        {field.label} {field.required && <span className="text-[#f04452]">*</span>}
      </label>
      {field.type === "select" ? (
        <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">선택</option>
          {field.options!.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === "textarea" ? (
        <textarea className={`${inputCls} min-h-[80px] resize-y`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
      ) : (
        <input type={field.type === "date" ? "date" : "text"} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
      )}
      {field.help && <p className="text-[11px] text-[#8b95a1] mt-1">{field.help}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 상세 드로어                                                         */
/* ------------------------------------------------------------------ */

function DetailDrawer({ r, isMaster, userId, onClose, onUpdated, onDeleted }: {
  r: Req; isMaster: boolean; userId: string; onClose: () => void; onUpdated: (r: Req) => void; onDeleted: (id: string) => void
}) {
  const cat = CATEGORY_MAP[r.category]
  const st = STATUS_META[r.status]
  const [comment, setComment] = useState("")
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignee, setAssignee] = useState(r.assignee ?? "")
  const [resultNote, setResultNote] = useState(r.resultNote ?? "")
  const [dueDate, setDueDate] = useState(r.dueDate ? toDateInput(new Date(r.dueDate)) : "")
  const fileRef = useRef<HTMLInputElement>(null)

  const patch = async (body: Record<string, unknown>) => {
    setError(null)
    const res = await fetch(`/api/requests/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const json = await res.json()
    if (!res.ok) return setError(json.error || "변경에 실패했습니다")
    onUpdated(json)
  }

  const sendComment = async () => {
    if (!comment.trim() && commentFiles.length === 0) return
    setSending(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set("content", comment.trim())
      commentFiles.forEach((f) => fd.append("files", f))
      const res = await fetch(`/api/requests/${r.id}/comments`, { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "등록 실패")
      onUpdated(json)
      setComment("")
      setCommentFiles([])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const remove = async () => {
    if (!confirm("이 요청을 완전히 삭제할까요? 첨부·댓글도 함께 삭제됩니다.")) return
    await fetch(`/api/requests/${r.id}`, { method: "DELETE" })
    onDeleted(r.id)
  }

  const refFiles = r.attachments.filter((a) => a.kind !== "RESULT")
  const resultFiles = r.attachments.filter((a) => a.kind === "RESULT")
  const canCancel = !isMaster && ["REQUESTED", "IN_REVIEW"].includes(r.status)
  const left = daysLeft(r.dueDate)

  return (
    <Overlay onClose={onClose} align="right">
      <div className="w-full max-w-[640px] h-full bg-white shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-[#f2f4f6] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[12px] font-semibold ${CATEGORY_TONE[r.category]}`}>{CATEGORY_ICON[r.category]}<span>{cat.label}</span></span>
              <Badge variant={st.color}>{st.label}</Badge>
              <Badge variant={PRIORITY_META[r.priority].color}>{PRIORITY_META[r.priority].label}</Badge>
            </div>
            <h2 className="text-[18px] font-bold text-[#191f28] leading-snug">{r.title}</h2>
            <div className="text-[12px] text-[#8b95a1] mt-1">{r.author} · {fmtDate(r.createdAt, true)} 등록</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-[#f2f4f6] flex items-center justify-center text-[#8b95a1] shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* 진행 단계 */}
          <div className="px-6 py-4 border-b border-[#f2f4f6]">
            <StatusSteps status={r.status} />
            <div className="flex items-center gap-4 mt-3 text-[12px] text-[#6b7684] flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> 희망 {fmtDate(r.dueDate)}{left !== null && OPEN_STATUSES.includes(r.status) && (left < 0 ? <span className="text-[#f04452] font-semibold"> ({-left}일 지남)</span> : <span> (D-{left})</span>)}</span>
              {r.assignee && <span>담당 <b className="text-[#191f28]">{r.assignee}</b></span>}
              {r.completedAt && <span className="flex items-center gap-1 text-[#05c072]"><CheckCircle2 className="w-3.5 h-3.5" /> {fmtDate(r.completedAt, true)} 완료</span>}
            </div>
          </div>

          {/* 마스터 처리 패널 */}
          {isMaster && (
            <div className="px-6 py-4 border-b border-[#f2f4f6] bg-[#f9fafb] space-y-3">
              <div className="text-[12px] font-semibold text-[#8b95a1] uppercase tracking-wide">처리 (마스터)</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>상태</label>
                  <select className={inputCls} value={r.status} onChange={(e) => patch({ status: e.target.value })}>
                    {(Object.keys(STATUS_META) as RequestStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>우선순위</label>
                  <select className={inputCls} value={r.priority} onChange={(e) => patch({ priority: e.target.value })}>
                    {(Object.keys(PRIORITY_META) as RequestPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>담당자</label>
                  <input className={inputCls} value={assignee} onChange={(e) => setAssignee(e.target.value)} onBlur={() => assignee !== (r.assignee ?? "") && patch({ assignee })} placeholder="예) 디자인팀 김OO" />
                </div>
                <div>
                  <label className={labelCls}>완료 예정일</label>
                  <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} onBlur={() => patch({ dueDate })} />
                </div>
              </div>
              <div>
                <label className={labelCls}>결과 안내 (원장님께 보이는 메모)</label>
                <textarea className={`${inputCls} min-h-[70px] resize-y`} value={resultNote} onChange={(e) => setResultNote(e.target.value)} onBlur={() => resultNote !== (r.resultNote ?? "") && patch({ resultNote })} placeholder="완료 시 결과물 위치·적용 내용을 적어 주세요" />
              </div>
            </div>
          )}

          {/* 결과 안내 (원장 뷰) */}
          {!isMaster && (r.resultNote || resultFiles.length > 0) && (
            <div className="px-6 py-4 border-b border-[#f2f4f6] bg-[#e8f7f1]/60">
              <div className="text-[12px] font-semibold text-[#05c072] uppercase tracking-wide mb-1.5">결과 안내</div>
              {r.resultNote && <p className="text-[14px] text-[#191f28] whitespace-pre-wrap">{r.resultNote}</p>}
            </div>
          )}

          {resultFiles.length > 0 && (
            <div className="px-6 py-4 border-b border-[#f2f4f6]">
              <div className="text-[12px] font-semibold text-[#8b95a1] uppercase tracking-wide mb-2">결과물</div>
              <FileList files={resultFiles} />
            </div>
          )}

          {/* 세부 정보 */}
          {Object.keys(r.details).length > 0 && (
            <div className="px-6 py-4 border-b border-[#f2f4f6]">
              <div className="text-[12px] font-semibold text-[#8b95a1] uppercase tracking-wide mb-2">{cat.short} 세부 정보</div>
              <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">
                {cat.fields.filter((f) => r.details[f.key]).map((f) => (
                  <div key={f.key} className="contents">
                    <dt className="text-[#8b95a1]">{f.label}</dt>
                    <dd className="text-[#191f28] whitespace-pre-wrap break-words">
                      {f.type === "url" ? r.details[f.key].split("\n").map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="text-[#3182f6] hover:underline block break-all">{u}</a>) : r.details[f.key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="px-6 py-4 border-b border-[#f2f4f6]">
            <div className="text-[12px] font-semibold text-[#8b95a1] uppercase tracking-wide mb-2">요청 내용</div>
            <p className="text-[14px] text-[#191f28] whitespace-pre-wrap leading-relaxed">{r.description}</p>
            {refFiles.length > 0 && (
              <div className="mt-3">
                <div className="text-[12px] text-[#8b95a1] mb-1.5">참고 파일</div>
                <FileList files={refFiles} />
              </div>
            )}
          </div>

          {/* 댓글 */}
          <div className="px-6 py-4">
            <div className="text-[12px] font-semibold text-[#8b95a1] uppercase tracking-wide mb-3">대화 {r.comments.length > 0 && `(${r.comments.length})`}</div>
            {r.comments.length === 0 ? (
              <p className="text-[13px] text-[#b0b8c1]">아직 댓글이 없습니다. 추가 설명이나 질문을 남겨 주세요.</p>
            ) : (
              <ul className="space-y-3">
                {r.comments.map((c) => {
                  const staff = c.authorRole === "MASTER"
                  const mine = staff === isMaster
                  return (
                    <li key={c.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${staff ? "bg-[#ebf3fe]" : "bg-[#f2f4f6]"}`}>
                        <div className="text-[11px] text-[#8b95a1] mb-0.5">{staff ? "THINKLAB" : c.author} · {fmtDate(c.createdAt, true)}</div>
                        <div className="text-[14px] text-[#191f28] whitespace-pre-wrap">{c.content}</div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-6 mb-2 flex items-center gap-2 text-[13px] text-[#f04452] bg-[#fff0f1] rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4" /> {error}</div>
        )}

        {/* 입력 */}
        <div className="px-6 py-3 border-t border-[#f2f4f6] space-y-2">
          {commentFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {commentFiles.map((f, i) => (
                <span key={i} className="text-[12px] bg-[#f2f4f6] rounded-md px-2 py-1 flex items-center gap-1">{f.name}<button onClick={() => setCommentFiles(commentFiles.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button></span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <button onClick={() => fileRef.current?.click()} className="w-10 h-10 rounded-xl hover:bg-[#f2f4f6] flex items-center justify-center text-[#8b95a1] shrink-0" title={isMaster ? "결과물 첨부" : "파일 첨부"}>
              <Paperclip className="w-4 h-4" />
            </button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) setCommentFiles([...commentFiles, ...Array.from(e.target.files)].slice(0, MAX_FILES)); e.target.value = "" }} />
            <textarea
              className={`${inputCls} min-h-[42px] max-h-[120px] resize-none`}
              rows={1}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendComment() }}
              placeholder={isMaster ? "진행 상황·질문을 남기세요 (Ctrl+Enter)" : "추가 설명이나 질문을 남기세요 (Ctrl+Enter)"}
            />
            <Button onClick={sendComment} loading={sending} size="md" className="shrink-0"><Send className="w-4 h-4" /></Button>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-[#b0b8c1]">{isMaster ? "첨부 파일은 결과물로 분류됩니다" : "파일은 참고 자료로 전달됩니다"}</div>
            <div className="flex gap-2">
              {canCancel && (
                <button onClick={() => confirm("이 요청을 취소할까요?") && patch({ status: "CANCELED" })} className="text-[12px] text-[#8b95a1] hover:text-[#f04452]">요청 취소</button>
              )}
              {isMaster && (
                <button onClick={remove} className="text-[12px] text-[#8b95a1] hover:text-[#f04452] flex items-center gap-1"><Trash2 className="w-3 h-3" /> 삭제</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  )
}

function StatusSteps({ status }: { status: RequestStatus }) {
  if (status === "CANCELED") {
    return <div className="text-[13px] text-[#f04452] font-semibold">취소된 요청입니다</div>
  }
  const steps: RequestStatus[] = ["REQUESTED", "IN_REVIEW", "IN_PROGRESS", "DONE"]
  const idx = steps.indexOf(status)
  return (
    <div className="flex items-center">
      {steps.map((s, i) => {
        const done = i < idx
        const cur = i === idx
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${done ? "bg-[#05c072] text-white" : cur ? "bg-[#3182f6] text-white ring-4 ring-[#3182f6]/15" : "bg-[#f2f4f6] text-[#b0b8c1]"}`}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <div className={`text-[11px] mt-1 whitespace-nowrap ${cur ? "text-[#191f28] font-semibold" : "text-[#8b95a1]"}`}>{STATUS_META[s].label}</div>
            </div>
            {i < steps.length - 1 && <div className={`flex-1 h-[2px] mx-2 mb-4 ${i < idx ? "bg-[#05c072]" : "bg-[#f2f4f6]"}`} />}
          </div>
        )
      })}
    </div>
  )
}

function FileList({ files }: { files: Req["attachments"] }) {
  const images = files.filter((f) => f.type.startsWith("image/"))
  const others = files.filter((f) => !f.type.startsWith("image/"))
  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((f) => (
            <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="group relative block aspect-square rounded-xl overflow-hidden bg-[#f2f4f6]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${f.url}?inline=1`} alt={f.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
              <div className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[11px] px-2 py-1 truncate">{f.name}</div>
            </a>
          ))}
        </div>
      )}
      {others.map((f) => (
        <a key={f.id} href={f.url} className="flex items-center justify-between text-[13px] bg-[#f9fafb] hover:bg-[#f2f4f6] rounded-lg px-3 py-2 transition">
          <span className="truncate text-[#4e5968] flex items-center gap-2"><Paperclip className="w-3.5 h-3.5 text-[#b0b8c1]" />{f.name} <span className="text-[#b0b8c1]">{fmtSize(f.size)}</span></span>
          <Download className="w-3.5 h-3.5 text-[#8b95a1]" />
        </a>
      ))}
    </div>
  )
}

function Overlay({ children, onClose, align = "center" }: { children: React.ReactNode; onClose: () => void; align?: "center" | "right" }) {
  return (
    <div
      className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex ${align === "right" ? "justify-end" : "items-center justify-center p-4"}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>
  )
}
