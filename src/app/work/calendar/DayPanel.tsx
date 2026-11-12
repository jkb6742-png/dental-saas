"use client"

import Link from "next/link"
import { colorOf, daysBetween, EVENT_TYPES, isPending, KIND, kstParts, RED, relDay, TASK_STATUS, type Item } from "./shared"

const Dot = ({ it }: { it: Item }) => (
  <span
    className="inline-block w-2 h-2 rounded-full shrink-0"
    style={isPending(it) ? { border: `1px dashed ${colorOf(it)}` } : { background: colorOf(it) }}
  />
)

function eventTime(it: Item) {
  if (!it.time || !it.startAt || !it.endAt) return it.date === it.endDate ? "종일" : `종일 · ~${it.endDate.slice(5).replace("-", ".")}`
  const s = kstParts(it.startAt)
  const e = kstParts(it.endAt)
  return s.date === e.date ? `${s.time}~${e.time}` : `${s.time} ~ ${e.date.slice(5).replace("-", ".")} ${e.time}`
}

/** 선택한 날의 상세. 업무·연차·결제는 원래 화면으로, 일정은 수정 폼으로 */
export default function DayPanel({ day, today, items, onAdd, onOpen }: {
  day: string
  today: string
  items: Item[]
  onAdd: () => void
  onOpen: (it: Item) => void
}) {
  const order: Item["kind"][] = ["EVENT", "TASK", "LEAVE", "PAYMENT"]
  const sorted = [...items].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || (a.time ?? "").localeCompare(b.time ?? ""))
  return (
    <aside className="bg-white rounded border border-[#d1d1cc] self-start lg:sticky lg:top-3">
      <div className="px-3 py-2 border-b border-[#d1d1cc] flex items-center">
        <span className="text-[15px] font-bold tabular-nums">{relDay(day, today)}</span>
        <span className="ml-2 text-[12px] text-[#8a8a84] tabular-nums">{items.length}건</span>
        <button className="ml-auto text-[13px] text-[#0062ff] hover:underline" onClick={onAdd}>이 날 일정 추가</button>
      </div>
      {sorted.length === 0 ? (
        <p className="p-3 text-[13px] text-[#6f6f6a]">일정이 없습니다.</p>
      ) : (
        <ul className="max-h-[calc(100vh-180px)] overflow-y-auto">
          {sorted.map((it) => (
            <li key={`${it.kind}${it.id}`} className="px-3 py-2.5 border-b border-[#ecece9] last:border-0 text-[14px]">
              <div className="flex items-center gap-1.5 text-[12px] text-[#6f6f6a]">
                <Dot it={it} />
                <span style={{ color: colorOf(it) }}>{KIND[it.kind].label}</span>
                {it.kind === "EVENT" && <span className="tabular-nums">· {eventTime(it)}</span>}
                {it.kind === "EVENT" && it.eventType && <span>· {EVENT_TYPES[it.eventType]}</span>}
                {it.kind === "TASK" && <span>· {it.overdue ? <b className="font-medium" style={{ color: RED }}>{daysBetween(it.date, today)}일 지연</b> : TASK_STATUS[it.status] ?? it.status}</span>}
              </div>

              {it.kind === "EVENT" ? (
                <>
                  <button className="text-left font-medium hover:underline" onClick={() => onOpen(it)}>{it.title}</button>
                  <dl className="mt-1 grid grid-cols-[44px_1fr] gap-x-2 gap-y-0.5 text-[12px]">
                    {it.clinicName && (<><dt className="text-[#8a8a84]">치과</dt><dd>{it.clinicName}</dd></>)}
                    {it.location && (<><dt className="text-[#8a8a84]">장소</dt><dd className="break-words">{it.location}</dd></>)}
                    <dt className="text-[#8a8a84]">참석</dt>
                    <dd>
                      {it.organizerName && <span>{it.organizerName}(주최)</span>}
                      {(it.participantNames ?? []).filter((n) => n !== it.organizerName).map((n) => `, ${n}`).join("")}
                    </dd>
                    {it.taskId && (
                      <>
                        <dt className="text-[#8a8a84]">업무</dt>
                        <dd><Link href={`/work/tasks?open=${it.taskId}`} prefetch={false} className="text-[#0062ff] hover:underline">연결 업무 열기</Link></dd>
                      </>
                    )}
                  </dl>
                  {it.notesPreview && <p className="mt-1 text-[12px] text-[#6f6f6a] line-clamp-3 whitespace-pre-line">{it.notesPreview}</p>}
                </>
              ) : it.kind === "TASK" ? (
                <>
                  <Link href={`/work/tasks?open=${it.id}`} prefetch={false} className={`font-medium hover:underline ${it.status === "DONE" ? "line-through text-[#9a9a94]" : ""}`}>{it.title}</Link>
                  <div className="text-[12px] text-[#6f6f6a]">{[it.sub, it.clinicName].filter(Boolean).join(" · ")}</div>
                </>
              ) : (
                <>
                  <Link href={it.kind === "LEAVE" ? "/work/leave" : "/work/billing"} prefetch={false} className="font-medium hover:underline">{it.title}</Link>
                  {it.sub && <div className="text-[12px] text-[#6f6f6a]">{it.sub}</div>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
