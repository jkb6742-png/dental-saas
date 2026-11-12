export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { requireWorkActor } from "@/lib/work/actor"
import { DELIVERABLE_LABEL } from "@/lib/work/contracts"
import ContractsClient from "./ContractsClient"

export default async function ContractsPage() {
  const actor = await requireWorkActor()
  if (!actor.isMaster) redirect("/work/today")
  return <ContractsClient clinics={actor.clinics} kinds={DELIVERABLE_LABEL} />
}
