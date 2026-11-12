"use client"

import { useCallback, useEffect, useState } from "react"
import { api, btn, btnLine, card, field, kst, Th, Td, Empty } from "../ui"
import { RemoteCheckModal } from "../RemoteCheckPopup"

type Net = { id: string; name: string; cidr: string; enabled: boolean; updatedAt: string }
type Check = {
  id: string
  scheduledAt: string
  shownAt: string | null
  verifiedAt: string | null
  status: string
  reissueCount: number
  wrongAttempts: number
  verifiedIp: string | null
  reason: string | null
  employee: { user: { name: string } }
}
type Data = {
  networks: Net[]
  setting: { remoteChecksPerDay: number; qrSeconds: number; graceMinutes: number }
  date: string
  checks: Check[]
  myIp: string
}
const RC: Record<string, string> = { SCHEDULED: "예정", SHOWN: "표시 중", VERIFIED: "인증", MISSED: "미인증", CANCELLED: "취소(퇴근)", EXCUSED: "사유 인정" }
const sec = (iso: string | null) => (iso ? kst(iso).slice(11) : "-")

export default function PresenceClient() {
  const [date, setDate] = useState(new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10))
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState("")
  const [msg, setMsg] = useState("")
  const [net, setNet] = useState({ name: "", cidr: "" })
  const [s, setS] = useState({ remoteChecksPerDay: "2", qrSeconds: "90", graceMinutes: "5" })
  const [preview, setPreview] = useState<{ qr: string; matchCode: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const j = await api<Data>(`/api/work/attendance-settings?date=${date}`)
      setD(j)
      setS({ remoteChecksPerDay: String(j.setting.remoteChecksPerDay), qrSeconds: String(j.setting.qrSeconds), graceMinutes: String(j.setting.graceMinutes) })
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [date])
  useEffect(() => {
    load()
  }, [load])
  // ?preview=1 로 열면 QR 창 미리보기를 바로 띄운다
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("preview") === "1")
      api<{ qr: string; matchCode: string }>("/api/work/attendance-settings", { method: "POST", json: { action: "preview" } }).then(setPreview).catch(() => {})
  }, [])

  const post = async (json: Record<string, unknown>, ok: string) => {
    setErr("")
    setMsg("")
    try {
      await api("/api/work/attendance-settings", { method: "POST", json })
      setMsg(ok)
      await load()
      return true
    } catch (e) {
      setErr((e as Error).message)
      return false
    }
  }

  const inList = d?.networks.some((n) => n.enabled && n.cidr === d.myIp)

  return (
    <div className="space-y-4">
      {preview && (
        <RemoteCheckModal qr={preview.qr} matchCode={preview.matchCode} qrLeft={Number(s.qrSeconds) || 90} left={(Number(s.graceMinutes) || 5) * 60} preview onClose={() => setPreview(null)} />
      )}
      <div>
        <h1 className="text-[20px] font-bold">근태 설정</h1>
        <p className="text-[13px] text-[#6f6f6a]">사무실 근무자는 아래 네트워크에서만 출퇴근을 찍을 수 있습니다. 재택 근무자는 근무 중 무작위 시각에 QR 확인을 받습니다.</p>
      </div>
      {(msg || err) && <p className={`text-[13px] ${err ? "text-[#d92d20]" : "text-[#1a7f37]"}`}>{err || msg}</p>}

      <section className={card}>
        <div className="px-4 pt-3 flex items-center">
          <h2 className="text-[15px] font-semibold">출퇴근 허용 네트워크</h2>
          <span className="ml-auto text-[13px] text-[#6f6f6a]">
            지금 이 컴퓨터 IP <span className="font-mono text-[#0a0a0a]">{d?.myIp ?? "-"}</span>
          </span>
        </div>
        {d && !d.networks.length && (
          <p className="px-4 pt-2 text-[13px] text-[#b54708]">등록된 네트워크가 없어 지금은 어디서나 출퇴근이 찍힙니다. 사무실 IP를 등록하면 바로 제한됩니다.</p>
        )}
        {!d ? (
          <Empty>불러오는 중…</Empty>
        ) : (
          d.networks.length > 0 && (
            <table className="w-full text-[14px] mt-2">
              <thead>
                <tr>
                  <Th>이름</Th>
                  <Th>공인 IP / 범위</Th>
                  <Th>사용</Th>
                  <Th>변경일</Th>
                  <Th className="w-[60px]" />
                </tr>
              </thead>
              <tbody>
                {d.networks.map((n) => (
                  <tr key={n.id}>
                    <Td>{n.name}</Td>
                    <Td className="font-mono">{n.cidr}</Td>
                    <Td>
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={n.enabled} onChange={(e) => post({ action: "toggleNetwork", id: n.id, enabled: e.target.checked }, "바꿨습니다")} />
                        {n.enabled ? "사용" : "중지"}
                      </label>
                    </Td>
                    <Td className="text-[13px] text-[#6f6f6a]">{kst(n.updatedAt).slice(0, 10)}</Td>
                    <Td>
                      <button
                        className="text-[13px] text-[#6f6f6a] hover:text-[#d92d20]"
                        onClick={() => window.confirm(`${n.name}(${n.cidr})을 지웁니다. 이 네트워크에서는 출퇴근을 찍을 수 없게 됩니다.`) && post({ action: "deleteNetwork", id: n.id }, "지웠습니다")}
                      >
                        삭제
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
        <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-t border-[#ecece9] mt-2">
          <input className={`${field} w-[160px]`} placeholder="이름 (예: 본사 사무실)" value={net.name} onChange={(e) => setNet({ ...net, name: e.target.value })} />
          <input className={`${field} w-[200px] font-mono`} placeholder="211.117.37.162" value={net.cidr} onChange={(e) => setNet({ ...net, cidr: e.target.value })} />
          {d && !inList && (
            <button className={btnLine} onClick={() => setNet({ name: net.name || "사무실", cidr: d.myIp })}>
              지금 IP 넣기
            </button>
          )}
          <button
            className={btn}
            disabled={!net.name.trim() || !net.cidr.trim()}
            onClick={async () => (await post({ action: "addNetwork", ...net }, "추가했습니다")) && setNet({ name: "", cidr: "" })}
          >
            추가
          </button>
          <span className="w-full text-[12px] text-[#8a8a84]">사무실 인터넷의 공인 IP입니다. 사무실 컴퓨터에서 이 화면을 열고 &lsquo;지금 IP 넣기&rsquo;를 누르면 됩니다. 인터넷 회선을 바꾸면 IP가 바뀔 수 있습니다.</span>
        </div>
      </section>

      <section className={`${card} p-4`}>
        <h2 className="text-[15px] font-semibold">재택 인증</h2>
        <p className="mt-1 text-[13px] text-[#6f6f6a]">
          재택 근무자가 출근을 찍으면 근무 시간 안(점심 12~13시 제외)에서 서버가 시각을 무작위로 정합니다. 직원은 시각을 미리 알 수 없습니다. QR을 찍은 뒤 컴퓨터에만 보이는 숫자를 휴대폰에서 골라야 인증됩니다.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[14px]">
          <label className="flex items-center gap-1">
            하루
            <input type="number" min={0} max={3} className={`${field} w-[60px]`} value={s.remoteChecksPerDay} onChange={(e) => setS({ ...s, remoteChecksPerDay: e.target.value })} />회
          </label>
          <label className="flex items-center gap-1">
            QR 유효
            <input type="number" min={30} max={300} className={`${field} w-[72px]`} value={s.qrSeconds} onChange={(e) => setS({ ...s, qrSeconds: e.target.value })} />초
          </label>
          <label className="flex items-center gap-1">
            인증 유예
            <input type="number" min={1} max={30} className={`${field} w-[60px]`} value={s.graceMinutes} onChange={(e) => setS({ ...s, graceMinutes: e.target.value })} />분
          </label>
          <button
            className={`${btnLine} ml-auto`}
            onClick={() => api<{ qr: string; matchCode: string }>("/api/work/attendance-settings", { method: "POST", json: { action: "preview" } }).then(setPreview).catch((e) => setErr(e.message))}
          >
            QR 창 미리보기
          </button>
          <button className={btnLine} onClick={() => post({ action: "saveSetting", ...s }, "저장했습니다. 횟수는 다음 출근부터, QR·유예 시간은 바로 적용됩니다.")}>
            저장
          </button>
        </div>
        <p className="mt-2 text-[12px] text-[#8a8a84]">재택 인증은 직원에게 미리 알리고 운영하세요. 미인증은 바로 결근 처리하지 말고 사유를 확인하세요.</p>
      </section>

      <section className={card}>
        <div className="px-4 pt-3 flex items-center gap-2">
          <h2 className="text-[15px] font-semibold">재택 인증 기록</h2>
          <input type="date" aria-label="날짜" className={`${field} ml-auto`} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {!d ? (
          <Empty>불러오는 중…</Empty>
        ) : !d.checks.length ? (
          <Empty>이 날 재택 인증 기록이 없습니다.</Empty>
        ) : (
          <table className="w-full text-[14px] mt-2">
            <thead>
              <tr>
                <Th>직원</Th>
                <Th>예정</Th>
                <Th>QR 표시</Th>
                <Th>인증</Th>
                <Th>결과</Th>
                <Th>재발급·오답</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {d.checks.map((c) => (
                <tr key={c.id}>
                  <Td>{c.employee.user.name}</Td>
                  <Td>{kst(c.scheduledAt).slice(11)}</Td>
                  <Td>{sec(c.shownAt)}</Td>
                  <Td>{sec(c.verifiedAt)}</Td>
                  <Td className={c.status === "MISSED" ? "text-[#d92d20]" : ""}>
                    {RC[c.status] ?? c.status}
                    {c.reason && <div className="text-[12px] text-[#6f6f6a]">{c.reason}</div>}
                  </Td>
                  <Td className="text-[12px] text-[#6f6f6a]">
                    {c.reissueCount} · {c.wrongAttempts}
                  </Td>
                  <Td>
                    {c.status === "MISSED" && (
                      <button
                        className="text-[13px] text-[#0062ff] hover:underline"
                        onClick={() => {
                          const reason = window.prompt("사유를 입력하세요 (예: 회의 중, 알림 미도달)")
                          if (reason?.trim()) post({ action: "excuse", id: c.id, reason }, "사유 인정으로 바꿨습니다")
                        }}
                      >
                        사유 인정
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
