export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { requireWorkActor } from "@/lib/work/actor"
import { SALES_STAGE_LABEL } from "@/lib/work/sales"
import SalesClient from "./SalesClient"

export default async function SalesPage() {
  const actor = await requireWorkActor()
  if (!actor.isMaster) redirect("/work/today")
  return <SalesClient stages={SALES_STAGE_LABEL} clinics={actor.clinics} />
}
