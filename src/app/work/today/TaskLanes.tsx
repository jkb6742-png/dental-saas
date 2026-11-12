"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { TaskDrawer } from "../tasks/TasksClient"
import type { HomeTask } from "./data"

const STATUS: Record<string, string> = { TODO: "할 일", BLOCKED: "자료 대기", IN_PROGRESS: "진행중", IN_REVIEW: "검토중" }
const BUCKET: Record<HomeTask["bucket"], { label: string; tone: string }> = {
  overdue: { label: "마감 지남", tone: "text-[#d92d20]" },
  today: { label: "오늘 마감", tone: "text-[#0062ff]" },
  week: { label: "이번 주", tone: "text-[#6f6f6a]" },
}
const WEEK = ["일", "월", "화", "수", "목", "금", "토"]

function dueText(due: string | null, today: string) {
  if (!due) return { text: "", late: false }
  const diff = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400_000)
  if (diff < 0) return { text: `${-diff}일 지연`, late: true }
  if (diff === 0) return { text: "오늘", late: false }
  if (diff === 1) return { text: "내일", late: false }
  const d = new Date(`${due}T00:00:00Z`)
  return { text: `${d.getUTCMonth() + 1}.${d.getUTCDate()}(${WEEK[d.getUTCDay()]})`, late: false }
}

async function patch(id: string, json: Record<string, unknown>) {
  const r = await fetch(`/api/work/tasks/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(json) })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "변경하지 못했습니다")
}

// 내가 처리할 업무: 지연 → 오늘 → 이번 주. 체크 = 완료(검수 필요 업무는 검토 요청), 제목 = 상세.
export default function TaskLanes({ tasks, today, limit = 8, me }: { tasks: HomeTask[]; today: string; limit?: number; me: { id: string; name: string } }) {
  const router = useRouter()
  const [checked, setChecked] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Record<string, string>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [err, setErr] = useState("")

  const check = async (t: HomeTask) => {
    setErr("")
    const cur = status[t.id] ?? t.status
    const next = t.reviewRequired && cur !== "IN_REVIEW" ? "IN_REVIEW" : "DONE"
    setChecked((c) => ({ ...c, [t.id]: next }))
    try {
      await patch(t.id, { status: next })
      setTimeout(() => router.refresh(), 700)
    } catch (e) {
      setChecked((c) => {
        const n = { ...c }
        delete n[t.id]
        return n
      })
      setErr((e as Error).message)
    }
  }
  const change = async (t: HomeTask, s: string) => {
    setErr("")
    const prev = status[t.id] ?? t.status
    setStatus((m) => ({ ...m, [t.id]: s }))
    try {
      await patch(t.id, { status: s })
      router.refresh()
    } catch (e) {
      setStatus((m) => ({ ...m, [t.id]: prev }))
      setErr((e as Error).message)
    }
  }

  const shown = tasks.slice(0, limit)
  let lastBucket = ""
  return (
    <div>
      {err && <p className="px-4 pt-2 text-[13px] text-[#d92d20]">{err}</p>}
      <ul>
        {shown.map((t) => {
          const head = t.bucket !== lastBucket ? BUCKET[t.bucket] : null
          lastBucket = t.bucket
          const c = checked[t.id]
          const d = dueText(t.due, today)
          const cur = status[t.id] ?? t.status
          return (
            <li key={t.id}>
              {head && <div className={`px-4 pt-2.5 pb-1 text-[12px] font-semibold ${head.tone}`}>{head.label}</div>}
              <div className="mx-2 flex items-center gap-3 rounded px-2 py-1.5 hover:bg-[#fafaf8]">
                <input
                  type="checkbox"
                  aria-label={t.reviewRequired ? `${t.title} 검토 요청` : `${t.title} 완료`}
                  title={t.reviewRequired && cur !== "IN_REVIEW" ? "검수 필요 업무: 체크하면 검토 요청" : "완료"}
                  className="w-4 h-4 shrink-0 accent-[#1a7f37]"
                  checked={!!c}
                  disabled={!!c}
                  onChange={() => check(t)}
                />
                <button onClick={() => setOpenId(t.id)} className={`min-w-0 flex-1 text-left ${c === "DONE" ? "line-through text-[#9a9a94]" : ""}`}>
                  <span className="block text-[14px] truncate">
                    {t.high && <span className="mr-1 text-[#d92d20]">긴급</span>}
                    {t.title}
                  </span>
                  <span className="block text-[12px] text-[#8a8a84] truncate">
                    {t.where}
                    {t.reviewRequired && " · 검수 필요"}
                    {c === "IN_REVIEW" && <span className="text-[#b54708]"> · 검토 요청함</span>}
                  </span>
                </button>
                <select
                  aria-label="상태"
                  value={cur}
                  onChange={(e) => change(t, e.target.value)}
                  disabled={!!c}
                  className="h-7 w-[84px] shrink-0 rounded border border-transparent bg-transparent px-1 text-[12px] text-[#555555] hover:border-[#d1d1cc]"
                >
                  {Object.entries(STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <span className={`w-[64px] shrink-0 text-right text-[12px] tabular-nums ${d.late ? "text-[#d92d20]" : "text-[#8a8a84]"}`}>{d.text}</span>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="h-10 px-4 flex items-center border-t border-[#ecece9] text-[13px]">
        {tasks.length > limit && <span className="text-[#8a8a84]">외 {tasks.length - limit}건</span>}
        <Link href="/work/tasks?assignee=me" prefetch={false} className="ml-auto text-[#0062ff] hover:underline">
          전체 업무 보기 →
        </Link>
      </div>
      {openId && <TaskDrawer id={openId} me={me} onClose={() => setOpenId(null)} onChanged={() => router.refresh()} />}
    </div>
  )
}
