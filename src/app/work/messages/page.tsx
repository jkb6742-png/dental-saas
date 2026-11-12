export const dynamic = "force-dynamic"

import { requireWorkActor } from "@/lib/work/actor"
import MessagesClient from "./MessagesClient"

export default async function MessagesPage() {
  const actor = await requireWorkActor()
  return <MessagesClient me={{ id: actor.id, name: actor.name }} />
}
