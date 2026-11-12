"use client"

import { useEffect, useState } from "react"
import { btn, card, field, api, Th, Td } from "../ui"

// 알림 설정: 메일 받기·하루 요약·조용한 시간, 알림 등급 안내
const toHm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number)
  return h * 60 + m
}

type Pref = { email: string | null; isMaster: boolean; emailEnabled: boolean; dailyDigestEnabled: boolean; quietStart: string; quietEnd: string }

const LEVELS = [
  { p: "P0 긴급", color: "#d92d20", ex: "마감 지남, 검수 수정 요청, 입금 예정일 지남", app: "즉시", mail: "즉시(조용한 시간 제외). 근무 2시간 안에 안 읽으면 한 번 더" },
  { p: "P1 중요", color: "#b54708", ex: "검수 요청, 멘션, 오늘 마감, 연차 승인 요청, 결제 D-3·당일, 원장 요청", app: "즉시", mail: "하루 요약에 포함" },
  { p: "P2 일반", color: "#0062ff", ex: "업무 배정, 일정 초대·변경, 연차 결과, 요청 상태", app: "즉시", mail: "보내지 않음" },
  { p: "P3 정보", color: "#8a8a84", ex: "댓글, 파일 추가, 발행 기록, 월 마감", app: "수신함만", mail: "보내지 않음" },
]

export default function SettingsPage() {
  const [p, setP] = useState<Pref | null>(null)
  const [msg, setMsg] = useState("")
  useEffect(() => {
    api("/api/notifications/preferences")
      .then((j) =>
        setP({
          email: j.email,
          isMaster: !!j.isMaster,
          emailEnabled: j.emailEnabled,
          dailyDigestEnabled: j.dailyDigestEnabled,
          quietStart: toHm(j.quietStartMinute),
          quietEnd: toHm(j.quietEndMinute),
        }),
      )
      .catch((e) => setMsg((e as Error).message))
  }, [])
  if (!p) return msg ? <p className="text-[13px] text-[#d92d20]">{msg}</p> : null
  const save = async () => {
    setMsg("")
    if (!p.quietStart || !p.quietEnd) return setMsg("조용한 시간을 입력하세요")
    try {
      await api("/api/notifications/preferences", {
        method: "PUT",
        json: { emailEnabled: p.emailEnabled, dailyDigestEnabled: p.dailyDigestEnabled, quietStartMinute: toMin(p.quietStart), quietEndMinute: toMin(p.quietEnd) },
      })
      setMsg("저장했습니다")
    } catch (e) {
      setMsg((e as Error).message)
    }
  }
  return (
    <div className="space-y-3 max-w-[720px]">
      <h1 className="text-[20px] font-bold">알림 설정</h1>
      <div className={`${card} p-4 space-y-4 text-[14px]`}>
        <div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={p.emailEnabled} onChange={(e) => setP({ ...p, emailEnabled: e.target.checked })} />
            메일 받기 {p.email && <span className="text-[#6f6f6a]">({p.email})</span>}
          </label>
          <p className="mt-1 text-[12px] text-[#6f6f6a]">긴급(P0) 알림을 메일로 보냅니다. 몇 건이 한꺼번에 생기면 한 통으로 묶습니다.</p>
        </div>
        <div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={p.dailyDigestEnabled} onChange={(e) => setP({ ...p, dailyDigestEnabled: e.target.checked })} />
            하루 요약
          </label>
          <p className="mt-1 text-[12px] text-[#6f6f6a]">
            평일 09:10에 한 번, 오늘 마감·지연·검토 대기·오늘 미팅 수와 우선 확인 3건을 앱과 메일로 보냅니다.
            {p.isMaster && " 대표는 연차 승인 대기·미입금 연체·지난달 마감 안 된 치과 수가 더해집니다."}
            {!p.emailEnabled && " 메일 받기를 끄면 앱에서만 받습니다."}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span>조용한 시간</span>
            <input type="time" className={field} value={p.quietStart} onChange={(e) => setP({ ...p, quietStart: e.target.value })} />
            <span>~</span>
            <input type="time" className={field} value={p.quietEnd} onChange={(e) => setP({ ...p, quietEnd: e.target.value })} />
          </div>
          <p className="mt-1 text-[12px] text-[#6f6f6a]">이 시간과 주말에는 메일을 보내지 않고, 끝나는 시각(평일)에 모아서 보냅니다. 앱 안 알림은 그대로 쌓입니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className={btn} onClick={save}>
            저장
          </button>
          {msg && <span className="text-[13px] text-[#6f6f6a]">{msg}</span>}
        </div>
      </div>

      <div className={`${card} p-4`}>
        <h2 className="text-[15px] font-bold mb-2">알림 등급</h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr>
              <Th className="w-[84px]">등급</Th>
              <Th>예</Th>
              <Th className="w-[72px]">앱</Th>
              <Th className="w-[200px]">메일</Th>
            </tr>
          </thead>
          <tbody>
            {LEVELS.map((l) => (
              <tr key={l.p}>
                <Td>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                    {l.p}
                  </span>
                </Td>
                <Td className="text-[#4e5968]">{l.ex}</Td>
                <Td>{l.app}</Td>
                <Td className="text-[#4e5968]">{l.mail}</Td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <p className="mt-2 text-[12px] text-[#6f6f6a]">본인이 한 일(배정·댓글·검수)은 본인에게 알리지 않습니다. 같은 업무에 30분 안에 달린 댓글은 한 줄(새 댓글 N개)로 묶습니다.</p>
      </div>
    </div>
  )
}
