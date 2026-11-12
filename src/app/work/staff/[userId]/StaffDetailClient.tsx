"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ChevronLeft } from "lucide-react"
import { api, btn, btnLine, card, d10, field, kst, Th, Td, Empty } from "../../ui"
import ProfileFields, { EMPTY_PROFILE, toPayload, type Profile } from "../ProfileFields"

type Detail = {
  user: { id: string; name: string; email: string; role: string; locked: boolean; createdAt: string }
  employee: {
    hiredOn: string
    leftOn: string | null
    jobTitle: string | null
    phone: string | null
    employmentType: string | null
    workMode: "OFFICE" | "REMOTE"
    workStart: string
    workEnd: string
    workWeekdays: number[]
    weeklyContractMinutes: number
    memo: string | null
    clinicAccess: { clinicId: string }[]
  } | null
  clinics: { id: string; name: string }[]
  month: string
  attendance: { id: string; workDate: string; clockInAt: string | null; clockOutAt: string | null; workMode: string | null; clockInIp: string | null; class: string | null }[]
  remoteChecks: { id: string; scheduledAt: string; shownAt: string | null; verifiedAt: string | null; status: string; reissueCount: number; wrongAttempts: number; reason: string | null }[]
  summary: { worked: number; late: number; noClockOut: number; remoteVerified: number; remoteMissed: number }
  leave: { balance: number; pending: number } | null
  ledger: { id: string; type: string; deltaDays: number; effectiveOn: string; expiresOn: string | null; note: string | null }[]
  tasks: { id: string; title: string; status: string; dueOn: string | null; clinic: { name: string } }[]
  logs: { event: string; timestamp: string }[]
  salaries: { id: string; effectiveOn: string; annualSalary: number; reason: string | null }[]
}

const TABS = [
  ["info", "기본정보"],
  ["attendance", "근태·연차"],
  ["clinics", "담당 치과·업무"],
  ["account", "계정·보안"],
] as const
type Tab = (typeof TABS)[number][0]

const hm = (iso: string | null) => (iso ? kst(iso).slice(11, 16) : "")
const LEDGER: Record<string, string> = { GRANT: "발생", USE: "사용", EXPIRE: "소멸", ADJUST: "조정", REVERSAL: "취소 환원" }
const RC: Record<string, string> = { SCHEDULED: "예정", SHOWN: "표시 중", VERIFIED: "인증", MISSED: "미인증", EXCUSED: "사유 인정" }
const TASK: Record<string, string> = { TODO: "할 일", BLOCKED: "자료 대기", IN_PROGRESS: "진행 중", IN_REVIEW: "검수 중" }
const EVENT: Record<string, string> = {
  STAFF_CREATED: "계정 생성",
  STAFF_ACCESS_CHANGED: "담당 치과 변경",
  STAFF_PROFILE_CHANGED: "기본정보 변경",
  STAFF_PASSWORD_RESET: "비밀번호 재설정",
  STAFF_LOCKED: "계정 잠금",
  STAFF_UNLOCKED: "잠금 해제",
  STAFF_RESIGNED: "퇴사 처리",
  REMOTE_CHECK_EXCUSED: "재택 미인증 사유 인정",
  STAFF_SALARY_ADDED: "연봉 기록 추가",
  STAFF_SALARY_DELETED: "연봉 기록 삭제",
}

function toProfile(d: Detail): Profile {
  const e = d.employee
  if (!e) return { ...EMPTY_PROFILE, name: d.user.name, email: d.user.email }
  return {
    name: d.user.name,
    email: d.user.email,
    hiredOn: d10(e.hiredOn),
    leftOn: d10(e.leftOn),
    jobTitle: e.jobTitle ?? "",
    phone: e.phone ?? "",
    employmentType: e.employmentType ?? "정규직",
    workMode: e.workMode,
    workStart: e.workStart,
    workEnd: e.workEnd,
    workWeekdays: e.workWeekdays,
    weeklyHours: String(e.weeklyContractMinutes / 60),
    memo: e.memo ?? "",
  }
}

export default function StaffDetailClient({ userId, meId }: { userId: string; meId: string }) {
  const [d, setD] = useState<Detail | null>(null)
  const [tab, setTab] = useState<Tab>("info")
  const [month, setMonth] = useState(new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7))
  const [p, setP] = useState<Profile>(EMPTY_PROFILE)
  const [clinicIds, setClinicIds] = useState<string[]>([])
  const [msg, setMsg] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const j = await api<Detail>(`/api/work/staff/${userId}?month=${month}`)
      setD(j)
      setP(toProfile(j))
      setClinicIds(j.employee?.clinicAccess.map((c) => c.clinicId) ?? [])
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [userId, month])
  useEffect(() => {
    load()
  }, [load])

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    setErr("")
    setMsg("")
    try {
      await fn()
      setMsg(ok)
      await load()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!d) return <div className="text-[14px] text-[#6f6f6a]">{err || "불러오는 중…"}</div>

  const isMaster = d.user.role === "MASTER"
  const self = d.user.id === meId
  const leftDone = !!d.employee?.leftOn && d10(d.employee.leftOn) <= new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const status = !d.employee ? "정보 미등록" : leftDone ? "퇴사" : d.user.locked ? "잠금" : "재직"

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/work/staff" className="inline-flex items-center text-[13px] text-[#555555] hover:text-[#0062ff]">
          <ChevronLeft className="w-4 h-4" />
          직원 목록
        </Link>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-[20px] font-bold">
            {d.user.name}
            {isMaster && <span className="ml-2 text-[13px] font-normal text-[#6f6f6a]">대표</span>}
          </h1>
          <p className="text-[13px] text-[#6f6f6a]">
            {d.user.email} · {status}
            {d.employee?.jobTitle ? ` · ${d.employee.jobTitle}` : ""}
          </p>
        </div>
      </div>

      <div className="flex border-b border-[#d1d1cc]" role="tablist">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => {
              setTab(k)
              setMsg("")
              setErr("")
            }}
            className={`h-9 px-3 text-[14px] -mb-px border-b-2 ${tab === k ? "border-[#0062ff] font-semibold" : "border-transparent text-[#555555] hover:text-[#0a0a0a]"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {(msg || err) && <p className={`text-[13px] ${err ? "text-[#d92d20]" : "text-[#1a7f37]"}`}>{err || msg}</p>}

      {tab === "info" && (
        <div className={`${card} p-4 max-w-[640px]`}>
          {!d.employee && <p className="mb-2 text-[13px] text-[#6f6f6a]">직원 정보가 아직 없습니다. 입사일을 넣고 저장하면 출퇴근·연차가 시작됩니다.</p>}
          <ProfileFields v={p} set={setP} />
          <p className="mt-2 text-[12px] text-[#8a8a84]">생년월일·계좌·주민등록번호·주소는 받지 않습니다.</p>
          <div className="mt-3 flex justify-end">
            <button className={btn} disabled={busy} onClick={() => run(() => api(`/api/work/staff/${userId}`, { method: "PATCH", json: toPayload(p) }), "저장했습니다")}>
              변경사항 저장
            </button>
          </div>
        </div>
      )}
      {tab === "info" && d.employee && <SalaryCard d={d} busy={busy} run={run} userId={userId} />}

      {tab === "attendance" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input type="month" aria-label="월" className={field} value={month} onChange={(e) => setMonth(e.target.value)} />
            <Link href="/work/attendance" className="text-[13px] text-[#0062ff] hover:underline ml-auto">
              출퇴근 기록 고치기
            </Link>
          </div>
          <div className={`${card} grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#ecece9]`}>
            <Stat label="잔여 연차" value={d.leave ? `${d.leave.balance}일` : "-"} sub={d.leave?.pending ? `승인 대기 ${d.leave.pending}일` : undefined} />
            <Stat label="이번 달 근무" value={`${d.summary.worked}일`} sub={`지각 ${d.summary.late} · 퇴근 미기록 ${d.summary.noClockOut}`} />
            <Stat label="근무 방식" value={d.employee?.workMode === "REMOTE" ? "재택" : "사무실"} sub={d.employee ? `${d.employee.workStart}~${d.employee.workEnd}` : undefined} />
            <Stat label="재택 인증" value={`${d.summary.remoteVerified}회`} sub={`미인증 ${d.summary.remoteMissed}`} />
          </div>

          <div className={card}>
            <div className="px-3 pt-3 text-[13px] font-semibold">출퇴근</div>
            {!d.attendance.length ? (
              <Empty>이 달 기록이 없습니다.</Empty>
            ) : (
              <table className="w-full text-[14px]">
                <thead>
                  <tr>
                    <Th>날짜</Th>
                    <Th>출근</Th>
                    <Th>퇴근</Th>
                    <Th>방식</Th>
                    <Th>출근 IP</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.attendance.map((a) => (
                    <tr key={a.id}>
                      <Td>{d10(a.workDate)}</Td>
                      <Td className={a.clockInAt && hm(a.clockInAt) > (d.employee?.workStart ?? "09:00") ? "text-[#d92d20]" : ""}>{hm(a.clockInAt) || "-"}</Td>
                      <Td>{hm(a.clockOutAt) || (a.clockInAt ? "미기록" : "-")}</Td>
                      <Td>{a.workMode === "REMOTE" ? "재택" : a.workMode === "OFFICE" ? "사무실" : "-"}</Td>
                      <Td className="text-[12px] text-[#6f6f6a] font-mono">{a.clockInIp ?? ""}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {d.employee?.workMode === "REMOTE" || d.remoteChecks.length ? (
            <div className={card}>
              <div className="px-3 pt-3 text-[13px] font-semibold">재택 인증</div>
              {!d.remoteChecks.length ? (
                <Empty>이 달 인증 기록이 없습니다.</Empty>
              ) : (
                <table className="w-full text-[14px]">
                  <thead>
                    <tr>
                      <Th>날짜</Th>
                      <Th>예정</Th>
                      <Th>QR 표시</Th>
                      <Th>인증</Th>
                      <Th>결과</Th>
                      <Th>재발급·오답</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.remoteChecks.map((r) => (
                      <tr key={r.id}>
                        <Td>{kst(r.scheduledAt).slice(0, 10)}</Td>
                        <Td>{hm(r.scheduledAt)}</Td>
                        <Td>{r.shownAt ? kst(r.shownAt).slice(11) : "-"}</Td>
                        <Td>{r.verifiedAt ? kst(r.verifiedAt).slice(11) : "-"}</Td>
                        <Td className={r.status === "MISSED" ? "text-[#d92d20]" : ""}>
                          {RC[r.status] ?? r.status}
                          {r.reason ? <span className="text-[12px] text-[#6f6f6a]"> · {r.reason}</span> : null}
                        </Td>
                        <Td className="text-[12px] text-[#6f6f6a]">
                          {r.reissueCount} · {r.wrongAttempts}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}

          <div className={card}>
            <div className="px-3 pt-3 flex items-center text-[13px] font-semibold">
              연차 원장
              <Link href="/work/leave" className="ml-auto font-normal text-[#0062ff] hover:underline">
                연차 조정·승인
              </Link>
            </div>
            {!d.ledger.length ? (
              <Empty>연차 기록이 없습니다.</Empty>
            ) : (
              <table className="w-full text-[14px]">
                <thead>
                  <tr>
                    <Th>날짜</Th>
                    <Th>구분</Th>
                    <Th className="text-right">일수</Th>
                    <Th>사용 기한</Th>
                    <Th>메모</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.ledger.map((l) => (
                    <tr key={l.id}>
                      <Td>{d10(l.effectiveOn)}</Td>
                      <Td>{LEDGER[l.type] ?? l.type}</Td>
                      <Td className="text-right tabular-nums">{l.deltaDays > 0 ? `+${l.deltaDays}` : l.deltaDays}</Td>
                      <Td>{d10(l.expiresOn)}</Td>
                      <Td className="text-[13px] text-[#6f6f6a]">{l.note ?? ""}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "clinics" && (
        <div className="space-y-3">
          <div className={`${card} p-4`}>
            <div className="text-[13px] font-semibold mb-2">담당 치과</div>
            {isMaster ? (
              <p className="text-[14px] text-[#6f6f6a]">대표는 모든 치과를 봅니다.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {d.clinics.map((c) => (
                    <label key={c.id} className="flex items-center gap-1 text-[14px]">
                      <input
                        type="checkbox"
                        checked={clinicIds.includes(c.id)}
                        onChange={(e) => setClinicIds(e.target.checked ? [...clinicIds, c.id] : clinicIds.filter((x) => x !== c.id))}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    className={btn}
                    disabled={busy || !d.employee}
                    onClick={() => {
                      const before = new Set(d.employee?.clinicAccess.map((c) => c.clinicId))
                      const add = d.clinics.filter((c) => clinicIds.includes(c.id) && !before.has(c.id)).map((c) => c.name)
                      const del = d.clinics.filter((c) => !clinicIds.includes(c.id) && before.has(c.id)).map((c) => c.name)
                      if (!add.length && !del.length) return setMsg("바뀐 것이 없습니다")
                      const text = [add.length ? `추가: ${add.join(", ")}` : "", del.length ? `회수: ${del.join(", ")}` : ""].filter(Boolean).join("\n")
                      if (!window.confirm(`담당 치과를 바꿉니다.\n${text}\n회수한 치과는 다음 요청부터 바로 막힙니다.`)) return
                      run(() => api(`/api/work/staff/${userId}`, { method: "POST", json: { action: "clinics", clinicIds } }), "담당 치과를 바꿨습니다")
                    }}
                  >
                    담당 치과 저장
                  </button>
                </div>
              </>
            )}
          </div>
          <div className={card}>
            <div className="px-3 pt-3 text-[13px] font-semibold">진행 중인 업무 {d.tasks.length}건</div>
            {!d.tasks.length ? (
              <Empty>배정된 업무가 없습니다.</Empty>
            ) : (
              <table className="w-full text-[14px]">
                <thead>
                  <tr>
                    <Th>업무</Th>
                    <Th>치과</Th>
                    <Th>상태</Th>
                    <Th>마감</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.tasks.map((t) => (
                    <tr key={t.id}>
                      <Td>
                        <Link href={`/work/tasks?task=${t.id}`} className="hover:text-[#0062ff]">
                          {t.title}
                        </Link>
                      </Td>
                      <Td>{t.clinic.name}</Td>
                      <Td>{TASK[t.status] ?? t.status}</Td>
                      <Td>{d10(t.dueOn) || "-"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "account" && (
        <AccountTab d={d} self={self} busy={busy} leftDone={leftDone} run={run} userId={userId} />
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[12px] text-[#6f6f6a]">{label}</div>
      <div className="text-[20px] font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[12px] text-[#6f6f6a]">{sub}</div>}
    </div>
  )
}

function AccountTab({
  d,
  self,
  busy,
  leftDone,
  run,
  userId,
}: {
  d: Detail
  self: boolean
  busy: boolean
  leftDone: boolean
  run: (fn: () => Promise<unknown>, ok: string) => Promise<void>
  userId: string
}) {
  const [temp, setTemp] = useState<string | null>(null)
  const [lockReason, setLockReason] = useState("")
  const [leftOn, setLeftOn] = useState(new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10))
  const [unassign, setUnassign] = useState(true)
  const isMaster = d.user.role === "MASTER"
  const post = (json: unknown) => api(`/api/work/staff/${userId}`, { method: "POST", json })

  return (
    <div className="space-y-3 max-w-[640px]">
      <div className={`${card} p-4`}>
        <div className="text-[13px] font-semibold">로그인</div>
        <p className="mt-1 text-[14px]">
          {d.user.locked ? "잠금 — 로그인할 수 없습니다" : "사용 중"} · 계정 생성 {kst(d.user.createdAt).slice(0, 10)}
        </p>
      </div>

      <div className={`${card} p-4`}>
        <div className="text-[13px] font-semibold">비밀번호 재설정</div>
        <p className="mt-1 text-[13px] text-[#6f6f6a]">임시 비밀번호를 만들어 한 번만 보여줍니다. 직원에게 전달한 뒤 로그인해서 바꾸게 하세요.</p>
        {temp && (
          <p className="mt-2 text-[14px]">
            임시 비밀번호 <code className="px-1 bg-[#f2f2ef] font-mono">{temp}</code>
          </p>
        )}
        <div className="mt-2 flex justify-end">
          <button
            className={btnLine}
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`${d.user.name}의 비밀번호를 임시 비밀번호로 바꿉니다. 지금 비밀번호는 더 이상 쓸 수 없습니다.`)) return
              run(async () => setTemp(((await post({ action: "resetPassword" })) as { tempPassword: string }).tempPassword), "임시 비밀번호를 만들었습니다")
            }}
          >
            임시 비밀번호 발급
          </button>
        </div>
      </div>

      {!self && (
        <div className={`${card} p-4`}>
          <div className="text-[13px] font-semibold">계정 잠금</div>
          <p className="mt-1 text-[13px] text-[#6f6f6a]">잠그면 다음 요청부터 바로 로그아웃되고 로그인할 수 없습니다. 기록은 그대로 남습니다.</p>
          {d.user.locked ? (
            <div className="mt-2 flex justify-end">
              <button className={btnLine} disabled={busy || leftDone} onClick={() => run(() => post({ action: "unlock" }), "잠금을 풀었습니다")}>
                잠금 해제
              </button>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <input className={`${field} flex-1`} placeholder="잠금 사유(필수)" value={lockReason} onChange={(e) => setLockReason(e.target.value)} />
              <button
                className={`${btnLine} text-[#d92d20]`}
                disabled={busy || !lockReason.trim()}
                onClick={() => window.confirm(`${d.user.name} 계정을 잠급니다.`) && run(() => post({ action: "lock", reason: lockReason }), "계정을 잠갔습니다")}
              >
                잠금
              </button>
            </div>
          )}
        </div>
      )}

      {!self && !isMaster && d.employee && !leftDone && (
        <div className={`${card} p-4`}>
          <div className="text-[13px] font-semibold text-[#d92d20]">퇴사 처리</div>
          <p className="mt-1 text-[13px] text-[#6f6f6a]">
            퇴사일을 기록하고 계정을 잠그며 담당 치과를 모두 회수합니다. 출퇴근·연차·업무 기록은 지우지 않습니다. 진행 중 업무 {d.tasks.length}건.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input type="date" aria-label="퇴사일" className={field} value={leftOn} onChange={(e) => setLeftOn(e.target.value)} />
            <label className="flex items-center gap-1 text-[14px]">
              <input type="checkbox" checked={unassign} onChange={(e) => setUnassign(e.target.checked)} />
              진행 중 업무 담당자 비우기
            </label>
            <button
              className={`${btn} ml-auto bg-[#d92d20]`}
              disabled={busy}
              onClick={() => {
                const typed = window.prompt(`퇴사 처리하려면 이름(${d.user.name})을 입력하세요.`)
                if (typed?.trim() !== d.user.name) return
                run(() => post({ action: "resign", leftOn, unassignTasks: unassign }), "퇴사 처리했습니다")
              }}
            >
              퇴사 처리
            </button>
          </div>
        </div>
      )}

      <div className={card}>
        <div className="px-3 pt-3 text-[13px] font-semibold">변경 이력</div>
        {!d.logs.length ? (
          <Empty>기록이 없습니다.</Empty>
        ) : (
          <table className="w-full text-[14px]">
            <tbody>
              {d.logs.map((l, i) => (
                <tr key={i}>
                  <Td className="w-[150px] text-[13px] text-[#6f6f6a]">{kst(l.timestamp)}</Td>
                  <Td>{EVENT[l.event] ?? l.event}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`

function SalaryCard({ d, busy, run, userId }: { d: Detail; busy: boolean; run: (fn: () => Promise<unknown>, ok: string) => Promise<void>; userId: string }) {
  const [f, setF] = useState({ effectiveOn: new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10), annualSalary: "", reason: "" })
  const rows = d.salaries
  const latest = rows[0]?.annualSalary
  const post = (json: unknown) => api(`/api/work/staff/${userId}`, { method: "POST", json })
  const pct = (p: number) => latest && setF({ ...f, annualSalary: String(Math.round((latest * (1 + p / 100)) / 10000) * 10000), reason: `재계약 ${p}% 인상` })
  return (
    <div className={`${card} max-w-[640px]`}>
      <div className="px-4 pt-3 flex items-baseline">
        <span className="text-[13px] font-semibold">연봉</span>
        <span className="ml-2 text-[20px] font-bold tabular-nums">{latest ? won(latest) : "-"}</span>
        <span className="ml-auto text-[12px] text-[#8a8a84]">대표만 봅니다</span>
      </div>
      {rows.length > 0 && (
        <table className="w-full text-[14px] mt-2">
          <thead>
            <tr>
              <Th>적용일</Th>
              <Th className="text-right">연봉</Th>
              <Th className="text-right">변동</Th>
              <Th>사유</Th>
              <Th className="w-[48px]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const prev = rows[i + 1]?.annualSalary
              return (
                <tr key={r.id}>
                  <Td>{d10(r.effectiveOn)}</Td>
                  <Td className="text-right tabular-nums">{won(r.annualSalary)}</Td>
                  <Td className="text-right tabular-nums text-[13px] text-[#6f6f6a]">{prev ? `${(((r.annualSalary - prev) / prev) * 100).toFixed(1)}%` : ""}</Td>
                  <Td className="text-[13px]">{r.reason ?? ""}</Td>
                  <Td>
                    <button
                      className="text-[12px] text-[#8a8a84] hover:text-[#d92d20]"
                      onClick={() => window.confirm(`${d10(r.effectiveOn)} ${won(r.annualSalary)} 기록을 지웁니다.`) && run(() => post({ action: "deleteSalary", salaryId: r.id }), "지웠습니다")}
                    >
                      삭제
                    </button>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <div className="px-4 py-3 border-t border-[#ecece9] mt-2 flex flex-wrap items-center gap-2">
        <input type="date" aria-label="적용일" className={field} value={f.effectiveOn} onChange={(e) => setF({ ...f, effectiveOn: e.target.value })} />
        <input aria-label="연봉(원)" className={`${field} w-[130px] text-right`} placeholder="연봉(원)" value={f.annualSalary} onChange={(e) => setF({ ...f, annualSalary: e.target.value })} />
        <input aria-label="사유" className={`${field} flex-1 min-w-[120px]`} placeholder="사유 (예: 재계약)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        <button className={btn} disabled={busy || !f.annualSalary} onClick={() => run(() => post({ action: "salary", ...f }), "연봉 기록을 추가했습니다")}>
          추가
        </button>
        {latest ? (
          <span className="w-full text-[12px] text-[#6f6f6a]">
            인상률로 채우기{" "}
            {[3, 5, 10].map((p) => (
              <button key={p} className="mr-2 text-[#0062ff] hover:underline" onClick={() => pct(p)}>
                {p}%
              </button>
            ))}
          </span>
        ) : null}
      </div>
    </div>
  )
}
