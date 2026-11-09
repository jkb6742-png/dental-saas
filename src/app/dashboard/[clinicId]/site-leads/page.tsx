export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { RETENTION_DAYS } from "@/lib/site-leads/service"
import SiteLeadsClient, { type LeadItem, type SourceInfo } from "./SiteLeadsClient"

export default async function SiteLeadsPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const actor = await getActor()
  if (!actor) redirect("/login")
  const { clinicId } = await params
  if (!canAccessClinic(actor, clinicId)) redirect("/dashboard")

  const [src, rows] = await Promise.all([
    prisma.siteLeadSource.findUnique({ where: { clinicId } }),
    prisma.siteLead.findMany({ where: { clinicId }, orderBy: [{ receivedAt: "desc" }, { siteLeadId: "desc" }], take: 2000 }),
  ])

  const source: SourceInfo = src
    ? {
        connected: true,
        siteUrl: src.siteUrl,
        lastSyncAt: src.lastSyncAt?.toISOString() ?? null,
        lastSyncStatus: src.lastSyncStatus,
        lastSyncError: actor.isMaster ? src.lastSyncError : null,
        alertEmails: actor.isMaster ? src.alertEmails ?? "" : "",
      }
    : { connected: false, siteUrl: "", lastSyncAt: null, lastSyncStatus: null, lastSyncError: null, alertEmails: "" }

  const leads: LeadItem[] = rows.map((r) => ({
    id: r.id,
    siteLeadId: r.siteLeadId,
    receivedAt: r.receivedAt.toISOString(),
    status: r.status,
    statusLabel: r.statusLabel,
    name: r.name,
    phone: r.phone,
    category: r.category,
    subject: r.subject,
    channel: r.channel,
    srcLabel: r.srcLabel,
    medLabel: r.medLabel,
    campaign: r.campaign,
    noteCount: r.noteCount,
  }))

  return <SiteLeadsClient clinicId={clinicId} isMaster={actor.isMaster} source={source} leads={leads} retentionDays={RETENTION_DAYS} />
}
