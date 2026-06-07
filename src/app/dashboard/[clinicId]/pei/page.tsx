import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import PeiDashboard from "@/components/PeiDashboard"

export default async function PEIPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const { clinicId } = await params

  // PEI 보고서 목록을 미리 로드하지 않고 컴포넌트에서 처리
  return <PeiDashboard clinicId={clinicId} />
}