"use client"

import { useState } from "react"

export default function CheckClient({ token, choices }: { token: string; choices: string[] }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle")
  const [err, setErr] = useState("")
  const pick = async (n: string) => {
    setState("busy")
    setErr("")
    const r = await fetch("/api/work/remote-check/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, pick: n }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok) setState("done")
    else {
      setErr(j.error ?? "인증하지 못했습니다")
      setState("idle")
    }
  }
  if (state === "done")
    return (
      <div className="mt-6">
        <p className="text-[17px] font-semibold">확인되었습니다</p>
        <p className="mt-1 text-[13px] text-[#6f6f6a]">컴퓨터 화면의 알림은 곧 닫힙니다. 이 창은 닫아도 됩니다.</p>
      </div>
    )
  return (
    <div className="mt-6">
      <p className="text-[15px]">컴퓨터 화면에 보이는 숫자를 누르세요.</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {choices.map((n) => (
          <button
            key={n}
            type="button"
            disabled={state === "busy" || !!err}
            onClick={() => pick(n)}
            className="h-16 rounded border border-[#b9b9b3] bg-white text-[24px] font-semibold active:bg-[#e8f0ff] disabled:opacity-40"
          >
            {n}
          </button>
        ))}
      </div>
      {err && <p className="mt-4 text-[14px] text-[#d92d20] leading-relaxed">{err}</p>}
    </div>
  )
}
