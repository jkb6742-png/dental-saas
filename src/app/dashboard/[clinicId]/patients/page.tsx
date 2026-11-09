export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import PatientsPageClient from "./PatientsPageClient"
import { getPatientCompare } from "@/lib/dashboard/compare-rows"

// 통계 수치는 SimplePatientStats 가 /api/patients/simple-stats 로 직접 받아 온다.
// 여기서는 첫 화면의 연·월과 데이터 유무만 정한다. (환자 이름 등 원자료를 HTML 로 보내지 않는다)
export default async function PatientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { clinicId } = await params
  const sp = await searchParams

  // 기본값: URL 파라미터 > 가장 최근 데이터 > 현재 년월
  const latestData = await prisma.patientStat.findFirst({
    where: { clinicId },
    select: { year: true, month: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  })

  const currentDate = new Date()
  const year = sp.year ? parseInt(sp.year) : latestData ? latestData.year : currentDate.getFullYear()
  const month = sp.month ? parseInt(sp.month) : latestData ? latestData.month : currentDate.getMonth() + 1

  const [statCount, summaryCount, compareRows] = await Promise.all([
    prisma.patientStat.count({ where: { clinicId, year } }),
    prisma.monthlySummary.count({ where: { clinicId } }),
    getPatientCompare(clinicId),
  ])

  if (statCount === 0 && summaryCount === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[14px] text-[#8b95a1]">
        환자 통계 데이터가 없습니다. 엑셀을 업로드해주세요.
      </div>
    )
  }

  return <PatientsPageClient clinicId={clinicId} initialYear={year} initialMonth={month} compareRows={compareRows} />
}
