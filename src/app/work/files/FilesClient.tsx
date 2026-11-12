"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { field, btn, btnLine, card, kst, bytes, api, Empty, Th, Td } from "../ui"

type Clinic = { id: string; name: string }
type Version = { id: string; versionNo: number; originalName: string; mimeType: string; byteSize: number; createdAt: string; uploadedBy: { name: string } }
type SFile = {
  id: string
  clinicId: string | null
  visibility: "INTERNAL" | "CLINIC"
  title: string
  currentVersion: number
  publishedAt: string | null
  updatedAt: string
  clinic: { name: string } | null
  uploadedBy: { name: string }
  task: { title: string } | null
  versions: Version[]
}

export default function FilesClient({ clinics, taskId, clinicId: fixedClinic }: { clinics: Clinic[]; taskId?: string; clinicId?: string }) {
  const [files, setFiles] = useState<SFile[]>([])
  const [filter, setFilter] = useState({ clinicId: fixedClinic ?? "", visibility: "", q: "" })
  const [err, setErr] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const compact = !!taskId

  const load = useCallback(async () => {
    const q = new URLSearchParams(Object.entries({ ...filter, taskId: taskId ?? "" }).filter(([, v]) => v))
    try {
      setFiles((await api<{ files: SFile[] }>(`/api/work/files?${q}`)).files)
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [filter, taskId])
  useEffect(() => {
    load()
  }, [load])

  const act = async (fn: () => Promise<unknown>) => {
    setErr("")
    try {
      await fn()
      await load()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[20px] font-bold mr-2">파일 공유</h1>
          {!fixedClinic && (
            <select className={field} value={filter.clinicId} onChange={(e) => setFilter({ ...filter, clinicId: e.target.value })}>
              <option value="">전체</option>
              <option value="none">회사 공통</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <select className={field} value={filter.visibility} onChange={(e) => setFilter({ ...filter, visibility: e.target.value })}>
            <option value="">공개 범위 전체</option>
            <option value="CLINIC">원장 공개</option>
            <option value="INTERNAL">직원만</option>
          </select>
          <input className={field} placeholder="제목 검색" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        </div>
      )}

      <Uploader clinics={clinics} fixedClinic={fixedClinic} taskId={taskId} onDone={load} />
      {err && <p className="text-[13px] text-[#d92d20]">{err}</p>}

      <div className={card}>
        {files.length === 0 ? (
          <Empty>올린 파일이 없습니다.</Empty>
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr>
                {!fixedClinic && <Th className="w-[120px]">치과</Th>}
                <Th>제목</Th>
                <Th className="w-[110px]">공개</Th>
                <Th className="w-[70px]">버전</Th>
                <Th className="w-[150px]">올린 사람·시각</Th>
                <Th className="w-[210px]"></Th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <FileRow key={f.id} f={f} showClinic={!fixedClinic} open={open === f.id} onToggle={() => setOpen(open === f.id ? null : f.id)} act={act} />
              ))}
            </tbody>
          </table>
        )}
      </div>
      {!compact && <p className="text-[12px] text-[#6f6f6a]">원장 공개로 올린 파일은 그 치과 원장 화면의 &lsquo;자료실&rsquo;에 바로 보이고 알림이 갑니다. 올리기·공개·삭제는 모두 기록됩니다.</p>}
    </div>
  )
}

function Uploader({ clinics, fixedClinic, taskId, onDone }: { clinics: Clinic[]; fixedClinic?: string; taskId?: string; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [f, setF] = useState({ clinicId: fixedClinic ?? clinics[0]?.id ?? "", title: "", visibility: "INTERNAL" })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const submit = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return setErr("파일을 선택하세요")
    const fd = new FormData()
    fd.set("file", file)
    if (f.clinicId) fd.set("clinicId", f.clinicId)
    if (f.title) fd.set("title", f.title)
    fd.set("visibility", f.clinicId ? f.visibility : "INTERNAL")
    if (taskId) fd.set("taskId", taskId)
    setBusy(true)
    setErr("")
    try {
      await api("/api/work/files", { method: "POST", body: fd })
      setF({ ...f, title: "" })
      if (fileRef.current) fileRef.current.value = ""
      onDone()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={`${card} p-3 flex flex-wrap items-center gap-2`}>
      <input ref={fileRef} type="file" className="text-[13px] max-w-[260px]" />
      {!fixedClinic && (
        <select className={field} value={f.clinicId} onChange={(e) => setF({ ...f, clinicId: e.target.value })}>
          <option value="">회사 공통(직원만)</option>
          {clinics.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
      <input className={`${field} flex-1 min-w-[180px]`} placeholder="제목(비우면 파일 이름)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <select className={field} value={f.visibility} disabled={!f.clinicId} onChange={(e) => setF({ ...f, visibility: e.target.value })}>
        <option value="INTERNAL">직원만</option>
        <option value="CLINIC">원장에게 공개</option>
      </select>
      <button className={btn} disabled={busy} onClick={submit}>
        {busy ? "올리는 중…" : "올리기"}
      </button>
      {err && <span className="text-[13px] text-[#d92d20]">{err}</span>}
    </div>
  )
}

function FileRow({ f, showClinic, open, onToggle, act }: { f: SFile; showClinic: boolean; open: boolean; onToggle: () => void; act: (fn: () => Promise<unknown>) => void }) {
  const verRef = useRef<HTMLInputElement>(null)
  const latest = f.versions[0]
  const newVersion = () => {
    const file = verRef.current?.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set("file", file)
    act(() => api(`/api/work/files/${f.id}/versions`, { method: "POST", body: fd }))
  }
  return (
    <>
      <tr>
        {showClinic && <Td className="text-[#6f6f6a]">{f.clinic?.name ?? "회사 공통"}</Td>}
        <Td>
          <a className="hover:underline" href={`/api/work/files/${f.id}/download?inline=1`} target="_blank" rel="noreferrer">
            {f.title}
          </a>
          <div className="text-[12px] text-[#6f6f6a]">
            {latest?.originalName} · {latest ? bytes(latest.byteSize) : ""}
            {f.task && <> · 업무: {f.task.title}</>}
          </div>
        </Td>
        <Td>
          {f.clinicId ? (
            <select
              className={`${field} h-7 text-[13px] ${f.visibility === "CLINIC" ? "text-[#1d4ed8]" : ""}`}
              value={f.visibility}
              onChange={(e) => act(() => api(`/api/work/files/${f.id}`, { method: "PATCH", json: { visibility: e.target.value } }))}
            >
              <option value="INTERNAL">직원만</option>
              <option value="CLINIC">원장 공개</option>
            </select>
          ) : (
            <span className="text-[13px] text-[#6f6f6a]">직원만</span>
          )}
        </Td>
        <Td>
          <button className="text-[13px] underline" onClick={onToggle}>
            v{f.currentVersion}
          </button>
        </Td>
        <Td className="text-[13px]">
          {latest?.uploadedBy.name}
          <div className="text-[12px] text-[#6f6f6a]">{kst(f.updatedAt)}</div>
        </Td>
        <Td>
          <div className="flex gap-1 justify-end">
            <a className={`${btnLine} h-7 leading-7 text-[13px]`} href={`/api/work/files/${f.id}/download`}>
              받기
            </a>
            <label className={`${btnLine} h-7 leading-7 text-[13px] cursor-pointer`}>
              새 버전
              <input ref={verRef} type="file" className="hidden" onChange={newVersion} />
            </label>
            <button
              className={`${btnLine} h-7 text-[13px] text-[#d92d20]`}
              onClick={() => confirmDelete(f.title) && act(() => api(`/api/work/files/${f.id}`, { method: "DELETE" }))}
            >
              삭제
            </button>
          </div>
        </Td>
      </tr>
      {open && (
        <tr>
          <td colSpan={showClinic ? 6 : 5} className="bg-[#fafaf8] px-3 py-2 border-b border-[#ecece9]">
            {f.versions.map((v) => (
              <div key={v.id} className="text-[13px] flex gap-3 py-0.5">
                <a className="underline w-[40px]" href={`/api/work/files/${f.id}/download?v=${v.versionNo}`}>
                  v{v.versionNo}
                </a>
                <span className="flex-1 truncate">{v.originalName}</span>
                <span className="text-[#6f6f6a]">{bytes(v.byteSize)}</span>
                <span className="text-[#6f6f6a] w-[60px]">{v.uploadedBy.name}</span>
                <span className="text-[#6f6f6a] w-[120px]">{kst(v.createdAt)}</span>
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  )
}

// 삭제 확인은 브라우저 대화상자 대신 두 번 누르기로(자동화 도구가 막히지 않게)
const pending = new Map<string, number>()
function confirmDelete(key: string) {
  const at = pending.get(key)
  if (at && Date.now() - at < 4000) {
    pending.delete(key)
    return true
  }
  pending.set(key, Date.now())
  alertSoft("한 번 더 누르면 삭제됩니다")
  return false
}
function alertSoft(msg: string) {
  const el = document.createElement("div")
  el.textContent = msg
  el.className = "fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#191f28] text-white text-[13px] px-3 py-2 rounded z-50"
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2500)
}
