"use client"

// 직원 화면 공통 스타일·작은 부품 (브라우저 전용)

export const field = "h-8 px-2 rounded border border-[#d1d1cc] bg-white text-[14px]"
export const btn = "h-8 px-3 whitespace-nowrap rounded text-[14px] font-medium bg-[#191f28] text-white disabled:opacity-40"
export const btnLine = "h-8 px-3 whitespace-nowrap rounded text-[14px] border border-[#d1d1cc] bg-white hover:bg-[#ecece9] disabled:opacity-40"
export const card = "bg-white rounded border border-[#b9b9b3]"

export const kst = (iso: string | null | undefined) =>
  iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ") : ""
export const kstDay = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10) : "")
export const d10 = (v: string | null | undefined) => (v ? v.slice(0, 10) : "")
export const won = (n: number | null | undefined) => (n === null || n === undefined ? "-" : `${n.toLocaleString("ko-KR")}원`)
export const bytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`)

export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "content-type": "application/json", ...(init?.headers ?? {}) } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? "요청 실패")
  return j as T
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="p-3 text-[13px] text-[#6f6f6a]">{children}</p>
}

export function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`py-2 px-2 text-left text-[12px] font-medium text-[#6f6f6a] border-b border-[#d1d1cc] ${className}`}>{children}</th>
}
export function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`py-2 px-2 border-b border-[#ecece9] align-top ${className}`}>{children}</td>
}

export type Presence = { workMode: "OFFICE" | "REMOTE"; ip: string; enforced: boolean; officeOk: boolean; network: string | null } | null

/** 출퇴근 버튼 옆 안내: 사무실 네트워크 여부·재택 안내 */
export function PresenceNote({ p }: { p: Presence }) {
  if (!p) return null
  if (p.workMode === "REMOTE")
    return <span className="text-[12px] text-[#6f6f6a]">재택 근무: 근무 중 무작위로 확인 QR이 뜹니다. 휴대폰으로 찍어 주세요.</span>
  if (!p.enforced) return <span className="text-[12px] text-[#6f6f6a]">사무실 네트워크가 아직 등록되지 않았습니다.</span>
  return p.officeOk ? (
    <span className="text-[12px] text-[#6f6f6a]">사무실 네트워크{p.network ? `(${p.network})` : ""}에서 접속 중</span>
  ) : (
    <span className="text-[12px] text-[#d92d20]">사무실 네트워크가 아닙니다(현재 IP {p.ip}). 사무실 컴퓨터에서 찍어 주세요.</span>
  )
}
