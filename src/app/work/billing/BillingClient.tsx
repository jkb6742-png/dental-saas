"use client"

import { useCallback, useEffect, useState } from "react"
import { field, btn, btnLine, card, d10, won, api, Empty, Th, Td } from "../ui"

type Cycle = {
  id: string
  clinicId: string
  serviceMonth: string
  plannedBillOn: string
  dueOn: string
  amountDueKrw: number
  billedAt: string | null
  taxInvoiceIssuedAt: string | null
  taxInvoiceNumber: string | null
  voidedAt: string | null
  memo: string | null
  paid: number
  state: string
  clinic: { name: string }
  contract: { planName: string }
  receipts: { id: string; receivedOn: string; amountKrw: number; memo: string | null; recordedBy: { name: string } }[]
}
const STATE: Record<string, string> = { VOID: "취소", PAID: "입금 완료", PARTIAL: "일부 입금", OVERDUE: "연체", DUE: "입금 대기", PLANNED: "청구 전" }
const STATE_COLOR: Record<string, string> = { OVERDUE: "text-[#d92d20]", PAID: "text-[#067647]", VOID: "text-[#b0b0aa]" }

export default function BillingClient({ initialMonth }: { initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth)
  const [rows, setRows] = useState<Cycle[]>([])
  const [err, setErr] = useState("")
  const [pay, setPay] = useState<{ id: string; amount: string; on: string; memo: string } | null>(null)
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

  const load = useCallback(async () => {
    try {
      setRows((await api<{ cycles: Cycle[] }>(`/api/work/billing?month=${month}`)).cycles)
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [month])
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
  const patch = (id: string, json: object) => act(() => api(`/api/work/billing/${id}`, { method: "PATCH", json }))

  const live = rows.filter((r) => !r.voidedAt)
  const total = live.reduce((s, r) => s + r.amountDueKrw, 0)
  const paid = live.reduce((s, r) => s + Math.min(r.paid, r.amountDueKrw), 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[20px] font-bold mr-2">청구·입금</h1>
        <input type="month" className={field} value={month} onChange={(e) => setMonth(e.target.value)} />
        <span className="text-[13px] text-[#6f6f6a] ml-2">
          청구 {won(total)} · 입금 {won(paid)} · 미수 <b className={total - paid > 0 ? "text-[#d92d20]" : ""}>{won(total - paid)}</b>
        </span>
      </div>
      {err && <p className="text-[13px] text-[#d92d20]">{err}</p>}

      <div className={card}>
        {rows.length === 0 ? (
          <Empty>이 달 청구가 없습니다. 계약에 청구일을 넣으면 달마다 자동으로 생깁니다.</Empty>
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr>
                <Th>치과·플랜</Th>
                <Th className="w-[110px] text-right">청구액</Th>
                <Th className="w-[90px]">청구일</Th>
                <Th className="w-[90px]">입금 예정</Th>
                <Th className="w-[80px]">청구</Th>
                <Th className="w-[150px]">세금계산서</Th>
                <Th className="w-[110px] text-right">입금</Th>
                <Th className="w-[80px]">상태</Th>
                <Th className="w-[120px]"></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={c.voidedAt ? "text-[#b0b0aa]" : ""}>
                  <Td>
                    <div className="font-medium">{c.clinic.name}</div>
                    <div className="text-[12px] text-[#6f6f6a]">{c.contract.planName}</div>
                    {c.receipts.map((r) => (
                      <div key={r.id} className="text-[12px] text-[#6f6f6a]">
                        {d10(r.receivedOn)} {won(r.amountKrw)} {r.memo ?? ""}{" "}
                        <button className="underline" onClick={() => act(() => api(`/api/work/billing/${c.id}/payments?paymentId=${r.id}`, { method: "DELETE" }))}>
                          지우기
                        </button>
                      </div>
                    ))}
                  </Td>
                  <Td className="text-right tabular-nums">{won(c.amountDueKrw)}</Td>
                  <Td className={!c.billedAt && d10(c.plannedBillOn) <= today ? "text-[#d92d20]" : ""}>{d10(c.plannedBillOn).slice(5)}</Td>
                  <Td>
                    <input type="date" className="h-7 px-1 rounded border border-[#d1d1cc] text-[12px] w-[112px]" defaultValue={d10(c.dueOn)} onBlur={(e) => e.target.value !== d10(c.dueOn) && patch(c.id, { dueOn: e.target.value })} />
                  </Td>
                  <Td>
                    <label className="flex items-center gap-1 text-[13px]">
                      <input type="checkbox" checked={!!c.billedAt} onChange={(e) => patch(c.id, { billed: e.target.checked })} />
                      {c.billedAt ? "청구함" : "전"}
                    </label>
                  </Td>
                  <Td>
                    <label className="flex items-center gap-1 text-[13px]">
                      <input
                        type="checkbox"
                        checked={!!c.taxInvoiceIssuedAt}
                        onChange={(e) => patch(c.id, { taxInvoice: e.target.checked, taxInvoiceNumber: e.target.checked ? (document.getElementById(`tax-${c.id}`) as HTMLInputElement)?.value : null })}
                      />
                      <input id={`tax-${c.id}`} className="h-7 px-1 rounded border border-[#d1d1cc] text-[12px] w-[110px]" placeholder="승인번호" defaultValue={c.taxInvoiceNumber ?? ""} />
                    </label>
                  </Td>
                  <Td className="text-right tabular-nums">{won(c.paid)}</Td>
                  <Td className={`text-[13px] ${STATE_COLOR[c.state] ?? ""}`}>{STATE[c.state]}</Td>
                  <Td>
                    <div className="flex gap-1 justify-end">
                      {!c.voidedAt && c.state !== "PAID" && (
                        <button className={`${btnLine} h-7 text-[12px]`} onClick={() => setPay({ id: c.id, amount: String(c.amountDueKrw - c.paid), on: today, memo: "" })}>
                          입금
                        </button>
                      )}
                      <button className={`${btnLine} h-7 text-[12px]`} onClick={() => patch(c.id, { void: !c.voidedAt })}>
                        {c.voidedAt ? "되살림" : "취소"}
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pay && (
          <div className="p-3 border-t border-[#ecece9] flex flex-wrap gap-2 items-center">
            <span className="text-[13px]">입금 기록</span>
            <input type="date" className={field} value={pay.on} onChange={(e) => setPay({ ...pay, on: e.target.value })} />
            <input type="number" className={`${field} w-[130px]`} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
            <input className={`${field} w-[200px]`} placeholder="메모(입금자명 등)" value={pay.memo} onChange={(e) => setPay({ ...pay, memo: e.target.value })} />
            <button
              className={btn}
              onClick={() =>
                act(async () => {
                  await api(`/api/work/billing/${pay.id}/payments`, { method: "POST", json: { amountKrw: Number(pay.amount), receivedOn: pay.on, memo: pay.memo } })
                  setPay(null)
                })
              }
            >
              저장
            </button>
            <button className={btnLine} onClick={() => setPay(null)}>
              닫기
            </button>
          </div>
        )}
      </div>
      <p className="text-[12px] text-[#6f6f6a]">결제일 알림: 청구일 당일, 입금 예정 3일 전·당일·1일 지남·7일 지남에 대표에게 앱 알림과 메일이 갑니다(입금 완료·취소 건 제외).</p>
    </div>
  )
}
