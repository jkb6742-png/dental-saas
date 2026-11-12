"use client"

import Link from "next/link"
import MyAttendance from "./MyAttendance"
import TeamAttendance from "./TeamAttendance"

// 근태: 직원은 '내 근태', 대표는 '내 근태 | 팀 근태' 전환
export default function AttendanceClient({ isMaster, view, tab }: { isMaster: boolean; view: "me" | "team"; tab: "clock" | "overtime" }) {
  const tabHref = (t: "clock" | "overtime") => (t === "overtime" ? "/work/attendance?tab=overtime" : "/work/attendance")
  return (
    <div className="mx-auto max-w-[1600px] space-y-3">
      <div className="flex items-center gap-3">
        <h1 className="text-[20px] font-bold">{view === "team" ? "팀 근태" : "내 근태"}</h1>
        {isMaster && (
          <div className="ml-auto flex rounded border border-[#d1d1cc] bg-white p-0.5 text-[13px]">
            <Link href="/work/attendance" className={`rounded px-3 py-1 ${view === "me" ? "bg-[#191f28] text-white" : "text-[#6f6f6a]"}`}>
              내 근태
            </Link>
            <Link href="/work/attendance?view=team" className={`rounded px-3 py-1 ${view === "team" ? "bg-[#191f28] text-white" : "text-[#6f6f6a]"}`}>
              팀 근태
            </Link>
          </div>
        )}
      </div>
      {view === "team" ? <TeamAttendance /> : <MyAttendance tab={tab} tabHref={tabHref} />}
    </div>
  )
}
