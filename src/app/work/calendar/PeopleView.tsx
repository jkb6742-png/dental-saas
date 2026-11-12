"use client"

import Chip from "./Chip"
import { addDays, fmtDay, KIND, RED, type Item, type Person } from "./shared"

/** 사람별 보기: 세로 직원 × 가로 요일. 칸마다 그 사람의 업무 마감·일정·연차 */
export default function PeopleView({ weekStart, today, selected, items, kinds, staff, me, isMaster, onSelect, onOpen }: {
  weekStart: string
  today: string
  selected: string
  items: Item[]
  kinds: Record<Item["kind"], boolean>
  staff: Person[]
  me: string
  isMaster: boolean
  onSelect: (d: string) => void
  onOpen: (it: Item) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const visible = items.filter((it) => kinds[it.kind] && it.kind !== "PAYMENT")
  const unassigned = visible.filter((it) => it.kind === "TASK" && !it.assigneeId)
  const rows: (Person & { unassigned?: boolean })[] = [...staff, ...(unassigned.length ? [{ id: "__none", name: "미배정 업무", unassigned: true }] : [])]
  const on = (it: Item, d: string) => it.date <= d && it.endDate >= d

  return (
    <div className="bg-white rounded border border-[#d1d1cc] overflow-x-auto">
      <table className="w-full min-w-[860px] table-fixed border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[#d1d1cc]">
            <th className="w-[112px] px-2 py-1.5 text-left font-medium text-[#6f6f6a]">직원</th>
            {days.map((d, i) => (
              <th
                key={d}
                onClick={() => onSelect(d)}
                className={`px-2 py-1.5 text-left font-medium border-l border-[#ecece9] tabular-nums cursor-pointer ${selected === d ? "bg-[#eef4ff]" : "hover:bg-[#fafaf8]"} ${d === today ? "text-[#0062ff] font-bold" : "text-[#333]"}`}
                style={d !== today && i === 6 ? { color: RED } : undefined}
              >
                {fmtDay(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-[#6f6f6a]">재직 중인 직원이 없습니다.</td>
            </tr>
          )}
          {rows.map((p) => {
            const mine = p.unassigned ? unassigned : visible.filter((it) => (it.userIds ?? []).includes(p.id))
            const weekLoad = mine.filter((it) => it.kind !== "LEAVE" && days.some((d) => on(it, d))).length
            return (
              <tr key={p.id} className="border-b border-[#ecece9] last:border-0 align-top">
                <td className="px-2 py-1.5">
                  <div className={`font-medium truncate ${p.unassigned ? "text-[#6f6f6a]" : "text-[#191f28]"}`}>{p.name}</div>
                  <div className="text-[11px] text-[#8a8a84] tabular-nums">이번 주 {weekLoad}건</div>
                </td>
                {days.map((d) => {
                  const cell = mine.filter((it) => on(it, d))
                  const leave = cell.find((it) => it.kind === "LEAVE" && it.status === "APPROVED") ?? cell.find((it) => it.kind === "LEAVE")
                  const work = cell.filter((it) => it.kind !== "LEAVE")
                  const pending = leave?.status === "PENDING"
                  const g = KIND.LEAVE.color
                  return (
                    <td
                      key={d}
                      onClick={() => onSelect(d)}
                      className={`relative h-[76px] px-1 py-1 border-l border-[#ecece9] cursor-pointer ${selected === d && !leave ? "bg-[#f5f8ff]" : ""}`}
                      style={leave ? { background: pending ? `${g}08` : `${g}14`, outline: pending ? `1px dashed ${g}88` : undefined, outlineOffset: -2 } : undefined}
                    >
                      <div className="flex items-center gap-1 mb-[2px] min-h-[16px]">
                        {leave && (
                          <span className="text-[11px] font-medium" style={{ color: pending ? `${g}bb` : g }}>
                            {leave.leaveUnit === "FULL" ? "연차" : "반차"}
                            {leave.leaveUnit === "HALF_AM" ? "(오전)" : leave.leaveUnit === "HALF_PM" ? "(오후)" : ""}
                            {pending ? " 대기" : ""}
                          </span>
                        )}
                        {work.length > 0 && (
                          <span className={`ml-auto text-[11px] tabular-nums ${work.length >= 4 ? "text-[#b54708] font-medium" : "text-[#8a8a84]"}`}>{work.length}</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-[2px]">
                        {work.slice(0, 3).map((it) => (
                          <Chip key={`${it.kind}${it.id}`} it={it} me={me} isMaster={isMaster} onClick={it.kind === "EVENT" ? onOpen : () => onSelect(d)} />
                        ))}
                        {work.length > 3 && <div className="text-[11px] text-[#6f6f6a] px-1">+{work.length - 3}</div>}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
