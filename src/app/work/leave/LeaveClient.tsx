"use client"

import { useCallback, useEffect, useState } from "react"
import { field, btn, btnLine, card, d10, api, Empty, Th, Td } from "../ui"

type Req = { id: string; startOn: string; endOn: string; unit: string; requestedDays: string; status: string; decisionNote: string | null; employee?: { user: { name: string } } }
type Ledger = { id: string; type: string; deltaDays: string; effectiveOn: string; expiresOn: string | null; note: string | null }
type Data = {
  userId: string
  mine: { balance: number; pending: number; hiredOn: string; ledger: Ledger[]; requests: Req[] } | null
  team: { employees: { userId: string; name: string; hiredOn: string; balance: number; pending: number }[]; pending: Req[] } | null
}
const UNIT: Record<string, string> = { FULL: "연차", HALF_AM: "오전 반차", HALF_PM: "오후 반차" }
const STATUS: Record<string, string> = { PENDING: "대기", APPROVED: "승인", REJECTED: "반려", CANCELLED: "취소" }
const TYPE: Record<string, string> = { GRANT: "발생", USE: "사용", EXPIRE: "소멸", ADJUST: "조정", REVERSAL: "취소 환원" }
const range = (r: Req) => (r.startOn === r.endOn ? d10(r.startOn) : `${d10(r.startOn)} ~ ${d10(r.endOn)}`)
const days = (v: string | number) => `${Number(v)}일`

export default function LeaveClient({ isMaster, meId }: { isMaster: boolean; meId: string }) {
  const [who, setWho] = useState(meId)
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState("")
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const [f, setF] = useState({ unit: "FULL", startOn: today, endOn: today, memo: "" })
  const [adj, setAdj] = useState({ days: "", note: "" })

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(`/api/work/leave${who !== meId ? `?userId=${who}` : ""}`))
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [who, meId])
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
  const decide = (id: string, action: string) => act(() => api(`/api/work/leave/${id}`, { method: "POST", json: { action } }))
  const mine = data?.mine
  const self = who === meId

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-[20px] font-bold">연차</h1>
        {isMaster && data?.team && (
          <select className={`${field} ml-2`} value={who} onChange={(e) => setWho(e.target.value)}>
            <option value={meId}>내 연차</option>
            {data.team.employees
              .filter((e) => e.userId !== meId)
              .map((e) => (
                <option key={e.userId} value={e.userId}>{e.name}</option>
              ))}
          </select>
        )}
      </div>
      {err && <p className="text-[13px] text-[#d92d20]">{err}</p>}

      {isMaster && data?.team && (
        <div className="grid md:grid-cols-2 gap-3">
          <div className={card}>
            <div className="px-3 py-2 bg-[#ecece9] border-b border-[#d1d1cc] text-[15px] font-bold">승인 대기 {data.team.pending.length}건</div>
            {data.team.pending.length === 0 ? (
              <Empty>대기 중인 신청이 없습니다.</Empty>
            ) : (
              <ul className="divide-y divide-[#ecece9]">
                {data.team.pending.map((r) => (
                  <li key={r.id} className="px-3 py-2 flex items-center gap-2 text-[14px]">
                    <span className="w-[64px] font-medium">{r.employee?.user.name}</span>
                    <span className="flex-1">
                      {UNIT[r.unit]} {range(r)} · {days(r.requestedDays)}
                    </span>
                    <button className={`${btn} h-7 text-[12px]`} onClick={() => decide(r.id, "approve")}>
                      승인
                    </button>
                    <button className={`${btnLine} h-7 text-[12px]`} onClick={() => decide(r.id, "reject")}>
                      반려
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={card}>
            <div className="px-3 py-2 bg-[#ecece9] border-b border-[#d1d1cc] text-[15px] font-bold">직원별 잔여</div>
            <table className="w-full text-[14px]">
              <tbody>
                {data.team.employees.map((e) => (
                  <tr key={e.userId} className="border-b border-[#ecece9] last:border-0 cursor-pointer hover:bg-[#fafaf8]" onClick={() => setWho(e.userId)}>
                    <td className="px-3 py-1.5">{e.name}</td>
                    <td className="px-2 py-1.5 text-[12px] text-[#6f6f6a]">입사 {d10(e.hiredOn)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-bold">{days(e.balance)}</td>
                    <td className="px-3 py-1.5 text-right text-[12px] text-[#6f6f6a]">{e.pending ? `대기 ${days(e.pending)}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!mine ? (
        <div className={card}>
          <Empty>직원 정보(입사일)가 없는 계정입니다. 직원·담당 치과 메뉴에서 등록하면 연차가 계산됩니다.</Empty>
        </div>
      ) : (
        <>
          <div className={`${card} p-4 flex flex-wrap items-center gap-6`}>
            <div>
              <div className="text-[12px] text-[#6f6f6a]">잔여</div>
              <div className="text-[26px] font-bold tabular-nums">{days(mine.balance)}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#6f6f6a]">승인 대기</div>
              <div className="text-[18px] tabular-nums">{days(mine.pending)}</div>
            </div>
            <div className="text-[12px] text-[#6f6f6a]">입사 {d10(mine.hiredOn)} · 1년 미만 매월 1일, 1년마다 15일(3년차부터 2년마다 +1, 최대 25일)</div>
          </div>

          {self && (
            <div className={`${card} p-3 flex flex-wrap gap-2 items-center`}>
              <select className={field} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value, endOn: e.target.value === "FULL" ? f.endOn : f.startOn })}>
                {Object.entries(UNIT).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input type="date" className={field} value={f.startOn} onChange={(e) => setF({ ...f, startOn: e.target.value, endOn: f.unit === "FULL" && f.endOn >= e.target.value ? f.endOn : e.target.value })} />
              {f.unit === "FULL" && (
                <>
                  <span>~</span>
                  <input type="date" className={field} value={f.endOn} min={f.startOn} onChange={(e) => setF({ ...f, endOn: e.target.value })} />
                </>
              )}
              <input className={`${field} flex-1 min-w-[180px]`} placeholder="메모(선택)" value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} />
              <button className={btn} onClick={() => act(() => api("/api/work/leave", { method: "POST", json: f }))}>
                신청
              </button>
            </div>
          )}

          {isMaster && !self && (
            <div className={`${card} p-3 flex flex-wrap gap-2 items-center`}>
              <span className="text-[13px]">잔여 조정</span>
              <input type="number" step="0.5" className={`${field} w-[80px]`} placeholder="+1 / -0.5" value={adj.days} onChange={(e) => setAdj({ ...adj, days: e.target.value })} />
              <input className={`${field} flex-1 min-w-[200px]`} placeholder="사유(필수) 예: 도입 전 잔여 이월" value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
              <button
                className={btn}
                onClick={() =>
                  act(async () => {
                    await api("/api/work/leave/adjust", { method: "POST", json: { userId: who, days: Number(adj.days), note: adj.note } })
                    setAdj({ days: "", note: "" })
                  })
                }
              >
                조정
              </button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <div className={card}>
              <div className="px-3 py-2 bg-[#ecece9] border-b border-[#d1d1cc] text-[15px] font-bold">신청 내역</div>
              {mine.requests.length === 0 ? (
                <Empty>신청 내역이 없습니다.</Empty>
              ) : (
                <table className="w-full text-[14px]">
                  <tbody>
                    {mine.requests.map((r) => (
                      <tr key={r.id}>
                        <Td>{UNIT[r.unit]}</Td>
                        <Td>{range(r)}</Td>
                        <Td className="text-right">{days(r.requestedDays)}</Td>
                        <Td className={r.status === "APPROVED" ? "text-[#067647]" : r.status === "REJECTED" ? "text-[#d92d20]" : ""}>{STATUS[r.status]}</Td>
                        <Td className="text-right">
                          {(r.status === "PENDING" || (r.status === "APPROVED" && (isMaster || d10(r.startOn) > today))) && (
                            <button className="text-[12px] underline" onClick={() => decide(r.id, "cancel")}>
                              취소
                            </button>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className={card}>
              <div className="px-3 py-2 bg-[#ecece9] border-b border-[#d1d1cc] text-[15px] font-bold">연차 원장</div>
              {mine.ledger.length === 0 ? (
                <Empty>기록이 없습니다.</Empty>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <Th>날짜</Th>
                      <Th>구분</Th>
                      <Th className="text-right">일수</Th>
                      <Th>사용 기한·메모</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {mine.ledger.map((l) => (
                      <tr key={l.id}>
                        <Td>{d10(l.effectiveOn)}</Td>
                        <Td>{TYPE[l.type]}</Td>
                        <Td className={`text-right tabular-nums ${Number(l.deltaDays) < 0 ? "text-[#d92d20]" : ""}`}>{Number(l.deltaDays) > 0 ? "+" : ""}{Number(l.deltaDays)}</Td>
                        <Td className="text-[#6f6f6a]">
                          {l.expiresOn && `~${d10(l.expiresOn)} `}
                          {l.note}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
