"use client"

import { useCallback, useEffect, useState } from "react"
import { field, btn, btnLine, card, d10, won, api, Empty } from "../ui"

type Clinic = { id: string; name: string }
type Line = { kind: string; monthlyTarget: number; defaultDueDay: number | null }
type Contract = {
  id: string
  clinicId: string
  planName: string
  monthlyFeeKrw: number
  vatTreatment: string
  startsOn: string
  endsOn: string | null
  status: string
  billDayOfMonth: number | null
  paymentDueDay: number | null
  paymentDueMonthOffset: number
  clinic: { name: string }
  lines: Line[]
}
const STATUS: Record<string, string> = { DRAFT: "작성중", ACTIVE: "진행", ENDED: "종료", TERMINATED: "해지" }
const VAT: Record<string, string> = { UNCONFIRMED: "VAT 미확인", INCLUDED: "VAT 포함", EXCLUDED: "VAT 별도" }

type Form = {
  id?: string
  clinicId: string
  planName: string
  monthlyFeeKrw: string
  vatTreatment: string
  startsOn: string
  endsOn: string
  status: string
  billDayOfMonth: string
  paymentDueDay: string
  paymentDueMonthOffset: string
  lines: Record<string, { on: boolean; target: string; due: string }>
}

export default function ContractsClient({ clinics, kinds }: { clinics: Clinic[]; kinds: Record<string, string> }) {
  const [rows, setRows] = useState<Contract[]>([])
  const [err, setErr] = useState("")
  const [form, setForm] = useState<Form | null>(null)

  const load = useCallback(async () => {
    try {
      setRows((await api<{ contracts: Contract[] }>("/api/work/contracts")).contracts)
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const blank = (): Form => ({
    clinicId: clinics[0]?.id ?? "",
    planName: "",
    monthlyFeeKrw: "",
    vatTreatment: "UNCONFIRMED",
    startsOn: new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10),
    endsOn: "",
    status: "ACTIVE",
    billDayOfMonth: "",
    paymentDueDay: "",
    paymentDueMonthOffset: "0",
    lines: Object.fromEntries(Object.keys(kinds).map((k) => [k, { on: false, target: "", due: "" }])),
  })
  const edit = (c: Contract): Form => ({
    id: c.id,
    clinicId: c.clinicId,
    planName: c.planName,
    monthlyFeeKrw: String(c.monthlyFeeKrw),
    vatTreatment: c.vatTreatment,
    startsOn: d10(c.startsOn),
    endsOn: d10(c.endsOn),
    status: c.status,
    billDayOfMonth: c.billDayOfMonth ? String(c.billDayOfMonth) : "",
    paymentDueDay: c.paymentDueDay ? String(c.paymentDueDay) : "",
    paymentDueMonthOffset: String(c.paymentDueMonthOffset),
    lines: Object.fromEntries(
      Object.keys(kinds).map((k) => {
        const l = c.lines.find((x) => x.kind === k)
        return [k, { on: !!l, target: l ? String(l.monthlyTarget) : "", due: l?.defaultDueDay ? String(l.defaultDueDay) : "" }]
      })
    ),
  })

  const save = async () => {
    if (!form) return
    setErr("")
    const json = {
      clinicId: form.clinicId,
      planName: form.planName,
      monthlyFeeKrw: Number(form.monthlyFeeKrw),
      vatTreatment: form.vatTreatment,
      startsOn: form.startsOn,
      endsOn: form.endsOn || null,
      status: form.status,
      billDayOfMonth: form.billDayOfMonth || null,
      paymentDueDay: form.paymentDueDay || null,
      paymentDueMonthOffset: Number(form.paymentDueMonthOffset),
      lines: Object.entries(form.lines)
        .filter(([, v]) => v.on)
        .map(([kind, v]) => ({ kind, monthlyTarget: Number(v.target || 0), defaultDueDay: v.due || null })),
    }
    try {
      await api(form.id ? `/api/work/contracts/${form.id}` : "/api/work/contracts", { method: form.id ? "PATCH" : "POST", json })
      setForm(null)
      load()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-[20px] font-bold">계약</h1>
        <span className="text-[13px] text-[#6f6f6a]">대표만 봅니다. 월 분량은 그 달 화면을 처음 열 때 목표로 고정됩니다.</span>
        <button className={`${btn} ml-auto`} onClick={() => setForm(blank())}>
          새 계약
        </button>
      </div>
      {err && <p className="text-[13px] text-[#d92d20]">{err}</p>}

      {form && (
        <div className={`${card} p-3 space-y-3`}>
          <div className="flex flex-wrap gap-2 items-center">
            <select className={field} value={form.clinicId} disabled={!!form.id} onChange={(e) => setForm({ ...form, clinicId: e.target.value })}>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input className={`${field} w-[180px]`} placeholder="플랜 이름 예: 플랜 2" value={form.planName} onChange={(e) => setForm({ ...form, planName: e.target.value })} />
            <input className={`${field} w-[130px]`} type="number" placeholder="월 금액(원)" value={form.monthlyFeeKrw} onChange={(e) => setForm({ ...form, monthlyFeeKrw: e.target.value })} />
            <select className={field} value={form.vatTreatment} onChange={(e) => setForm({ ...form, vatTreatment: e.target.value })}>
              {Object.entries(VAT).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 items-center text-[13px]">
            <span>시작</span>
            <input type="date" className={field} value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} />
            <span>종료</span>
            <input type="date" className={field} value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} />
            <span className="ml-3">청구일 매월</span>
            <input className={`${field} w-[56px]`} type="number" min={1} max={31} value={form.billDayOfMonth} onChange={(e) => setForm({ ...form, billDayOfMonth: e.target.value })} />
            <span>일 · 입금 예정</span>
            <select className={field} value={form.paymentDueMonthOffset} onChange={(e) => setForm({ ...form, paymentDueMonthOffset: e.target.value })}>
              <option value="0">같은 달</option>
              <option value="1">다음 달</option>
            </select>
            <input className={`${field} w-[56px]`} type="number" min={1} max={31} value={form.paymentDueDay} onChange={(e) => setForm({ ...form, paymentDueDay: e.target.value })} />
            <span>일</span>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
            {Object.entries(kinds).map(([k, label]) => {
              const l = form.lines[k]
              return (
                <label key={k} className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={l.on} onChange={(e) => setForm({ ...form, lines: { ...form.lines, [k]: { ...l, on: e.target.checked } } })} />
                  <span className="w-[96px]">{label}</span>
                  <input
                    className="h-7 w-[52px] px-1 rounded border border-[#d1d1cc]"
                    type="number"
                    min={0}
                    placeholder="월"
                    value={l.target}
                    onChange={(e) => setForm({ ...form, lines: { ...form.lines, [k]: { ...l, on: true, target: e.target.value } } })}
                  />
                  <span className="text-[#6f6f6a]">건 · 마감</span>
                  <input
                    className="h-7 w-[46px] px-1 rounded border border-[#d1d1cc]"
                    type="number"
                    min={1}
                    max={31}
                    placeholder="일"
                    value={l.due}
                    onChange={(e) => setForm({ ...form, lines: { ...form.lines, [k]: { ...l, due: e.target.value } } })}
                  />
                </label>
              )
            })}
          </div>
          <div className="flex gap-2">
            <button className={btn} onClick={save}>
              저장
            </button>
            <button className={btnLine} onClick={() => setForm(null)}>
              닫기
            </button>
          </div>
        </div>
      )}

      <div className={card}>
        {rows.length === 0 ? (
          <Empty>등록된 계약이 없습니다.</Empty>
        ) : (
          <ul className="divide-y divide-[#ecece9]">
            {rows.map((c) => (
              <li key={c.id} className="px-3 py-2.5 text-[14px] flex gap-3 items-start">
                <div className="w-[130px] shrink-0 font-medium">{c.clinic.name}</div>
                <div className="flex-1">
                  <div>
                    {c.planName} · {won(c.monthlyFeeKrw)} <span className="text-[12px] text-[#6f6f6a]">{VAT[c.vatTreatment]}</span>
                  </div>
                  <div className="text-[12px] text-[#6f6f6a]">
                    {d10(c.startsOn)} ~ {d10(c.endsOn) || "종료일 없음"}
                    {c.billDayOfMonth && ` · 청구 매월 ${c.billDayOfMonth}일 · 입금 ${c.paymentDueMonthOffset ? "다음 달" : "같은 달"} ${c.paymentDueDay ?? c.billDayOfMonth}일`}
                  </div>
                  <div className="text-[13px] mt-0.5">{c.lines.map((l) => `${kinds[l.kind]} ${l.monthlyTarget}`).join(" · ") || <span className="text-[#b0b0aa]">분량 없음</span>}</div>
                </div>
                <span className={`text-[13px] ${c.status === "ACTIVE" ? "text-[#067647]" : "text-[#6f6f6a]"}`}>{STATUS[c.status]}</span>
                <button className={`${btnLine} h-7 text-[12px]`} onClick={() => setForm(edit(c))}>
                  수정
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
