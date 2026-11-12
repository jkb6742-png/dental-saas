"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, ChevronRight as Arrow, RefreshCw } from "lucide-react"
import type { ExecData } from "./data"
import { TrendChart, AgingBars } from "./Charts"
import { man, md, monthDot, shiftMonth } from "./format"

const card = "bg-white rounded border border-[#d1d1cc]"
const STATE_COLOR: Record<string, string> = {
  OVERDUE: "text-[#d92d20]",
  PARTIAL: "text-[#b54708]",
  DUE: "text-[#b54708]",
  PAID: "text-[#1a7f37]",
  PLANNED: "text-[#6f6f6a]",
}
const REFRESH_MS = 5 * 60_000

export default function ExecClient({ initial }: { initial: ExecData }) {
  const [data, setData] = useState(initial)
  const [month, setMonth] = useState(initial.month)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const first = useRef(true)

  const load = useCallback(async (m: string) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/work/exec?month=${m}`, { cache: "no-store" })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? "불러오지 못했습니다")
      setData(j as ExecData)
      setErr("")
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  // 월 바꾸면 다시 읽고 주소에도 남긴다(첫 화면은 서버가 이미 읽음)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const u = new URL(window.location.href)
    u.searchParams.set("month", month)
    window.history.replaceState(null, "", u.toString())
    load(month)
  }, [month, load])

  // 5분마다, 탭 다시 볼 때 즉시
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && load(month), REFRESH_MS)
    const onVis = () => document.visibilityState === "visible" && load(month)
    document.addEventListener("visibilitychange", onVis)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [month, load])

  const k = data.kpi
  const isCurrent = month === data.today.slice(0, 7)

  return (
    <div className="space-y-3 text-[14px]">
      {/* 머리줄 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-[18px] font-semibold">경영 현황</h1>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw size={14} className="animate-spin text-[#8a8a84]" aria-label="불러오는 중" />}
          <div className="flex items-center rounded border border-[#d1d1cc] bg-white">
            <button type="button" aria-label="이전 달" className="h-8 w-8 grid place-items-center hover:bg-[#ecece9]" onClick={() => setMonth(shiftMonth(month, -1))}>
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 tabular-nums font-medium min-w-[72px] text-center">{monthDot(month)}</span>
            <button type="button" aria-label="다음 달" className="h-8 w-8 grid place-items-center hover:bg-[#ecece9]" onClick={() => setMonth(shiftMonth(month, 1))}>
              <ChevronRight size={16} />
            </button>
          </div>
          {!isCurrent && (
            <button type="button" className="h-8 px-3 rounded border border-[#d1d1cc] bg-white hover:bg-[#ecece9] text-[13px]" onClick={() => setMonth(data.today.slice(0, 7))}>
              이번 달
            </button>
          )}
        </div>
      </div>
      {err && <p className="text-[13px] text-[#d92d20]">{err}</p>}

      {/* 1. KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Kpi href={`/work/billing?month=${month}`} label="월 매출" note="부가세 제외" value={man(k.revenue)}
          sub={k.revenueCount ? `청구 ${k.revenueCount}건 · 청구액 ${man(k.revenueGross)}` : "이 달 청구 없음"} />
        <Kpi href={`/work/billing?month=${month}`} label="당월 입금" value={man(k.received)}
          sub={k.receivedCount ? `입금 ${k.receivedCount}건` : "이 달 입금 없음"} />
        <Kpi href="/work/billing" label="총 미수금" note="오늘 기준" value={man(k.outstanding)} danger={k.outstanding > 0 && data.overdue.length > 0}
          sub={k.outstandingCount ? `${k.outstandingCount}건${data.overdue.length ? ` · 연체 ${data.overdue.length}건` : ""}` : "받을 돈 없음"} />
        <Kpi href="/work/contracts" label="30일 내 만료 계약" value={`${k.expiring}건`} warn={k.expiring > 0}
          sub={data.expiringContracts[0] ? `가장 빠른 만료 ${md(data.expiringContracts[0].endsOn)}` : "만료 예정 없음"} />
        <Kpi href="/work/staff" label="인건비 비율" value={k.laborRatio === null ? "-" : `${Math.round(k.laborRatio * 1000) / 10}%`}
          sub={k.payrollHeadcount ? `월 인건비 ${man(k.payrollMonthly)} · ${k.payrollHeadcount}명` : "연봉 기록 없음"} />
      </div>

      {/* 2. 그래프 */}
      {data.hasBilling ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <section className={`${card} p-4`}>
            <h2 className="text-[14px] font-semibold mb-3">최근 6개월 매출·입금</h2>
            <TrendChart data={data.trend} />
          </section>
          <section className={`${card} p-4`}>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[14px] font-semibold">미수금 경과 기간</h2>
              <span className="text-[12px] text-[#8a8a84]">입금 예정일 기준 · 오늘</span>
            </div>
            <AgingBars data={data.aging} />
          </section>
        </div>
      ) : (
        <section className={`${card} px-4 py-10 text-center`}>
          <p className="text-[14px] text-[#3a3a36]">계약에 청구일을 넣으면 매달 청구가 생기고 여기에 표시됩니다.</p>
          <Link href="/work/contracts" className="inline-flex items-center gap-1 mt-3 text-[13px] text-[#0062ff] hover:underline">
            계약 화면으로 <Arrow size={14} />
          </Link>
        </section>
      )}

      {/* 3. 하단 */}
      <div className="grid grid-cols-1 xl:grid-cols-[7fr_3fr] gap-3 items-start">
        <section className={card}>
          <div className="flex items-baseline justify-between px-4 pt-3 pb-2">
            <h2 className="text-[14px] font-semibold">치과별 수익성</h2>
            <span className="text-[12px] text-[#8a8a84]">{Number(month.slice(5, 7))}월 · 금액 부가세 제외</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] tabular-nums">
              <thead>
                <tr>
                  <Th>치과</Th>
                  <Th>플랜</Th>
                  <Th className="text-right">월 금액</Th>
                  <Th>이번 달 청구·입금</Th>
                  <Th className="text-right">계약 이행률</Th>
                  <Th className="text-right">추정 원가</Th>
                </tr>
              </thead>
              <tbody>
                {data.clinics.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-[#6f6f6a]">등록된 치과가 없습니다.</td>
                  </tr>
                )}
                {data.clinics.map((c) => {
                  const rate = c.quotaTarget ? c.quotaDone / c.quotaTarget : null
                  return (
                    <tr key={c.clinicId} className="hover:bg-[#fafaf8]">
                      <Td>
                        <Link href={`/work/clinics/${c.clinicId}`} className="hover:text-[#0062ff]">{c.name}</Link>
                      </Td>
                      <Td className={c.planName ? "" : "text-[#8a8a84]"}>{c.planName ?? "계약 없음"}</Td>
                      <Td className="text-right">
                        {c.monthlyFee === null ? <span className="text-[#8a8a84]">-</span> : man(c.monthlyFee)}
                        {c.vatNote && c.vatNote !== "VAT 별도" && <div className="text-[11px] text-[#8a8a84]">{c.vatNote}</div>}
                      </Td>
                      <Td>
                        <span className={c.billState ? STATE_COLOR[c.billState] ?? "" : "text-[#8a8a84]"}>{c.billLabel}</span>
                        {c.billAmount !== null && (
                          <span className="ml-2 text-[12px] text-[#6f6f6a]">
                            {man(c.paid)} / {man(c.billAmount)}
                          </span>
                        )}
                      </Td>
                      <Td className="text-right">
                        {rate === null ? (
                          <span className="text-[#8a8a84]">-</span>
                        ) : (
                          <span className={rate < 0.5 ? "text-[#b54708]" : rate >= 1 ? "text-[#1a7f37]" : ""}>
                            {Math.round(rate * 100)}%<span className="ml-1 text-[12px] text-[#8a8a84]">{c.quotaDone}/{c.quotaTarget}</span>
                          </span>
                        )}
                      </Td>
                      <Td className="text-right text-[12px] text-[#8a8a84] whitespace-nowrap">작업시간 기록 후 표시</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${card} divide-y divide-[#ecece9]`}>
          <h2 className="px-4 pt-3 pb-2 text-[14px] font-semibold">대표 확인</h2>

          <Group title="만료 예정 계약" href="/work/contracts" count={data.expiringContracts.length} empty="30일 안에 끝나는 계약이 없습니다.">
            {data.expiringContracts.map((c) => (
              <Row key={c.id} left={`${c.clinicName} · ${c.planName}`}
                right={<span className={c.daysLeft <= 7 ? "text-[#d92d20]" : "text-[#b54708]"}>{c.daysLeft === 0 ? "오늘" : `${md(c.endsOn)} · ${c.daysLeft}일 남음`}</span>} />
            ))}
          </Group>

          <Group title="연체 청구" href="/work/billing" count={data.overdue.length} empty="연체된 청구가 없습니다.">
            {data.overdue.map((o) => (
              <Row key={o.id} left={`${o.clinicName} ${Number(o.serviceMonth.slice(5, 7))}월 · ${man(o.remaining)}`}
                right={<span className="text-[#d92d20]">{o.daysOver}일 지연</span>} />
            ))}
          </Group>

          <Group title="영업 진행 중" href="/work/sales" count={data.sales.reduce((s, g) => s + g.count, 0)} empty="진행 중인 영업 기회가 없습니다.">
            {data.sales.map((g) => (
              <div key={g.stage} className="py-1">
                <div className="flex justify-between text-[12px] text-[#6f6f6a]">
                  <span>{g.label} {g.count}건</span>
                  {g.expected > 0 && <span className="tabular-nums">예상 월 {man(g.expected)}</span>}
                </div>
                {g.items.slice(0, 4).map((it) => (
                  <Row key={it.id} left={it.name}
                    right={<span className="text-[#6f6f6a]">{it.expected ? man(it.expected) : ""}{it.nextActionOn ? `${it.expected ? " · " : ""}${md(it.nextActionOn)}` : ""}</span>} />
                ))}
                {g.items.length > 4 && <p className="text-[12px] text-[#8a8a84]">외 {g.items.length - 4}건</p>}
              </div>
            ))}
          </Group>
        </section>
      </div>
    </div>
  )
}

function Kpi(p: { href: string; label: string; note?: string; value: string; sub: string; danger?: boolean; warn?: boolean }) {
  return (
    <Link href={p.href} className={`${card} block px-4 py-3 hover:border-[#8a8a84] transition-colors`}>
      <div className="flex items-baseline gap-1 text-[12px] text-[#6f6f6a]">
        <span>{p.label}</span>
        {p.note && <span className="text-[11px] text-[#8a8a84]">({p.note})</span>}
      </div>
      <div className={`mt-1 text-[22px] font-semibold tabular-nums ${p.danger ? "text-[#d92d20]" : p.warn ? "text-[#b54708]" : ""}`}>{p.value}</div>
      <div className="mt-0.5 text-[12px] text-[#8a8a84] tabular-nums truncate">{p.sub}</div>
    </Link>
  )
}

function Group({ title, href, count, empty, children }: { title: string; href: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] font-medium">
          {title} <span className="tabular-nums text-[#6f6f6a]">{count}</span>
        </span>
        <Link href={href} className="text-[12px] text-[#0062ff] hover:underline">보기</Link>
      </div>
      {count === 0 ? <p className="text-[12px] text-[#8a8a84]">{empty}</p> : children}
    </div>
  )
}

function Row({ left, right }: { left: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-[13px]">
      <span className="truncate">{left}</span>
      <span className="shrink-0 tabular-nums text-[12px]">{right}</span>
    </div>
  )
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`py-2 px-3 text-left text-[12px] font-medium text-[#6f6f6a] border-y border-[#d1d1cc] whitespace-nowrap ${className}`}>{children}</th>
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`py-2 px-3 border-b border-[#ecece9] align-top ${className}`}>{children}</td>
}
