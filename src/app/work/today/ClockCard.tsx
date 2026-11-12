"use client"

import { useEffect, useState } from "react"
import { api, btn, btnLine, kst, PresenceNote, type Presence } from "../ui"

// 상단 출퇴근: 상태 한 줄 + 지금 누를 버튼 하나
export default function ClockCard() {
  const [t, setT] = useState<{ clockInAt: string | null; clockOutAt: string | null } | null>(null)
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const [presence, setPresence] = useState<Presence>(null)
  const load = () =>
    api<{ today: typeof t; presence: Presence }>("/api/work/attendance")
      .then((j) => {
        setT(j.today ?? { clockInAt: null, clockOutAt: null })
        setPresence(j.presence)
      })
      .catch((e) => setErr(e.message))
  useEffect(() => {
    load()
    const onFocus = () => document.visibilityState === "visible" && load()
    document.addEventListener("visibilitychange", onFocus)
    return () => document.removeEventListener("visibilitychange", onFocus)
  }, [])
  const hit = async (action: "in" | "out") => {
    setErr("")
    setBusy(true)
    try {
      await api("/api/work/attendance", { method: "POST", json: { action } })
      await load()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const inAt = t?.clockInAt ? kst(t.clockInAt).slice(11) : null
  const outAt = t?.clockOutAt ? kst(t.clockOutAt).slice(11) : null
  const state = !t ? "확인 중" : outAt ? `퇴근 ${outAt}` : inAt ? "근무 중" : "출근 전"
  return (
    <div className="flex items-center gap-2">
      <div className="text-[13px] leading-tight text-right">
        <div>
          {inAt && <span className="tabular-nums">출근 {inAt} · </span>}
          <b className={outAt ? "text-[#6f6f6a]" : inAt ? "text-[#1a7f37]" : "text-[#b54708]"}>{state}</b>
        </div>
        <div className="max-w-[320px] truncate">
          <PresenceNote p={presence} />
        </div>
        {err && <div className="text-[12px] text-[#d92d20]">{err}</div>}
      </div>
      {t && !inAt && (
        <button className={btn} disabled={busy} onClick={() => hit("in")}>
          출근
        </button>
      )}
      {t && inAt && !outAt && (
        <button className={btnLine} disabled={busy} onClick={() => hit("out")}>
          퇴근
        </button>
      )}
    </div>
  )
}
