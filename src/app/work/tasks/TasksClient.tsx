"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import FilesClient from "../files/FilesClient"
import ChecklistSection from "../board/Checklist"

type Clinic = { id: string; name: string }
type Task = {
  group?: { name: string } | null
  id: string
  clinicId: string
  title: string
  category: string
  status: string
  priority: string
  dueOn: string | null
  createdAt: string
  serviceRequestId: string | null
  assigneeUserId: string | null
  clinic: { name: string }
  assignee: { user: { name: string } } | null
  _count: { comments: number }
}
type Review = {
  id: string
  decision: "APPROVED" | "CHANGES_REQUIRED"
  claimsChecked: boolean
  riskDisclosureChecked: boolean
  anonymizationChecked: boolean
  note: string | null
  reviewedAt: string
  reviewer: { name: string }
}
type Detail = {
  task: Task & {
    description: string | null
    reviewRequired: boolean
    resultUrl: string | null
    serviceRequest: { id: string; title: string; status: string } | null
    publishedContent: { id: string; title: string; url: string } | null
  }
  reviews: Review[]
  comments: { id: string; body: string; createdAt: string; author: { id: string; name: string } }[]
  activities: { id: string; type: string; oldValue: string | null; newValue: string | null; createdAt: string; actor: { name: string } | null }[]
  assignable: { id: string; name: string }[]
}

const STATUS: Record<string, string> = { TODO: "할 일", BLOCKED: "자료 대기", IN_PROGRESS: "진행중", IN_REVIEW: "검토중", DONE: "완료", CANCELLED: "취소" }
const CATEGORY: Record<string, string> = { BLOG: "블로그", IMAGE: "이미지", WEBSITE: "홈페이지", REPORT: "보고서", ADS: "광고", MEETING: "미팅", OTHER: "기타" }
const PRIORITY: Record<string, string> = { HIGH: "높음", NORMAL: "보통", LOW: "낮음" }
const ACT: Record<string, string> = {
  CREATED: "생성",
  STATUS_CHANGED: "상태",
  ASSIGNEE_CHANGED: "담당자",
  DUE_DATE_CHANGED: "마감",
  CONTENT_CHANGED: "제목",
  REOPENED: "다시 열기",
}

const d10 = (v: string | null) => (v ? v.slice(0, 10) : "")
// 시각은 한국 시간으로
const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ")
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const field = "h-8 px-2 rounded border border-[#d1d1cc] bg-white text-[14px]"
const btn = "h-8 px-3 rounded text-[14px] font-medium bg-[#191f28] text-white disabled:opacity-40"

export default function TasksClient({ clinics, me }: { clinics: Clinic[]; me: { id: string; name: string } }) {
  const params = useSearchParams()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  // 주소로 넘어온 필터(홈·사이드바 링크): clinicId, status, assignee=me|none|<id>, category, due=overdue|today|week, review=1
  const [filter, setFilter] = useState({
    clinicId: params.get("clinicId") ?? "",
    status: params.get("status") ?? "open",
    assignee: params.get("assignee") ?? "",
    category: params.get("category") ?? "",
    due: params.get("due") ?? "",
    review: params.get("review") ?? "",
  })
  const [openId, setOpenId] = useState<string | null>(params.get("open"))
  // 상세를 열면 사이드바 '최근 본 항목'에 남긴다
  useEffect(() => {
    if (!openId) return
    const t = tasks.find((x) => x.id === openId)
    if (t) window.dispatchEvent(new CustomEvent("work:recent", { detail: { href: `/work/tasks?open=${t.id}`, label: t.title } }))
  }, [openId, tasks])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v))
    const r = await fetch(`/api/work/tasks?${q}`)
    const j = await r.json()
    setLoading(false)
    if (!r.ok) return setError(j.error ?? "불러오기 실패")
    setTasks(j.tasks)
  }, [filter])
  useEffect(() => {
    load()
  }, [load])

  const today = kstToday()
  const grouped = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks) {
      const k = !t.dueOn ? "마감 없음" : d10(t.dueOn) < today && !["DONE", "CANCELLED"].includes(t.status) ? "마감 지남" : d10(t.dueOn)
      m.set(k, [...(m.get(k) ?? []), t])
    }
    const order = (k: string) => (k === "마감 지남" ? "0" : k === "마감 없음" ? "9" : `1${k}`)
    return Array.from(m.entries()).sort((a, b) => order(a[0]).localeCompare(order(b[0])))
  }, [tasks, today])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[20px] font-bold mr-2">업무 타임라인</h1>
        <select className={field} value={filter.clinicId} onChange={(e) => setFilter({ ...filter, clinicId: e.target.value })}>
          <option value="">담당 치과 전체</option>
          {clinics.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className={field} value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="open">진행 중 전체</option>
          <option value="">전체(완료 포함)</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className={field} value={filter.assignee} onChange={(e) => setFilter({ ...filter, assignee: e.target.value })}>
          <option value="">담당자 전체</option>
          <option value="me">내 업무</option>
          <option value="none">담당자 없음</option>
          {filter.assignee && !["me", "none"].includes(filter.assignee) && <option value={filter.assignee}>선택한 직원</option>}
        </select>
        <select className={field} value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
          <option value="">분류 전체</option>
          {Object.entries(CATEGORY).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {(filter.due || filter.review) && (
          <button className="h-8 px-2 rounded border border-[#0062ff] text-[13px] text-[#0062ff] bg-white" onClick={() => setFilter({ ...filter, due: "", review: "" })}>
            {filter.review ? "의료광고 검수 대기" : filter.due === "overdue" ? "마감 지남" : filter.due === "today" ? "오늘 마감" : "이번 주 마감"} ✕
          </button>
        )}
        <button className={`${btn} ml-auto`} onClick={() => setCreating(true)} disabled={clinics.length === 0}>
          새 업무
        </button>
      </div>
      {error && <p className="text-[13px] text-[#d92d20]">{error}</p>}

      {creating && (
        <CreateForm
          clinics={clinics}
          defaultClinic={filter.clinicId}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            load()
            setOpenId(id)
          }}
        />
      )}

      <div className="bg-white rounded border border-[#b9b9b3]">
        {loading ? (
          <p className="p-3 text-[13px] text-[#6f6f6a]">불러오는 중…</p>
        ) : tasks.length === 0 ? (
          <p className="p-3 text-[13px] text-[#6f6f6a]">조건에 맞는 업무가 없습니다.</p>
        ) : (
          grouped.map(([day, list]) => (
            <div key={day}>
              <div className={`px-3 py-1.5 text-[12px] font-bold bg-[#f4f4f2] border-b border-[#ecece9] ${day === "마감 지남" ? "text-[#d92d20]" : "text-[#555]"}`}>
                {day === today ? `${day} · 오늘` : day} <span className="font-normal">{list.length}건</span>
              </div>
              {list.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOpenId(t.id)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 border-b border-[#ecece9] hover:bg-[#fafaf8] text-[14px]"
                >
                  <span className="w-[120px] shrink-0 text-[#6f6f6a] truncate">{t.clinic?.name ?? "사내"}</span>
                  <span className="w-[64px] shrink-0 text-[12px] text-[#6f6f6a]">{CATEGORY[t.category]}</span>
                  <span className="flex-1 min-w-0 truncate">
                    {t.priority === "HIGH" && <span className="text-[#d92d20] mr-1">긴급</span>}
                    {t.serviceRequestId && <span className="text-[12px] text-[#6f6f6a] mr-1">[원장 요청]</span>}
                    {t.title}
                    {t._count.comments > 0 && <span className="ml-1 text-[12px] text-[#6f6f6a]">댓글 {t._count.comments}</span>}
                  </span>
                  <span className="w-[72px] shrink-0 text-[13px]">{t.assignee?.user.name ?? <span className="text-[#b0b0aa]">미배정</span>}</span>
                  <span className="w-[56px] shrink-0 text-[13px] text-right">{STATUS[t.status]}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {openId && <TaskDrawer id={openId} me={me} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  )
}

function CreateForm({ clinics, defaultClinic, onClose, onCreated }: { clinics: Clinic[]; defaultClinic: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ clinicId: defaultClinic || clinics[0]?.id || "", title: "", category: "BLOG", priority: "NORMAL", dueOn: "", assignToMe: true })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const submit = async () => {
    setBusy(true)
    const r = await fetch("/api/work/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, dueOn: f.dueOn || null, assigneeUserId: f.assignToMe ? "__me__" : undefined }),
    })
    const j = await r.json()
    setBusy(false)
    if (!r.ok) return setErr(j.error ?? "생성 실패")
    onCreated(j.id)
  }
  return (
    <div className="bg-white rounded border border-[#b9b9b3] p-3 flex flex-wrap items-center gap-2">
      <select className={field} value={f.clinicId} onChange={(e) => setF({ ...f, clinicId: e.target.value })}>
        {clinics.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <select className={field} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
        {Object.entries(CATEGORY).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <input className={`${field} flex-1 min-w-[240px]`} placeholder="업무 제목" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <input type="date" className={field} value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} />
      <select className={field} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
        {Object.entries(PRIORITY).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-[13px]">
        <input type="checkbox" checked={f.assignToMe} onChange={(e) => setF({ ...f, assignToMe: e.target.checked })} /> 내가 담당
      </label>
      <button className={btn} disabled={busy || !f.title.trim() || !f.clinicId} onClick={submit}>만들기</button>
      <button className="h-8 px-2 text-[14px] text-[#6f6f6a]" onClick={onClose}>닫기</button>
      {err && <span className="text-[13px] text-[#d92d20] w-full">{err}</span>}
    </div>
  )
}

export function TaskDrawer({ id, me, onClose, onChanged }: { id: string; me: { id: string; name: string }; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState("")
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`/api/work/tasks/${id}`)
    const j = await r.json()
    if (!r.ok) return setErr(j.error ?? "불러오기 실패")
    setD(j)
  }, [id])
  useEffect(() => {
    setD(null)
    load()
  }, [load])
  // Esc 로 닫기(입력 중이 아닐 때)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.key === "Escape" && !(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) onClose()
    }
    document.addEventListener("keydown", key)
    return () => document.removeEventListener("keydown", key)
  }, [onClose])

  const patch = async (body: object) => {
    setBusy(true)
    setErr("")
    const r = await fetch(`/api/work/tasks/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    const j = await r.json()
    setBusy(false)
    if (!r.ok) return setErr(j.error ?? "저장 실패")
    await load()
    onChanged()
  }
  const send = async () => {
    if (!comment.trim()) return
    setBusy(true)
    const r = await fetch(`/api/work/tasks/${id}/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: comment }) })
    setBusy(false)
    if (r.ok) {
      setComment("")
      load()
      onChanged()
    }
  }

  const nameOf = (uid: string | null) => (uid ? d?.assignable.find((a) => a.id === uid)?.name ?? "(배정 해제된 직원)" : "")

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <aside className="w-full max-w-[520px] h-full bg-white border-l border-[#b9b9b3] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#d1d1cc] flex items-center gap-2">
          <span className="text-[13px] text-[#6f6f6a]">{d?.task.clinic?.name ?? "사내"}{d?.task.group ? ` · ${d.task.group.name}` : ""}</span>
          <button className="ml-auto text-[14px] text-[#6f6f6a]" onClick={onClose}>닫기</button>
        </div>
        {!d ? (
          <p className="p-4 text-[13px] text-[#6f6f6a]">{err || "불러오는 중…"}</p>
        ) : (
          <div className="p-4 space-y-4">
            <h2 className="text-[18px] font-bold">{d.task.title}</h2>
            {d.task.serviceRequest && (
              <Link
                href={`/dashboard/${d.task.clinicId}/requests?open=${d.task.serviceRequest.id}`}
                prefetch={false}
                className="block text-[13px] underline text-[#333]"
              >
                원장 요청 원문 보기 · 원장과의 대화는 요청 댓글에
              </Link>
            )}
            {d.task.description && <p className="text-[14px] whitespace-pre-wrap">{d.task.description}</p>}

            <div className="grid grid-cols-[72px_1fr] gap-y-2 items-center text-[14px]">
              <span className="text-[#6f6f6a]">상태</span>
              <select className={field} disabled={busy} value={d.task.status} onChange={(e) => patch({ status: e.target.value })}>
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <span className="text-[#6f6f6a]">담당</span>
              <div className="flex gap-2">
                <select className={`${field} flex-1`} disabled={busy} value={d.task.assigneeUserId ?? ""} onChange={(e) => patch({ assigneeUserId: e.target.value || null })}>
                  <option value="">미배정</option>
                  {d.assignable.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {d.task.assigneeUserId !== me.id && d.assignable.some((a) => a.id === me.id) && (
                  <button className="h-8 px-2 rounded border border-[#d1d1cc] text-[13px]" disabled={busy} onClick={() => patch({ assigneeUserId: me.id })}>
                    내가 맡기
                  </button>
                )}
              </div>
              <span className="text-[#6f6f6a]">마감</span>
              <input type="date" className={field} disabled={busy} value={d10(d.task.dueOn)} onChange={(e) => patch({ dueOn: e.target.value || null })} />
              <span className="text-[#6f6f6a]">중요도</span>
              <select className={field} disabled={busy} value={d.task.priority} onChange={(e) => patch({ priority: e.target.value })}>
                {Object.entries(PRIORITY).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            {err && <p className="text-[13px] text-[#d92d20]">{err}</p>}

            {(d.task.publishedContent || d.task.resultUrl) && (
              <p className="text-[13px]">
                발행:{" "}
                <a className="underline" href={d.task.publishedContent?.url ?? d.task.resultUrl ?? "#"} target="_blank" rel="noreferrer">
                  {d.task.publishedContent?.title ?? d.task.resultUrl}
                </a>
              </p>
            )}

            <ChecklistSection taskId={d.task.id} onChanged={onChanged} />

            <ReviewSection task={d.task} reviews={d.reviews} me={me} onToggle={(v) => patch({ reviewRequired: v })} onSaved={() => { load(); onChanged() }} />

            <section>
              <h3 className="text-[14px] font-bold mb-1">파일 <span className="font-normal text-[12px] text-[#6f6f6a]">원고·시안·결과물</span></h3>
              <FilesClient clinics={d.task.clinicId ? [{ id: d.task.clinicId, name: d.task.clinic?.name ?? "" }] : []} clinicId={d.task.clinicId ?? ""} taskId={d.task.id} />
            </section>

            <section>
              <h3 className="text-[14px] font-bold mb-1">내부 댓글 <span className="font-normal text-[12px] text-[#6f6f6a]">원장에게 보이지 않음</span></h3>
              <div className="space-y-2">
                {d.comments.map((c) => (
                  <div key={c.id} className="text-[14px] border-b border-[#ecece9] pb-2">
                    <div className="text-[12px] text-[#6f6f6a]">{c.author.name} · {kst(c.createdAt)}</div>
                    <div className="whitespace-pre-wrap">{c.body}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <textarea className="flex-1 min-h-[64px] p-2 rounded border border-[#d1d1cc] text-[14px]" value={comment} onChange={(e) => setComment(e.target.value)} />
                <button className={btn} disabled={busy || !comment.trim()} onClick={send}>등록</button>
              </div>
            </section>

            <section>
              <h3 className="text-[14px] font-bold mb-1">변경 기록</h3>
              <ul className="text-[12px] text-[#555] space-y-0.5">
                {d.activities.map((a) => (
                  <li key={a.id}>
                    {kst(a.createdAt)} · {a.actor?.name ?? "-"} · {ACT[a.type] ?? a.type}
                    {a.type === "STATUS_CHANGED" || a.type === "REOPENED"
                      ? ` ${STATUS[a.oldValue ?? ""] ?? ""} → ${STATUS[a.newValue ?? ""] ?? ""}`
                      : a.type === "ASSIGNEE_CHANGED"
                        ? ` ${nameOf(a.oldValue) || "미배정"} → ${nameOf(a.newValue) || "미배정"}`
                        : a.type === "DUE_DATE_CHANGED"
                          ? ` ${a.oldValue || "없음"} → ${a.newValue || "없음"}`
                          : ""}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </aside>
    </div>
  )
}

function ReviewSection({ task, reviews, me, onToggle, onSaved }: { task: Detail["task"]; reviews: Review[]; me: { id: string }; onToggle: (v: boolean) => void; onSaved: () => void }) {
  const [f, setF] = useState({ claimsChecked: false, riskDisclosureChecked: false, anonymizationChecked: false, note: "" })
  const [err, setErr] = useState("")
  const submit = async (decision: string) => {
    setErr("")
    const r = await fetch(`/api/work/tasks/${task.id}/reviews`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, decision }) })
    const j = await r.json()
    if (!r.ok) return setErr(j.error ?? "저장 실패")
    setF({ claimsChecked: false, riskDisclosureChecked: false, anonymizationChecked: false, note: "" })
    onSaved()
  }
  const last = reviews[0]
  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-[14px] font-bold">의료광고 검수</h3>
        <label className="flex items-center gap-1 text-[12px] text-[#6f6f6a]">
          <input type="checkbox" checked={task.reviewRequired} onChange={(e) => onToggle(e.target.checked)} /> 검수 필요(승인 전 완료 불가)
        </label>
        {last && <span className={`ml-auto text-[12px] ${last.decision === "APPROVED" ? "text-[#067647]" : "text-[#d92d20]"}`}>{last.decision === "APPROVED" ? "승인됨" : "수정 요청"}</span>}
      </div>
      {task.reviewRequired && task.assigneeUserId !== me.id && (
        <div className="space-y-1 text-[13px] border border-[#ecece9] rounded p-2">
          {([
            ["claimsChecked", "과장·치료효과 보장·비교 표현 없음"],
            ["riskDisclosureChecked", "부작용·주의사항 문단 있음"],
            ["anonymizationChecked", "환자 익명화(얼굴·이름·차트번호)"],
          ] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-1.5">
              <input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /> {label}
            </label>
          ))}
          <textarea className="w-full h-14 p-1.5 rounded border border-[#d1d1cc]" placeholder="메모(수정 요청 시 필수)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <div className="flex gap-2">
            <button className={btn} onClick={() => submit("APPROVED")}>승인</button>
            <button className="h-8 px-3 rounded text-[14px] border border-[#d1d1cc]" onClick={() => submit("CHANGES_REQUIRED")}>수정 요청</button>
          </div>
          {err && <p className="text-[#d92d20]">{err}</p>}
        </div>
      )}
      {task.reviewRequired && task.assigneeUserId === me.id && <p className="text-[12px] text-[#6f6f6a]">담당자 본인은 검수할 수 없습니다. 다른 직원에게 검수를 요청하세요.</p>}
      {reviews.length > 0 && (
        <ul className="mt-1 text-[12px] text-[#555] space-y-0.5">
          {reviews.map((r) => (
            <li key={r.id}>
              {kst(r.reviewedAt)} · {r.reviewer.name} · {r.decision === "APPROVED" ? "승인" : "수정 요청"}
              {r.note && ` · ${r.note}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
