"use client"

import { useCallback, useEffect, useState } from "react"
import { field, btn, card, d10, won, api, Empty, Th, Td } from "../ui"

type Opp = {
  id: string
  clinicName: string
  stage: string
  contactPerson: string | null
  contactValue: string | null
  region: string | null
  proposalUrl: string | null
  expectedMonthlyFeeKrw: number | null
  nextActionOn: string | null
  nextAction: string | null
  lostReason: string | null
  clinicId: string | null
  owner: { name: string } | null
}

export default function SalesClient({ stages, clinics }: { stages: Record<string, string>; clinics: { id: string; name: string }[] }) {
  const [items, setItems] = useState<Opp[]>([])
  const [err, setErr] = useState("")
  const [showClosed, setShowClosed] = useState(false)
  const [f, setF] = useState({ clinicName: "", region: "", contactPerson: "", contactValue: "", expectedMonthlyFeeKrw: "", nextActionOn: "", nextAction: "" })
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: Opp[] }>("/api/work/sales")).items)
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [])
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
  const patch = (id: string, json: object) => act(() => api(`/api/work/sales/${id}`, { method: "PATCH", json }))
  const open = items.filter((i) => showClosed || !["WON", "LOST"].includes(i.stage))
  const pipeline = items.filter((i) => !["WON", "LOST"].includes(i.stage)).reduce((s, i) => s + (i.expectedMonthlyFeeKrw ?? 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-[20px] font-bold">영업</h1>
        <span className="text-[13px] text-[#6f6f6a]">진행 중 예상 월 매출 {won(pipeline)}</span>
        <label className="ml-auto text-[13px] flex items-center gap-1">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> 계약·무산 포함
        </label>
      </div>
      <div className={`${card} p-3 flex flex-wrap gap-2`}>
        <input className={`${field} w-[160px]`} placeholder="치과 이름" value={f.clinicName} onChange={(e) => setF({ ...f, clinicName: e.target.value })} />
        <input className={`${field} w-[110px]`} placeholder="지역" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
        <input className={`${field} w-[100px]`} placeholder="담당자" value={f.contactPerson} onChange={(e) => setF({ ...f, contactPerson: e.target.value })} />
        <input className={`${field} w-[140px]`} placeholder="연락처" value={f.contactValue} onChange={(e) => setF({ ...f, contactValue: e.target.value })} />
        <input className={`${field} w-[120px]`} type="number" placeholder="예상 월 금액" value={f.expectedMonthlyFeeKrw} onChange={(e) => setF({ ...f, expectedMonthlyFeeKrw: e.target.value })} />
        <input type="date" className={field} value={f.nextActionOn} onChange={(e) => setF({ ...f, nextActionOn: e.target.value })} />
        <input className={`${field} flex-1 min-w-[160px]`} placeholder="다음 할 일" value={f.nextAction} onChange={(e) => setF({ ...f, nextAction: e.target.value })} />
        <button
          className={btn}
          onClick={() =>
            act(async () => {
              await api("/api/work/sales", { method: "POST", json: f })
              setF({ clinicName: "", region: "", contactPerson: "", contactValue: "", expectedMonthlyFeeKrw: "", nextActionOn: "", nextAction: "" })
            })
          }
        >
          등록
        </button>
      </div>
      {err && <p className="text-[13px] text-[#d92d20]">{err}</p>}
      <div className={card}>
        {open.length === 0 ? (
          <Empty>영업 기회가 없습니다.</Empty>
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr>
                <Th>치과</Th>
                <Th className="w-[110px]">단계</Th>
                <Th className="w-[110px] text-right">예상 월</Th>
                <Th className="w-[120px]">다음 할 일 날짜</Th>
                <Th>다음 할 일</Th>
              </tr>
            </thead>
            <tbody>
              {open.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <div className="font-medium">{o.clinicName}</div>
                    <div className="text-[12px] text-[#6f6f6a]">
                      {[o.region, o.contactPerson, o.contactValue].filter(Boolean).join(" · ")}
                      {o.lostReason && ` · 무산: ${o.lostReason}`}
                    </div>
                    {o.stage === "WON" && (
                      <select className="mt-1 h-7 px-1 rounded border border-[#d1d1cc] text-[12px]" value={o.clinicId ?? ""} onChange={(e) => patch(o.id, { clinicId: e.target.value || null })}>
                        <option value="">연결할 치과 고르기</option>
                        {clinics.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </Td>
                  <Td>
                    <select
                      className="h-7 px-1 rounded border border-[#d1d1cc] text-[13px]"
                      value={o.stage}
                      onChange={(e) => {
                        const stage = e.target.value
                        if (stage === "LOST") {
                          const reason = (document.getElementById(`lost-${o.id}`) as HTMLInputElement | null)?.value || "사유 미입력"
                          patch(o.id, { stage, lostReason: reason })
                        } else patch(o.id, { stage })
                      }}
                    >
                      {Object.entries(stages).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <input id={`lost-${o.id}`} className="mt-1 h-6 w-full px-1 rounded border border-[#ecece9] text-[11px]" placeholder="무산 사유" defaultValue={o.lostReason ?? ""} />
                  </Td>
                  <Td className="text-right tabular-nums">{o.expectedMonthlyFeeKrw ? won(o.expectedMonthlyFeeKrw) : "-"}</Td>
                  <Td>
                    <input
                      type="date"
                      className={`h-7 px-1 rounded border border-[#d1d1cc] text-[12px] ${o.nextActionOn && d10(o.nextActionOn) < today ? "text-[#d92d20]" : ""}`}
                      defaultValue={d10(o.nextActionOn)}
                      onBlur={(e) => e.target.value !== d10(o.nextActionOn) && patch(o.id, { nextActionOn: e.target.value || null })}
                    />
                  </Td>
                  <Td>
                    <input className="h-7 w-full px-1 rounded border border-[#d1d1cc] text-[13px]" defaultValue={o.nextAction ?? ""} onBlur={(e) => e.target.value !== (o.nextAction ?? "") && patch(o.id, { nextAction: e.target.value })} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
