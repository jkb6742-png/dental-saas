export const dynamic = "force-dynamic"

import { requireWorkActor } from "@/lib/work/actor"
import { currentMonth } from "@/lib/work/common"
import ContentClient from "./ContentClient"

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ clinicId?: string; month?: string }> }) {
  const actor = await requireWorkActor()
  const sp = await searchParams
  const clinicId = actor.clinics.some((c) => c.id === sp.clinicId) ? sp.clinicId! : ""
  return <ContentClient clinics={actor.clinics} initialClinic={clinicId} initialMonth={sp.month ?? currentMonth()} />
}
