export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import { requestInclude, serializeRequest } from "@/lib/requests/serialize"
import RequestsClient from "./RequestsClient"

export default async function RequestsPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const actor = await getActor()
  if (!actor) redirect("/login")
  const { clinicId } = await params
  if (!canAccessClinic(actor, clinicId)) redirect("/dashboard")

  const rows = await prisma.serviceRequest.findMany({
    where: { clinicId },
    include: requestInclude,
    orderBy: { createdAt: "desc" },
  })

  return (
    <RequestsClient
      clinicId={clinicId}
      initialRequests={rows.map(serializeRequest)}
      isMaster={actor.isMaster || actor.isStaff}
      userId={actor.id}
    />
  )
}
