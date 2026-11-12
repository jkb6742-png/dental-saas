export const dynamic = "force-dynamic"

import { requireWorkActor } from "@/lib/work/actor"
import LeaveClient from "./LeaveClient"

export default async function LeavePage() {
  const actor = await requireWorkActor()
  return <LeaveClient isMaster={actor.isMaster} meId={actor.id} />
}
