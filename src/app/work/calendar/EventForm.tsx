"use client"

import { useEffect, useState } from "react"
import { btn, EVENT_TYPES, field, type Clinic, type EditInit, type Person } from "./shared"

const VIS: Record<string, string> = { INTERNAL: "직원 공개", PRIVATE: "나·참석자만", CLINIC: "원장에게도 공개" }

export default function EventForm({ init, clinics, people, me, isMaster = false, onClose, onSaved }: {
  init: EditInit
  clinics: Clinic[]
  people: Person[]
  me: string
  isMaster?: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [f, setF] = useState({
    title: "", type: "CLINIC_MEETING", visibility: "INTERNAL", clinicId: "", publicTitle: "",
    date: init.date, endDate: init.date, allDay: !!init.allDay, startTime: init.startTime ?? "10:00", endTime: init.endTime ?? "11:00",
    location: "", internalNotes: "", participantIds: [me] as string[],
  })
  const [canEdit, setCanEdit] = useState(!init.id)
  const [loaded, setLoaded] = useState(!init.id)
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!init.id) return
    fetch(`/api/work/calendar/events/${init.id}`).then(async (r) => {
      const e = await r.json()
      if (!r.ok) return setErr(e.error ?? "불러오기 실패")
      const k = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString()
      const s = k(e.startAt), en = k(e.allDay ? new Date(new Date(e.endAt).getTime() - 1).toISOString() : e.endAt)
      setF({
        title: e.title, type: e.type, visibility: e.visibility, clinicId: e.clinicId ?? "", publicTitle: e.publicTitle ?? "",
        date: s.slice(0, 10), endDate: en.slice(0, 10), allDay: e.allDay, startTime: s.slice(11, 16), endTime: en.slice(11, 16),
        location: e.location ?? "", internalNotes: e.internalNotes ?? "",
        participantIds: e.participants.map((p: { userId: string }) => p.userId),
      })
      setCanEdit(isMaster || e.organizerUserId === me)
      setLoaded(true)
    })
  }, [init.id, me, isMaster])

  const save = async (extra?: object) => {
    setBusy(true)
    setErr("")
    const body = extra ?? { ...f, startTime: f.allDay ? null : f.startTime, endTime: f.allDay ? null : f.endTime, clinicId: f.clinicId || null }
    const r = await fetch(init.id ? `/api/work/calendar/events/${init.id}` : "/api/work/calendar/events", {
      method: init.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) return setErr(j.error ?? "저장 실패")
    onSaved()
  }
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p })
  const ro = !canEdit

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-16 px-4" onClick={onClose}>
      <div className="w-full max-w-[560px] bg-white rounded border border-[#b9b9b3]" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-2.5 border-b border-[#d1d1cc] flex items-center">
          <span className="text-[15px] font-bold">{init.id ? "일정" : "일정 추가"}</span>
          <button className="ml-auto text-[14px] text-[#6f6f6a]" onClick={onClose}>닫기</button>
        </div>
        {!loaded ? (
          <p className="p-4 text-[13px] text-[#6f6f6a]">{err || "불러오는 중…"}</p>
        ) : (
          <fieldset disabled={ro || busy} className="p-4 grid grid-cols-[80px_1fr] gap-2 items-center text-[14px]">
            <span className="text-[#6f6f6a]">제목</span>
            <input className={field} value={f.title} onChange={(e) => set({ title: e.target.value })} />
            <span className="text-[#6f6f6a]">종류</span>
            <select className={field} value={f.type} onChange={(e) => set({ type: e.target.value })}>
              {Object.entries(EVENT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <span className="text-[#6f6f6a]">치과</span>
            <select className={field} value={f.clinicId} onChange={(e) => set({ clinicId: e.target.value })}>
              <option value="">치과 없음(회사 일정)</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <span className="text-[#6f6f6a]">날짜</span>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" className={field} value={f.date} onChange={(e) => set({ date: e.target.value, endDate: e.target.value > f.endDate ? e.target.value : f.endDate })} />
              ~
              <input type="date" className={field} value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} />
              <label className="flex items-center gap-1 text-[13px]">
                <input type="checkbox" checked={f.allDay} onChange={(e) => set({ allDay: e.target.checked })} /> 종일
              </label>
            </div>
            {!f.allDay && (
              <>
                <span className="text-[#6f6f6a]">시간</span>
                <div className="flex items-center gap-2">
                  <input type="time" className={field} value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} />
                  ~
                  <input type="time" className={field} value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} />
                </div>
              </>
            )}
            <span className="text-[#6f6f6a]">장소</span>
            <input className={field} value={f.location} onChange={(e) => set({ location: e.target.value })} />
            <span className="text-[#6f6f6a]">공개</span>
            <select className={field} value={f.visibility} onChange={(e) => set({ visibility: e.target.value })}>
              {Object.entries(VIS).map(([k, v]) => (
                <option key={k} value={k} disabled={k === "CLINIC" && !f.clinicId}>{v}</option>
              ))}
            </select>
            {f.visibility === "CLINIC" && (
              <>
                <span className="text-[#6f6f6a]">원장용 제목</span>
                <input className={field} placeholder="원장님 화면에 보일 제목" value={f.publicTitle} onChange={(e) => set({ publicTitle: e.target.value })} />
              </>
            )}
            <span className="text-[#6f6f6a] self-start pt-1">참석자</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {people.map((p) => (
                <label key={p.id} className="flex items-center gap-1 text-[13px]">
                  <input
                    type="checkbox"
                    checked={f.participantIds.includes(p.id)}
                    onChange={() => set({ participantIds: f.participantIds.includes(p.id) ? f.participantIds.filter((x) => x !== p.id) : [...f.participantIds, p.id] })}
                  />
                  {p.name}
                </label>
              ))}
            </div>
            <span className="text-[#6f6f6a] self-start pt-1">내부 메모</span>
            <textarea className="min-h-[64px] p-2 rounded border border-[#d1d1cc]" value={f.internalNotes} onChange={(e) => set({ internalNotes: e.target.value })} />
          </fieldset>
        )}
        <div className="px-4 pb-4 flex items-center gap-2">
          {err && <span className="text-[13px] text-[#d92d20]">{err}</span>}
          {ro && loaded && <span className="text-[13px] text-[#6f6f6a]">만든 사람만 고칠 수 있습니다</span>}
          {!ro && loaded && init.id && (
            <button className="h-8 px-3 text-[14px] text-[#d92d20]" disabled={busy} onClick={() => save({ status: "CANCELLED" })}>일정 취소</button>
          )}
          {!ro && loaded && (
            <button className={`${btn} ml-auto`} disabled={busy || !f.title.trim()} onClick={() => save()}>저장</button>
          )}
        </div>
      </div>
    </div>
  )
}
