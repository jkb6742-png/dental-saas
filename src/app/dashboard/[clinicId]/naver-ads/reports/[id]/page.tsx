export const dynamic = "force-dynamic"

import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import ReportViewer from "./ReportViewer"

export default async function NaverAdReportPage({ params }: { params: Promise<{ clinicId: string; id: string }> }) {
  const actor = await getActor()
  if (!actor) redirect("/login")
  const { clinicId, id } = await params
  if (!canAccessClinic(actor, clinicId)) redirect("/dashboard")
  const r = await prisma.naverAdReport.findUnique({ where: { id }, select: { id: true, clinicId: true, title: true, status: true, error: true, periodStart: true, periodEnd: true, compareStart: true, compareEnd: true, createdAt: true, model: true } })
  if (!r || r.clinicId !== clinicId) notFound()
  if (!actor.isMaster && r.status !== "DONE") notFound()

  return (
    <ReportViewer
      clinicId={clinicId}
      report={{
        id: r.id, title: r.title, status: r.status, error: actor.isMaster ? r.error : null, model: actor.isMaster ? r.model : null,
        periodStart: r.periodStart.toISOString().slice(0, 10), periodEnd: r.periodEnd.toISOString().slice(0, 10),
        compareStart: r.compareStart.toISOString().slice(0, 10), compareEnd: r.compareEnd.toISOString().slice(0, 10),
        createdAt: r.createdAt.toISOString(),
      }}
    />
  )
}
