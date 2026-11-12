export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { requireWorkActor } from "@/lib/work/actor"
import { currentMonth, isMonth } from "@/lib/work/common"
import BillingClient from "./BillingClient"

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const actor = await requireWorkActor()
  if (!actor.isMaster) redirect("/work/today")
  const sp = await searchParams
  return <BillingClient initialMonth={isMonth(sp.month) ? sp.month : currentMonth()} />
}
