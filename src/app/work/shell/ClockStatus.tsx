"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePopover } from "./store"

type Today = { clockInAt: string | null; clockOutAt: string | null } | null
type Presence = { workMode: "OFFICE" | "REMOTE" | string; enforced: boolean; officeOk: boolean } | null

const hm = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(11, 16)
const POLL_MS = 60_000

// 상단 바 근무 상태: "출근 09:03 · 근무 중" / "출근 전" / "퇴근 18:10". 누르면 출근·퇴근 버튼.
// 사무실 근무자가 사무실 밖에서 찍으면 서버가 403 과 안내 문구를 돌려준다 → 그대로 보여준다.
export default function ClockStatus() {
  const [today, setToday] = useState<Today>(null)
  const [presence, setPresence] = useState<Presence>(null)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  usePopover(box, open, () => setOpen(false))

  const load = useCallback(() => {
    fetch("/api/work/attendance")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return
        setToday(j.today ?? null)
        setPresence(j.presence ?? null)
        setLoaded(true)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    const onVis = () => document.visibilityState === "visible" && load()
    document.addEventListener("visibilitychange", onVis)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [load])

  const punch = async (action: "in" | "out") => {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch("/api/work/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return setMsg({ ok: false, text: j.error ?? "처리하지 못했습니다" })
      setMsg({ ok: true, text: action === "in" ? "출근을 찍었습니다" : "퇴근을 찍었습니다" })
      load()
    } finally {
      setBusy(false)
    }
  }

  const inAt = today?.clockInAt, outAt = today?.clockOutAt
  const working = !!inAt && !outAt
  const label = !loaded ? "근무 상태" : outAt ? `퇴근 ${hm(outAt)}` : inAt ? `출근 ${hm(inAt)} · 근무 중` : "출근 전"
  const dot = outAt ? "bg-[#8a8a84]" : working ? "bg-[#1a7f37]" : "bg-[#b54708]"

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`근무 상태: ${label}. 출퇴근 열기`}
        onClick={() => setOpen((v) => !v)}
        className="h-8 flex items-center gap-1.5 px-2 rounded text-[12px] text-[#3d3d3a] hover:bg-[#e9e9e5] whitespace-nowrap"
      >
        <i className={`block w-[7px] h-[7px] rounded-full ${dot}`} aria-hidden="true" />
        <span className="tabular-nums hidden md:inline">{label}</span>
      </button>
      {open && (
        <div role="dialog" aria-label="출퇴근" className="absolute right-0 top-[38px] z-50 w-[260px] bg-white border border-[#d1d1cc] rounded shadow-[0_6px_18px_rgb(0_0_0/0.12)] p-3">
          <div className="text-[13px] font-semibold text-[#0a0a0a]">오늘 근무</div>
          <dl className="mt-2 grid grid-cols-[48px_1fr] gap-y-1 text-[13px] tabular-nums">
            <dt className="text-[#6f6f6a]">출근</dt>
            <dd>{inAt ? hm(inAt) : "-"}</dd>
            <dt className="text-[#6f6f6a]">퇴근</dt>
            <dd>{outAt ? hm(outAt) : "-"}</dd>
          </dl>
          {presence && (
            <p className="mt-2 text-[12px] text-[#6f6f6a]">
              {presence.workMode === "REMOTE" ? "재택 근무(무작위 인증)" : presence.enforced ? (presence.officeOk ? "사무실 네트워크 확인됨" : "사무실 네트워크가 아닙니다") : "사무실 근무"}
            </p>
          )}
          {loaded && !presence && <p className="mt-2 text-[12px] text-[#b54708]">직원 정보가 없는 계정입니다</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || !!inAt}
              onClick={() => punch("in")}
              className="h-9 rounded bg-[#0062ff] text-white text-[13px] font-semibold disabled:bg-[#d1d1cc] disabled:text-[#8a8a84]"
            >
              출근
            </button>
            <button
              type="button"
              disabled={busy || !working}
              onClick={() => punch("out")}
              className="h-9 rounded border border-[#d1d1cc] text-[13px] font-semibold text-[#0a0a0a] disabled:text-[#b9b9b3]"
            >
              퇴근
            </button>
          </div>
          {msg && (
            <p role="status" className={`mt-2 text-[12px] ${msg.ok ? "text-[#1a7f37]" : "text-[#d92d20]"}`}>
              {msg.text}
            </p>
          )}
          <Link href="/work/attendance" prefetch={false} onClick={() => setOpen(false)} className="mt-2 block text-[12px] text-[#0062ff]">
            출퇴근 기록 보기
          </Link>
        </div>
      )}
    </div>
  )
}
