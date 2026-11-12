"use client"

import { useCallback, useEffect, useState } from "react"
import { field, btn, card, kstDay, api, Empty, Th, Td } from "../ui"

type Clinic = { id: string; name: string }
type Item = {
  id: string
  clinicId: string
  kind: "BLOG" | "COLUMN"
  source: string
  title: string
  url: string
  publishedAt: string
  serviceMonth: string
  primaryKeyword: string | null
  verification: "PENDING" | "VERIFIED" | "REJECTED"
  unpublishedAt: string | null
  clinic: { name: string }
  author: { name: string } | null
  authorNameSnapshot: string | null
  task: { title: string } | null
}

const KIND = { BLOG: "블로그", COLUMN: "홈페이지 칼럼" }
const SOURCE: Record<string, string> = { MANUAL: "직접", BOKBOK: "bokbok", WEBSITE: "홈페이지" }
const VERIF = { PENDING: "확인 전", VERIFIED: "확인", REJECTED: "제외" }

export default function ContentClient({ clinics, initialClinic, initialMonth }: { clinics: Clinic[]; initialClinic: string; initialMonth: string }) {
  const [filter, setFilter] = useState({ clinicId: initialClinic, month: initialMonth, kind: "" })
  const [items, setItems] = useState<Item[]>([])
  const [err, setErr] = useState("")
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const [f, setF] = useState({ clinicId: initialClinic || clinics[0]?.id || "", kind: "BLOG", title: "", url: "", publishedOn: today, serviceMonth: initialMonth, primaryKeyword: "" })

  const load = useCallback(async () => {
    const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v))
    try {
      setItems((await api<{ items: Item[] }>(`/api/work/content?${q}`)).items)
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [filter])
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
  const counts = items.reduce(
    (m, i) => {
      if (i.unpublishedAt || i.verification === "REJECTED") return m
      m[i.kind]++
      return m
    },
    { BLOG: 0, COLUMN: 0 }
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[20px] font-bold mr-2">발행 기록</h1>
        <select className={field} value={filter.clinicId} onChange={(e) => setFilter({ ...filter, clinicId: e.target.value })}>
          <option value="">담당 치과 전체</option>
          {clinics.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input type="month" className={field} value={filter.month} onChange={(e) => setFilter({ ...filter, month: e.target.value })} />
        <select className={field} value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value })}>
          <option value="">블로그·칼럼</option>
          <option value="BLOG">블로그</option>
          <option value="COLUMN">홈페이지 칼럼</option>
        </select>
        <span className="text-[13px] text-[#6f6f6a] ml-2">
          실적 인정 블로그 <b className="text-[#0a0a0a]">{counts.BLOG}</b> · 칼럼 <b className="text-[#0a0a0a]">{counts.COLUMN}</b>
        </span>
      </div>

      <div className={`${card} p-3 flex flex-wrap items-center gap-2`}>
        <select className={field} value={f.clinicId} onChange={(e) => setF({ ...f, clinicId: e.target.value })}>
          {clinics.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className={field} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          <option value="BLOG">블로그</option>
          <option value="COLUMN">홈페이지 칼럼</option>
        </select>
        <input className={`${field} w-[220px]`} placeholder="제목" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input className={`${field} flex-1 min-w-[220px]`} placeholder="글 주소 https://" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
        <label className="text-[12px] text-[#6f6f6a]">발행일</label>
        <input type="date" className={field} value={f.publishedOn} onChange={(e) => setF({ ...f, publishedOn: e.target.value })} />
        <label className="text-[12px] text-[#6f6f6a]">이행 대상월</label>
        <input type="month" className={field} value={f.serviceMonth} onChange={(e) => setF({ ...f, serviceMonth: e.target.value })} />
        <input className={`${field} w-[140px]`} placeholder="대표 키워드" value={f.primaryKeyword} onChange={(e) => setF({ ...f, primaryKeyword: e.target.value })} />
        <button
          className={btn}
          onClick={() =>
            act(async () => {
              await api("/api/work/content", {
                method: "POST",
                json: { clinicId: f.clinicId, kind: f.kind, title: f.title, url: f.url, publishedAt: `${f.publishedOn}T12:00:00+09:00`, serviceMonth: f.serviceMonth, primaryKeyword: f.primaryKeyword },
              })
              setF({ ...f, title: "", url: "", primaryKeyword: "" })
            })
          }
        >
          기록
        </button>
      </div>
      {err && <p className="text-[13px] text-[#d92d20]">{err}</p>}

      <div className={card}>
        {items.length === 0 ? (
          <Empty>이 달 이행 대상 기록이 없습니다.</Empty>
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr>
                {!filter.clinicId && <Th className="w-[120px]">치과</Th>}
                <Th className="w-[90px]">종류</Th>
                <Th>제목</Th>
                <Th className="w-[96px]">발행일</Th>
                <Th className="w-[96px]">대상월</Th>
                <Th className="w-[70px]">출처</Th>
                <Th className="w-[160px]">확인</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={i.unpublishedAt || i.verification === "REJECTED" ? "text-[#b0b0aa]" : ""}>
                  {!filter.clinicId && <Td className="text-[#6f6f6a]">{i.clinic.name}</Td>}
                  <Td>{KIND[i.kind]}</Td>
                  <Td>
                    <a href={i.url} target="_blank" rel="noreferrer" className={`hover:underline ${i.unpublishedAt ? "line-through" : ""}`}>
                      {i.title}
                    </a>
                    <div className="text-[12px] text-[#6f6f6a]">
                      {i.primaryKeyword && <>키워드 {i.primaryKeyword} · </>}
                      {i.author?.name ?? i.authorNameSnapshot ?? ""}
                      {i.task && <> · 업무 {i.task.title}</>}
                      {i.unpublishedAt && " · 내린 글"}
                    </div>
                  </Td>
                  <Td>{kstDay(i.publishedAt)}</Td>
                  <Td>
                    <input
                      type="month"
                      className="h-7 px-1 rounded border border-[#d1d1cc] text-[12px] w-[92px]"
                      defaultValue={i.serviceMonth.slice(0, 7)}
                      onBlur={(e) => e.target.value !== i.serviceMonth.slice(0, 7) && act(() => api(`/api/work/content/${i.id}`, { method: "PATCH", json: { serviceMonth: e.target.value } }))}
                    />
                  </Td>
                  <Td className="text-[12px]">{SOURCE[i.source]}</Td>
                  <Td>
                    <div className="flex gap-1 items-center">
                      <select
                        className="h-7 px-1 rounded border border-[#d1d1cc] text-[12px]"
                        value={i.verification}
                        onChange={(e) => act(() => api(`/api/work/content/${i.id}`, { method: "PATCH", json: { verification: e.target.value } }))}
                      >
                        {Object.entries(VERIF).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <button className="text-[12px] underline" onClick={() => act(() => api(`/api/work/content/${i.id}`, { method: "PATCH", json: { unpublished: !i.unpublishedAt } }))}>
                        {i.unpublishedAt ? "되살림" : "내림"}
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[12px] text-[#6f6f6a]">
        이행 대상월은 계약상 어느 달 분량인지입니다. 10월분을 11월 3일에 올렸다면 발행일은 11월 3일, 대상월은 10월로 둡니다. bokbok 에서 발행하면 자동으로 들어오고 &lsquo;확인 전&rsquo;으로 표시됩니다(확인 전도 실적에 셉니다. &lsquo;제외&rsquo;로 바꾸면 빠집니다).
      </p>
    </div>
  )
}
