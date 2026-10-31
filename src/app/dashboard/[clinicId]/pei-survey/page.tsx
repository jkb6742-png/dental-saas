export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { getOrCreateSurvey, surveyStats } from "@/lib/pei-survey/service"
import PeiSurveyClient from "./PeiSurveyClient"

export default async function PeiSurveyPage({
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

  const now = new Date(Date.now() + 9 * 3600 * 1000)
  const year = sp.year ? parseInt(sp.year) : now.getUTCFullYear()
  const month = sp.month ? parseInt(sp.month) : now.getUTCMonth() + 1
  const survey = await getOrCreateSurvey(clinicId)
  const stats = await surveyStats(clinicId, year, month)

  return <PeiSurveyClient clinicId={clinicId} initialSurvey={survey} initialStats={stats} isMaster={actor.isMaster} />
}
