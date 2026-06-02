import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import ReportsClient from "./ReportsClient"
import { FileText } from "lucide-react"

export default async function ReportsPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const { clinicId } = await params

  const reports = await prisma.report.findMany({
    where: { clinicId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 12,
  })

  return <ReportsClient clinicId={clinicId} initialReports={reports} />
}
