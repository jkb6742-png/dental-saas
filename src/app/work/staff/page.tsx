export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { requireWorkActor } from "@/lib/work/actor"
import StaffListClient from "./StaffListClient"

export default async function StaffPage() {
  const actor = await requireWorkActor()
  if (!actor.isMaster) redirect("/work/today")
  return <StaffListClient />
}
