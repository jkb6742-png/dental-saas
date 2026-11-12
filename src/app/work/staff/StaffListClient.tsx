"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronRight, X } from "lucide-react"
import { api, btn, btnLine, card, d10, field, Th, Td, Empty } from "../ui"
import ProfileFields, { EMPTY_PROFILE, toPayload, type Profile } from "./ProfileFields"

type Row = {
  id: string
  name: string
  email: string
  role: string
  locked: boolean
  registered: boolean
  active: boolean
  hiredOn: string | null
  leftOn: string | null
  jobTitle: string | null
  workMode: "OFFICE" | "REMOTE" | null
  clinicCount: number | null
  leave: number | null
}
type Clinic = { id: string; name: string }

const state = (r: Row) => (!r.registered ? "정보 미등록" : !r.active ? "퇴사" : r.locked ? "잠금" : "재직")

export default function StaffListClient() {
  const [data, setData] = useState<{ staff: Row[]; clinics: Clinic[]; pendingLeave: number } | null>(null)
  const [err, setErr] = useState("")
  const [q, setQ] = useState("")
  const [tab, setTab] = useState<"all" | "active" | "left">("active")
  const [adding, setAdding] = useState(false)
  const [created, setCreated] = useState<{ name: string; email: string; tempPassword: string | null } | null>(null)

  const load = useCallback(() => api("/api/work/staff").then(setData).catch((e) => setErr(e.message)), [])
  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (data?.staff ?? []).filter((r) => {
      if (tab === "active" && r.registered && !r.active) return false
      if (tab === "left" && (!r.registered || r.active)) return false
      return !s || r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s)
    })
  }, [data, q, tab])

  const activeN = data?.staff.filter((r) => r.registered && r.active).length ?? 0
  const leftN = data?.staff.filter((r) => r.registered && !r.active).length ?? 0

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div>
          <h1 className="text-[20px] font-bold">직원 관리</h1>
          <p className="text-[13px] text-[#6f6f6a]">
            재직 {activeN}명 · 퇴사 {leftN}명
            {data?.pendingLeave ? (
              <>
                {" · "}
                <Link href="/work/leave" className="text-[#0062ff] hover:underline">
                  연차 승인 대기 {data.pendingLeave}건
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <button className={`${btn} ml-auto`} onClick={() => setAdding(true)}>
          직원 추가
        </button>
      </div>

      {created && (
        <div className={`${card} p-3 text-[14px]`}>
          <b>{created.name}</b> 계정을 만들었습니다. 로그인 {created.email}
          {created.tempPassword && (
            <>
              {" · "}임시 비밀번호 <code className="px-1 bg-[#f2f2ef] font-mono">{created.tempPassword}</code>
              <span className="text-[12px] text-[#6f6f6a]"> 이 화면을 벗어나면 다시 볼 수 없습니다. 직원에게 전달하세요.</span>
            </>
          )}
          <button className="ml-2 text-[12px] text-[#6f6f6a] underline" onClick={() => setCreated(null)}>
            닫기
          </button>
        </div>
      )}
      {err && <p className="text-[13px] text-[#d92d20]">{err}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <input className={`${field} w-[220px]`} placeholder="이름·이메일 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex text-[13px] border border-[#d1d1cc] rounded overflow-hidden bg-white" role="tablist">
          {(
            [
              ["active", "재직"],
              ["left", "퇴사"],
              ["all", "전체"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`h-8 px-3 ${tab === k ? "bg-[#191f28] text-white" : "hover:bg-[#ecece9]"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className={`${card} overflow-x-auto`}>
        {!data ? (
          <Empty>불러오는 중…</Empty>
        ) : !rows.length ? (
          <Empty>해당하는 직원이 없습니다.</Empty>
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr>
                <Th>이름</Th>
                <Th>직무</Th>
                <Th>담당 치과</Th>
                <Th>입사일</Th>
                <Th>근무 방식</Th>
                <Th>상태</Th>
                <Th className="text-right">잔여 연차</Th>
                <Th className="w-[32px]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[#f7f7f5]">
                  <Td>
                    <Link href={`/work/staff/${r.id}`} className="font-medium hover:text-[#0062ff]">
                      {r.name}
                    </Link>
                    {r.role === "MASTER" && <span className="ml-1 text-[12px] text-[#6f6f6a]">대표</span>}
                    <div className="text-[12px] text-[#8a8a84]">{r.email}</div>
                  </Td>
                  <Td>{r.jobTitle ?? "-"}</Td>
                  <Td>{r.clinicCount === null ? "전체" : `${r.clinicCount}곳`}</Td>
                  <Td>{d10(r.hiredOn) || "-"}</Td>
                  <Td>{r.workMode === "REMOTE" ? "재택" : r.workMode === "OFFICE" ? "사무실" : "-"}</Td>
                  <Td className={state(r) === "재직" ? "" : "text-[#6f6f6a]"}>{state(r)}</Td>
                  <Td className="text-right tabular-nums">{r.leave === null ? "-" : `${r.leave}일`}</Td>
                  <Td>
                    <Link href={`/work/staff/${r.id}`} aria-label={`${r.name} 상세`} className="text-[#9b9b95] hover:text-[#0a0a0a]">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adding && data && (
        <AddDrawer
          clinics={data.clinics}
          onClose={() => setAdding(false)}
          onDone={(c) => {
            setAdding(false)
            setCreated(c)
            load()
          }}
        />
      )}
    </div>
  )
}

function AddDrawer({
  clinics,
  onClose,
  onDone,
}: {
  clinics: Clinic[]
  onClose: () => void
  onDone: (c: { name: string; email: string; tempPassword: string | null }) => void
}) {
  const [p, setP] = useState<Profile>({ ...EMPTY_PROFILE, hiredOn: new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10) })
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [clinicIds, setClinicIds] = useState<string[]>([])
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", k)
    return () => document.removeEventListener("keydown", k)
  }, [onClose])

  const save = async () => {
    setBusy(true)
    setErr("")
    try {
      const r = await api<{ tempPassword: string | null }>("/api/work/staff", { method: "POST", json: { ...toPayload(p), email, password, clinicIds } })
      onDone({ name: p.name, email, tempPassword: r.tempPassword })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-labelledby="add-title" className="w-full max-w-[440px] h-full bg-white border-l border-[#d1d1cc] flex flex-col">
        <div className="h-[52px] shrink-0 flex items-center px-4 border-b border-[#d1d1cc]">
          <h2 id="add-title" className="text-[15px] font-bold">
            직원 추가
          </h2>
          <button className="ml-auto w-8 h-8 flex items-center justify-center rounded hover:bg-[#ecece9]" aria-label="닫기" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <section>
            <h3 className="text-[12px] font-semibold text-[#6f6f6a] mb-1">계정</h3>
            <div className="grid grid-cols-[96px_1fr] items-center gap-2 py-1.5 border-b border-[#ecece9]">
              <span className="text-[13px] text-[#555555]">
                업무용 이메일<span className="text-[#d92d20]"> *</span>
              </span>
              <input aria-label="업무용 이메일" className={`${field} w-full`} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-[96px_1fr] items-center gap-2 py-1.5">
              <span className="text-[13px] text-[#555555]">초기 비밀번호</span>
              <input
                aria-label="초기 비밀번호"
                className={`${field} w-full`}
                type="password"
                placeholder="비우면 임시 비밀번호 자동 생성"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </section>
          <section>
            <h3 className="text-[12px] font-semibold text-[#6f6f6a] mb-1">기본정보</h3>
            <ProfileFields v={p} set={setP} withLeft={false} />
          </section>
          <section>
            <h3 className="text-[12px] font-semibold text-[#6f6f6a] mb-1">담당 치과</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {clinics.map((c) => (
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
          </section>
        </div>
        <div className="shrink-0 border-t border-[#d1d1cc] px-4 py-3 flex items-center gap-2">
          {err && <span className="text-[13px] text-[#d92d20] flex-1">{err}</span>}
          <button className={`${btnLine} ml-auto`} onClick={onClose}>
            취소
          </button>
          <button className={btn} disabled={busy} onClick={save}>
            {busy ? "저장 중…" : "추가"}
          </button>
        </div>
      </aside>
    </div>
  )
}
