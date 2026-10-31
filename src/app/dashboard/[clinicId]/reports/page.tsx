import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import ReportManagementClient from "./ReportManagementClient"

export default async function ReportsPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const { clinicId } = await params
  const userRole = (session.user as any).role || "VIEWER"

  const sectors = await prisma.reportSector.findMany({
    where: { clinicId },
    orderBy: { sortOrder: "asc" },
    include: {
      reports: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, month: true, memo: true, fileType: true, fileName: true, sortOrder: true, createdAt: true },
      },
    },
  })

  return (
    <ReportManagementClient
      clinicId={clinicId}
      userRole={userRole}
      initialSectors={JSON.parse(JSON.stringify(sectors))}
    />
  )
}
