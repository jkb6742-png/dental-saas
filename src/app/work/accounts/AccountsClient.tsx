"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, Eye, EyeOff, ExternalLink, Lock, Pencil, Plus, Search, X, Check } from "lucide-react"
import { api, btn, btnLine, field } from "../ui"

type Clinic = { id: string; name: string }
type Account = {
  id: string
  clinicId: string | null
  category: string
  label: string | null
  loginId: string | null
  url: string | null
  memo: string | null
  visibility: "MASTER" | "STAFF"
  hasPassword: boolean
  passwordChangedAt: string | null
  updatedAt: string
}
type Draft = { id?: string; category: string; label: string; loginId: string; password: string; url: string; memo: string; visibility: "MASTER" | "STAFF" }

const EMPTY: Draft = { category: "", label: "", loginId: "", password: "", url: "", memo: "", visibility: "STAFF" }
const CATS = ["네이버", "인스타그램", "페이스북", "유튜브", "틱톡", "홈페이지 관리자", "구글", "gmail", "메타", "카카오", "디자인 소스", "기타"]
const TINTS = [
  ["#e8f0ff", "#0045b5"],
  ["#e7f6ec", "#1a7f37"],
  ["#fff1e6", "#b54708"],
  ["#f1ecff", "#5b3fd1"],
  ["#e6f6f8", "#0e7490"],
  ["#fdebec", "#b42318"],
]

// 계정 관리: 왼쪽 사내·치과, 오른쪽 분류별 계정 표. 비밀번호는 '보기'를 누를 때만 받아 오고 20초 뒤 다시 숨긴다.
export default function AccountsClient({ clinics, isMaster, initialScope }: { clinics: Clinic[]; isMaster: boolean; initialScope: string }) {
  const [scope, setScope] = useState(initialScope)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [q, setQ] = useState("")
  const [shown, setShown] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [edit, setEdit] = useState<Draft | null>(null)
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    try {
      const j = await api<{ accounts: Account[]; counts: Record<string, number> }>(`/api/work/accounts?scope=${scope}`)
      setAccounts(j.accounts)
      setCounts(j.counts)
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [scope])
  useEffect(() => {
    setAccounts(null)
    setShown({})
    load()
    try {
      window.history.replaceState(null, "", `/work/accounts?scope=${scope}`)
    } catch {}
  }, [load, scope])

  const reveal = async (id: string) => {
    if (shown[id] !== undefined) return setShown(({ [id]: _, ...rest }) => rest)
    try {
      const j = await api<{ password: string }>(`/api/work/accounts/${id}`, { method: "POST", json: { action: "reveal" } })
      setShown((s) => ({ ...s, [id]: j.password }))
      setTimeout(() => setShown(({ [id]: _, ...rest }) => rest), 20_000)
      return j.password
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const copy = async (key: string, text: string | undefined | null) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
    } catch {
      setErr("복사하지 못했습니다. 직접 선택해서 복사해 주세요")
    }
  }
  const copyPassword = async (id: string) => {
    const pw = shown[id] ?? (await api<{ password: string }>(`/api/work/accounts/${id}`, { method: "POST", json: { action: "reveal" } }).then((j) => j.password).catch(() => undefined))
    copy(`pw:${id}`, pw)
  }

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = (accounts ?? []).filter((a) => !s || [a.category, a.label, a.loginId, a.memo, a.url].some((v) => v?.toLowerCase().includes(s)))
    const m = new Map<string, Account[]>()
    for (const a of list) m.set(a.category, [...(m.get(a.category) ?? []), a])
    return [...m.entries()]
  }, [accounts, q])

  const cats = [{ id: "internal", name: "THINKLAB 사내" }, ...clinics]
  const current = cats.find((c) => c.id === scope)
  const canAdd = isMaster || scope !== "internal"

  return (
    <div className="flex gap-4 items-start">
      {/* 왼쪽: 사내·치과 */}
      <nav aria-label="계정 범위" className="w-[248px] shrink-0 bg-white rounded-md border border-[#d1d1cc] overflow-hidden sticky top-3">
        <div className="h-11 px-4 flex items-center border-b border-[#d1d1cc]">
          <span className="text-[14px] font-bold">계정 관리</span>
          <span className="ml-auto text-[11px] text-[#8a8a84]">계정 수</span>
        </div>
        {[
          { title: "사내", items: cats.slice(0, 1) },
          { title: `치과 ${clinics.length}곳`, items: cats.slice(1) },
        ].map((sec) => (
          <section key={sec.title} className="border-b border-[#d1d1cc] last:border-b-0">
            <h2 className="h-8 px-4 flex items-center text-[12px] font-semibold text-[#6f6f6a] bg-[#f7f7f5] border-b border-[#ecece9]">{sec.title}</h2>
            <ul className="py-1">
              {sec.items.map((c, i) => {
                const active = c.id === scope
                const [bg, fg] = c.id === "internal" ? ["#191f28", "#ffffff"] : TINTS[i % TINTS.length]
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setScope(c.id)}
                      aria-current={active ? "page" : undefined}
                      className={`w-full h-11 flex items-center gap-2.5 pl-4 pr-4 text-left text-[15px] ${active ? "bg-[#e8f0ff] text-[#0045b5] font-semibold shadow-[inset_3px_0_0_#0062ff]" : "text-[#222220] hover:bg-[#f5f5f2]"}`}
                    >
                      <span className="w-6 h-6 shrink-0 rounded flex items-center justify-center text-[12px] font-bold" style={{ background: bg, color: fg }} aria-hidden="true">
                        {c.id === "internal" ? "T" : c.name.slice(0, 1)}
                      </span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className={`text-[13px] tabular-nums ${counts[c.id] ? "text-[#3d3d3a] font-medium" : "text-[#c4c4be]"}`}>{counts[c.id] ?? 0}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </nav>

      {/* 오른쪽: 분류별 계정 */}
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[20px] font-bold">{current?.name ?? "계정"}</h1>
          <span className="text-[13px] text-[#8a8a84]">{accounts?.length ?? 0}개</span>
          <div className="ml-4 relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a8a84]" aria-hidden="true" />
            <input aria-label="계정 검색" className={`${field} w-[260px] pl-8`} placeholder="분류·용도·아이디·메모 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {canAdd && (
            <button className={`${btn} ml-auto inline-flex items-center gap-1`} onClick={() => setEdit({ ...EMPTY })}>
              <Plus className="w-4 h-4" aria-hidden="true" />
              계정 추가
            </button>
          )}
        </div>
        <p className="text-[12px] text-[#8a8a84]">비밀번호는 암호화해 저장하고, 보기·복사할 때마다 누가 봤는지 기록합니다. 보기를 누르면 20초 뒤 다시 가려집니다.</p>
        {err && (
          <p role="alert" className="text-[13px] text-[#d92d20]">
            {err}{" "}
            <button className="underline" onClick={() => setErr("")}>
              닫기
            </button>
          </p>
        )}

        {!accounts ? (
          <p className="text-[13px] text-[#8a8a84]">불러오는 중…</p>
        ) : !groups.length ? (
          <div className="bg-white rounded-md border border-[#d1d1cc] px-6 py-10 text-center text-[14px] text-[#6f6f6a]">
            {q ? "검색 결과가 없습니다." : "등록된 계정이 없습니다."}
            {canAdd && !q && (
              <button className="ml-2 text-[#0062ff] hover:underline" onClick={() => setEdit({ ...EMPTY })}>
                계정 추가
              </button>
            )}
          </div>
        ) : (
          groups.map(([cat, list]) => (
            <section key={cat} className="bg-white rounded-md border border-[#d1d1cc] overflow-hidden">
              <div className="h-11 px-4 flex items-center gap-2 bg-[#f7f7f5] border-b border-[#ecece9] shadow-[inset_3px_0_0_#191f28]">
                <h2 className="text-[15px] font-semibold">{cat}</h2>
                <span className="text-[12px] text-[#8a8a84]">{list.length}</span>
              </div>
              <table className="w-full text-[14px] table-fixed">
                <thead>
                  <tr className="text-[12px] text-[#6f6f6a] border-b border-[#ecece9]">
                    <th className="text-left font-medium px-4 py-2 w-[18%]">용도</th>
                    <th className="text-left font-medium px-2 w-[24%]">아이디</th>
                    <th className="text-left font-medium px-2 w-[22%]">비밀번호</th>
                    <th className="text-left font-medium px-2 w-[8%]">링크</th>
                    <th className="text-left font-medium px-2">메모</th>
                    <th className="w-[56px]" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id} className="h-12 border-b border-[#f2f2ef] last:border-0 hover:bg-[#fafaf8]">
                      <td className="px-4 truncate">
                        {a.label ?? <span className="text-[#b0b0aa]">-</span>}
                        {a.visibility === "MASTER" && (
                          <span title="대표만 봄" className="ml-1.5 inline-flex align-middle text-[#b54708]">
                            <Lock className="w-3.5 h-3.5" aria-label="대표만 봄" />
                          </span>
                        )}
                      </td>
                      <td className="px-2">
                        {a.loginId ? (
                          <span className="inline-flex items-center gap-1.5 max-w-full">
                            <span className="truncate font-mono text-[13px]">{a.loginId}</span>
                            <IconBtn label="아이디 복사" onClick={() => copy(`id:${a.id}`, a.loginId)} done={copied === `id:${a.id}`} />
                          </span>
                        ) : (
                          <span className="text-[#b0b0aa]">-</span>
                        )}
                      </td>
                      <td className="px-2">
                        {a.hasPassword ? (
                          <span className="inline-flex items-center gap-1.5 max-w-full">
                            <span className={`truncate font-mono text-[13px] ${shown[a.id] !== undefined ? "" : "tracking-[0.15em] text-[#8a8a84]"}`}>{shown[a.id] ?? "••••••••"}</span>
                            <button className="w-7 h-7 shrink-0 flex items-center justify-center rounded text-[#6f6f6a] hover:bg-[#ecece9]" aria-label={shown[a.id] !== undefined ? "비밀번호 가리기" : "비밀번호 보기"} title={shown[a.id] !== undefined ? "가리기" : "보기"} onClick={() => reveal(a.id)}>
                              {shown[a.id] !== undefined ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <IconBtn label="비밀번호 복사" onClick={() => copyPassword(a.id)} done={copied === `pw:${a.id}`} />
                          </span>
                        ) : (
                          <span className="text-[#b0b0aa]">-</span>
                        )}
                      </td>
                      <td className="px-2">
                        {a.url ? (
                          <a href={a.url.startsWith("http") ? a.url : `https://${a.url}`} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[13px] text-[#0062ff] hover:underline" title={a.url}>
                            열기 <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="text-[#b0b0aa]">-</span>
                        )}
                      </td>
                      <td className="px-2 text-[13px] text-[#555555] truncate" title={a.memo ?? ""}>
                        {a.memo ?? ""}
                      </td>
                      <td className="pr-3 text-right">
                        {(isMaster || a.clinicId) && (
                          <button
                            className="w-8 h-8 inline-flex items-center justify-center rounded text-[#6f6f6a] hover:bg-[#ecece9]"
                            aria-label={`${a.category} ${a.label ?? ""} 수정`}
                            onClick={() => setEdit({ id: a.id, category: a.category, label: a.label ?? "", loginId: a.loginId ?? "", password: "", url: a.url ?? "", memo: a.memo ?? "", visibility: a.visibility })}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        )}
      </div>

      {edit && (
        <EditDrawer
          draft={edit}
          isMaster={isMaster}
          hasPassword={!!accounts?.find((a) => a.id === edit.id)?.hasPassword}
          onClose={() => setEdit(null)}
          onSave={async (d, pwTouched) => {
            const json: Record<string, unknown> = { clinicId: scope, category: d.category, label: d.label, loginId: d.loginId, url: d.url, memo: d.memo, visibility: d.visibility }
            if (!d.id || pwTouched) json.password = d.password
            if (d.id) await api(`/api/work/accounts/${d.id}`, { method: "PATCH", json })
            else await api("/api/work/accounts", { method: "POST", json })
            setEdit(null)
            load()
          }}
          onDelete={
            isMaster && edit.id
              ? async () => {
                  await api(`/api/work/accounts/${edit.id}`, { method: "DELETE" })
                  setEdit(null)
                  load()
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

function IconBtn({ label, onClick, done }: { label: string; onClick: () => void; done: boolean }) {
  return (
    <button className={`w-7 h-7 shrink-0 flex items-center justify-center rounded hover:bg-[#ecece9] ${done ? "text-[#1a7f37]" : "text-[#6f6f6a]"}`} aria-label={label} title={done ? "복사함" : label} onClick={onClick}>
      {done ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  )
}

function EditDrawer({
  draft,
  isMaster,
  hasPassword,
  onClose,
  onSave,
  onDelete,
}: {
  draft: Draft
  isMaster: boolean
  hasPassword: boolean
  onClose: () => void
  onSave: (d: Draft, pwTouched: boolean) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [d, setD] = useState(draft)
  const [pwTouched, setPwTouched] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", k)
    return () => document.removeEventListener("keydown", k)
  }, [onClose])
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setErr("")
    try {
      await fn()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const row = (label: string, el: React.ReactNode, need?: boolean) => (
    <div className="grid grid-cols-[88px_1fr] items-center gap-2 py-2 border-b border-[#ecece9] last:border-0">
      <span className="text-[13px] text-[#555555]">
        {label}
        {need && <span className="text-[#d92d20]"> *</span>}
      </span>
      <div className="min-w-0">{el}</div>
    </div>
  )
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-labelledby="acc-title" className="w-full max-w-[440px] h-full bg-white border-l border-[#d1d1cc] flex flex-col">
        <div className="h-[52px] shrink-0 flex items-center px-4 border-b border-[#d1d1cc]">
          <h2 id="acc-title" className="text-[15px] font-bold">
            {d.id ? "계정 수정" : "계정 추가"}
          </h2>
          <button className="ml-auto w-8 h-8 flex items-center justify-center rounded hover:bg-[#ecece9]" aria-label="닫기" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {row(
            "분류",
            <>
              <input aria-label="분류" list="acc-cats" className={`${field} w-full`} placeholder="네이버, 인스타그램 …" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} />
              <datalist id="acc-cats">
                {CATS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>,
            true
          )}
          {row("용도", <input aria-label="용도" className={`${field} w-full`} placeholder="예: 블로그 본계정" value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} />)}
          {row("아이디", <input aria-label="아이디" className={`${field} w-full font-mono`} autoComplete="off" value={d.loginId} onChange={(e) => setD({ ...d, loginId: e.target.value })} />)}
          {row(
            "비밀번호",
            <div className="flex gap-1">
              <input
                aria-label="비밀번호"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                className={`${field} flex-1 font-mono`}
                placeholder={d.id && hasPassword && !pwTouched ? "바꿀 때만 입력" : ""}
                value={d.password}
                onChange={(e) => {
                  setPwTouched(true)
                  setD({ ...d, password: e.target.value })
                }}
              />
              <button type="button" className="w-8 h-8 flex items-center justify-center rounded border border-[#d1d1cc] text-[#6f6f6a]" aria-label={showPw ? "가리기" : "보기"} onClick={() => setShowPw((v) => !v)}>
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}
          {row("링크", <input aria-label="링크" className={`${field} w-full`} placeholder="https://" value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} />)}
          {row("메모", <textarea aria-label="메모" className="w-full min-h-[64px] px-2 py-1 rounded border border-[#d1d1cc] bg-white text-[14px]" value={d.memo} onChange={(e) => setD({ ...d, memo: e.target.value })} />)}
          {isMaster &&
            row(
              "공개 범위",
              <span className="flex gap-4 text-[14px]">
                <label className="flex items-center gap-1">
                  <input type="radio" checked={d.visibility === "STAFF"} onChange={() => setD({ ...d, visibility: "STAFF" })} /> 담당 직원도
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" checked={d.visibility === "MASTER"} onChange={() => setD({ ...d, visibility: "MASTER" })} /> 대표만
                </label>
              </span>
            )}
        </div>
        <div className="shrink-0 border-t border-[#d1d1cc] px-4 py-3 flex items-center gap-2">
          {err && <span className="text-[13px] text-[#d92d20] flex-1">{err}</span>}
          {onDelete && (
            <button className={`${btnLine} text-[#d92d20]`} disabled={busy} onClick={() => window.confirm(`${d.category} ${d.label} 계정을 지웁니다. 되돌릴 수 없습니다.`) && run(onDelete)}>
              삭제
            </button>
          )}
          <button className={`${btnLine} ml-auto`} onClick={onClose}>
            취소
          </button>
          <button className={btn} disabled={busy || !d.category.trim()} onClick={() => run(() => onSave(d, pwTouched))}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </aside>
    </div>
  )
}
