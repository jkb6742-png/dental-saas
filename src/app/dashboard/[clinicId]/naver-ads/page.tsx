export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { monthlyStats, stripForViewer } from "@/lib/naver-ads/service"
import NaverAdsClient from "./NaverAdsClient"

export default async function NaverAdsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const actor = await getActor()
  if (!actor) redirect("/login")
  const { clinicId } = await params
  if (!canAccessClinic(actor, clinicId)) redirect("/dashboard")
  const sp = await searchParams

  const now = new Date()
  const year = sp.year ? parseInt(sp.year) : now.getFullYear()
  const month = sp.month ? parseInt(sp.month) : now.getMonth() + 1
  const stats = await monthlyStats(clinicId, year, month)
  if (!actor.isMaster) stripForViewer(stats)

  return <NaverAdsClient clinicId={clinicId} initial={stats} isMaster={actor.isMaster} />
}
