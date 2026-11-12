"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type Shown = { id: string; qr: string; matchCode: string; tokenExpiresAt: string; deadlineAt: string; shownAt: string }

// 재택 근무자 PC: 30초마다 서버에 묻고, 인증 시각이 되면 QR 알림창을 띄운다.
// 시각은 서버가 무작위로 정하고 미리 알려 주지 않는다. QR은 짧게 유효하고, 만료되면 유예 시간 안에서 새 QR로 바뀐다.
export default function RemoteCheckPopup() {
  const [check, setCheck] = useState<Shown | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [ended, setEnded] = useState<string | null>(null)
  const current = useRef<Shown | null>(null)
  const inflight = useRef(false)
  current.current = check

  // fresh=true: 지금 QR이 만료돼 새 QR을 받는다
  const poll = useCallback(async (fresh = false) => {
    if (inflight.current) return
    inflight.current = true
    const id = current.current?.id
    const q = id ? `?have=${fresh ? "" : id}&prev=${id}` : ""
    const j = await fetch(`/api/work/remote-check${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
    inflight.current = false
    if (!j) return
    if (!j.check) {
      if (current.current) setEnded(j.ended ?? "VERIFIED")
      setCheck(null)
      return
    }
    if (j.check.keep) return
    const first = !current.current
    setCheck(j.check)
    if (first) {
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted")
          new Notification("재택 근무 확인", { body: "화면의 QR을 휴대폰으로 찍어 주세요." })
      } catch {}
    }
  }, [])

  useEffect(() => {
    poll()
    const t = setInterval(() => poll(), 30_000)
    const onVis = () => document.visibilityState === "visible" && poll()
    document.addEventListener("visibilitychange", onVis)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [poll])

  // 표시 중에는 1초마다 남은 시간 갱신, 인증 확인은 5초마다
  useEffect(() => {
    if (!check) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const fast = setInterval(() => poll(), 5000)
    return () => {
      clearInterval(tick)
      clearInterval(fast)
    }
  }, [check, poll])

  // QR 만료 → 새 QR
  useEffect(() => {
    if (check && now >= new Date(check.tokenExpiresAt).getTime() && now < new Date(check.deadlineAt).getTime()) poll(true)
    if (check && now >= new Date(check.deadlineAt).getTime()) poll(true)
  }, [now, check, poll])

  useEffect(() => {
    if (!ended) return
    const t = setTimeout(() => setEnded(null), ended === "VERIFIED" ? 4000 : 15000)
    return () => clearTimeout(t)
  }, [ended])

  if (!check)
    return ended ? (
      <div role="status" className="fixed bottom-4 right-4 z-[60] bg-white border border-[#d1d1cc] rounded px-4 py-3 text-[14px] shadow-[0_6px_18px_rgb(0_0_0/0.12)]">
        {ended === "VERIFIED" ? "재택 근무 확인이 끝났습니다" : "확인 시간이 지나 미인증으로 기록되었습니다. 사유는 대표에게 알려 주세요."}
      </div>
    ) : null

  return <RemoteCheckModal qr={check.qr} matchCode={check.matchCode} qrLeft={Math.max(0, Math.ceil((new Date(check.tokenExpiresAt).getTime() - now) / 1000))} left={Math.max(0, Math.ceil((new Date(check.deadlineAt).getTime() - now) / 1000))} />
}

/** QR 알림창 모양(실제 인증·대표 미리보기 공용) */
export function RemoteCheckModal({ qr, matchCode, qrLeft, left, preview, onClose }: { qr: string; matchCode: string; qrLeft: number; left: number; preview?: boolean; onClose?: () => void }) {
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="rc-title">
      <div className="bg-white rounded border border-[#d1d1cc] w-full max-w-[360px] p-5 shadow-[0_12px_32px_rgb(0_0_0/0.18)]">
        <h2 id="rc-title" className="text-[17px] font-bold">
          재택 근무 확인{preview && <span className="ml-2 text-[12px] font-normal text-[#b54708]">미리보기 · 기록되지 않음</span>}
        </h2>
        <p className="mt-1 text-[13px] text-[#6f6f6a]">휴대폰 카메라로 QR을 찍고, 휴대폰에서 아래 숫자를 누르세요.</p>
        <div className="mt-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="재택 근무 확인 QR" width={220} height={220} className="border border-[#ecece9]" />
        </div>
        <div className="mt-4 text-center">
          <div className="text-[12px] text-[#6f6f6a]">휴대폰에서 고를 숫자</div>
          <div className="text-[40px] font-bold tracking-[0.08em] leading-tight">{matchCode}</div>
        </div>
        <div className="mt-3 flex justify-between text-[12px] text-[#6f6f6a] border-t border-[#ecece9] pt-3">
          <span>QR 새로 바뀜 {qrLeft}초</span>
          <span>남은 시간 {mmss(left)}</span>
        </div>
        {preview && onClose && (
          <div className="mt-3 flex justify-end">
            <button className="h-8 px-3 rounded text-[14px] border border-[#d1d1cc] bg-white hover:bg-[#ecece9]" onClick={onClose}>
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
