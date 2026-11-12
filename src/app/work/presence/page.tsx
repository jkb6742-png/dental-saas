export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { requireWorkActor } from "@/lib/work/actor"
import PresenceClient from "./PresenceClient"

// 근태 설정(대표 전용): 출퇴근 허용 네트워크 · 재택 인증 운영값 · 재택 인증 기록
export default async function PresencePage() {
  const actor = await requireWorkActor()
  if (!actor.isMaster) redirect("/work/today")
  return <PresenceClient />
}
