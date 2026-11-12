export const dynamic = "force-dynamic"

import { requireWorkActor } from "@/lib/work/actor"
import AttendanceClient from "./AttendanceClient"

// /work/attendance          내 근태(출퇴근 탭)
// /work/attendance?tab=overtime  내 근태(추가근무 탭)
// /work/attendance?view=team     팀 근태(대표만)
export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ view?: string; tab?: string }> }) {
  const actor = await requireWorkActor()
  const sp = await searchParams
  const view = actor.isMaster && sp.view === "team" ? "team" : "me"
  const tab = sp.tab === "overtime" ? "overtime" : "clock"
  return <AttendanceClient isMaster={actor.isMaster} view={view} tab={tab} />
}
