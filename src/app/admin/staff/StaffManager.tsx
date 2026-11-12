"use client"

import { useEffect, useState } from "react"

type Clinic = { id: string; name: string }
type Staff = {
  id: string
  name: string
  email: string
  role: string
  status: string
  employee: { hiredOn: string; leftOn: string | null; clinicAccess: { clinicId: string }[] } | null
}
type Draft = { hiredOn: string; leftOn: string; clinicIds: string[] }

const d10 = (v: string | null | undefined) => (v ? v.slice(0, 10) : "")
const input = "h-8 px-2 rounded border border-[#d1d1cc] text-[14px] bg-white"
const btn = "h-8 px-3 rounded text-[14px] font-medium bg-[#191f28] text-white disabled:opacity-40"

export default function StaffManager() {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "", hiredOn: "", clinicIds: [] as string[] })

  const load = async () => {
    const r = await fetch("/api/admin/staff")
    const j = await r.json()
    if (!r.ok) return setMsg(j.error ?? "불러오기 실패")
    setClinics(j.clinics)
    setStaff(j.staff)
    setDrafts(
      Object.fromEntries(
        (j.staff as Staff[]).map((s) => [
          s.id,
          {
            hiredOn: d10(s.employee?.hiredOn),
            leftOn: d10(s.employee?.leftOn),
            clinicIds: s.employee?.clinicAccess.map((a) => a.clinicId) ?? [],
          },
        ])
      )
    )
  }
  useEffect(() => {
    load()
  }, [])

  const post = async (payload: object) => {
    setBusy(true)
    setMsg("")
    const r = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) return setMsg(j.error ?? "저장 실패"), false
    setMsg("저장했습니다")
    await load()
    return true
  }

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  return (
    <div className="space-y-4">
      {msg && <p className="text-[13px] text-[#333]">{msg}</p>}

      <section className="bg-white rounded border border-[#b9b9b3]">
        <h2 className="px-3 py-2 text-[15px] font-bold bg-[#ecece9] border-b border-[#d1d1cc]">직원 목록</h2>
        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-left text-[12px] text-[#6f6f6a] border-b border-[#ecece9]">
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2 w-[130px]">입사일</th>
              <th className="px-3 py-2 w-[130px]">퇴사일</th>
              <th className="px-3 py-2">담당 치과</th>
              <th className="px-3 py-2 w-[70px]" />
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const d = drafts[s.id]
              if (!d) return null
              const set = (p: Partial<Draft>) => setDrafts({ ...drafts, [s.id]: { ...d, ...p } })
              return (
                <tr key={s.id} className="border-b border-[#ecece9] last:border-0 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-[12px] text-[#6f6f6a]">
                      {s.email} · {s.role === "MASTER" ? "대표·관리자(전 치과)" : "직원"}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input type="date" className={input} value={d.hiredOn} onChange={(e) => set({ hiredOn: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="date" className={input} value={d.leftOn} onChange={(e) => set({ leftOn: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    {s.role === "MASTER" ? (
                      <span className="text-[13px] text-[#6f6f6a]">전체</span>
                    ) : (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {clinics.map((c) => (
                          <label key={c.id} className="flex items-center gap-1 text-[13px]">
                            <input
                              type="checkbox"
                              checked={d.clinicIds.includes(c.id)}
                              onChange={() => set({ clinicIds: toggle(d.clinicIds, c.id) })}
                            />
                            {c.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      className={btn}
                      disabled={busy || !d.hiredOn}
                      onClick={() => post({ action: "save", userId: s.id, ...d, leftOn: d.leftOn || null })}
                    >
                      저장
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded border border-[#b9b9b3]">
        <h2 className="px-3 py-2 text-[15px] font-bold bg-[#ecece9] border-b border-[#d1d1cc]">새 직원 계정</h2>
        <div className="p-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input className={input} placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={input} placeholder="이메일" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input
              className={input}
              type="password"
              placeholder="초기 비밀번호(8자 이상)"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <label className="flex items-center gap-1 text-[13px] text-[#6f6f6a]">
              입사일
              <input type="date" className={input} value={form.hiredOn} onChange={(e) => setForm({ ...form, hiredOn: e.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {clinics.map((c) => (
              <label key={c.id} className="flex items-center gap-1 text-[13px]">
                <input
                  type="checkbox"
                  checked={form.clinicIds.includes(c.id)}
                  onChange={() => setForm({ ...form, clinicIds: toggle(form.clinicIds, c.id) })}
                />
                {c.name}
              </label>
            ))}
          </div>
          <button
            className={btn}
            disabled={busy || !form.name || !form.email || form.password.length < 8 || !form.hiredOn}
            onClick={async () => {
              if (await post({ action: "create", ...form })) setForm({ name: "", email: "", password: "", hiredOn: "", clinicIds: [] })
            }}
          >
            계정 만들기
          </button>
        </div>
      </section>
    </div>
  )
}
