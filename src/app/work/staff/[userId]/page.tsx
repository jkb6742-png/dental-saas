export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { requireWorkActor } from "@/lib/work/actor"
import StaffDetailClient from "./StaffDetailClient"

export default async function StaffDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const actor = await requireWorkActor()
  if (!actor.isMaster) redirect("/work/today")
  const { userId } = await params
  return <StaffDetailClient userId={userId} meId={actor.id} />
}
