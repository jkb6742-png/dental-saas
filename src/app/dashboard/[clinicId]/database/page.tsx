export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import DatabaseDashboard from "./DatabaseDashboard"

export default async function DatabasePage({
  params,
}: {
  params: Promise<{ clinicId: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { clinicId } = await params

  // 6개 핵심 테이블 통계 조회 (오류 처리 포함)
  let revenueCount = 0
  let patientInfoCount = 0
  let treatmentDataCount = 0
  let visitRouteDataCount = 0
  let regionDataCount = 0
  let ageDataCount = 0

  try {
    const counts = await Promise.all([
      prisma.revenue?.count({ where: { clinicId } }).catch(() => 0),
      prisma.patientInfo?.count({ where: { clinicId } }).catch(() => 0),
      prisma.treatmentData?.count({ where: { clinicId } }).catch(() => 0),
      prisma.visitRouteData?.count({ where: { clinicId } }).catch(() => 0),
      prisma.regionData?.count({ where: { clinicId } }).catch(() => 0),
      prisma.ageData?.count({ where: { clinicId } }).catch(() => 0)
    ])

    revenueCount = counts[0] || 0
    patientInfoCount = counts[1] || 0
    treatmentDataCount = counts[2] || 0
    visitRouteDataCount = counts[3] || 0
    regionDataCount = counts[4] || 0
    ageDataCount = counts[5] || 0
  } catch (error) {
    console.error('새 테이블 조회 오류:', error)
    // 기본값 0으로 설정됨
  }

  // 최신 데이터 확인 (오류 처리 포함)
  let latestRevenue = null
  let latestPatientInfo = null
  let latestTreatmentData = null

  try {
    const latestData = await Promise.all([
      prisma.revenue?.findFirst({
        where: { clinicId },
        orderBy: { date: 'desc' }
      }).catch(() => null),
      prisma.patientInfo?.findFirst({
        where: { clinicId },
        orderBy: { visitDate: 'desc' }
      }).catch(() => null),
      prisma.treatmentData?.findFirst({
        where: { clinicId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
      }).catch(() => null)
    ])

    latestRevenue = latestData[0]
    latestPatientInfo = latestData[1]
    latestTreatmentData = latestData[2]
  } catch (error) {
    console.error('최신 데이터 조회 오류:', error)
    // 기본값 null로 설정됨
  }

  // 데이터 품질 체크
  const dataQuality = {
    revenueIntegrity: revenueCount > 0,
    patientDataComplete: patientInfoCount > 0,
    monthlyStatsAvailable: treatmentDataCount > 0 && visitRouteDataCount > 0
  }

  const tableStats = {
    revenue: {
      count: revenueCount,
      latest: latestRevenue?.date,
      health: revenueCount > 0 ? 'healthy' : 'warning'
    },
    patientInfo: {
      count: patientInfoCount,
      latest: latestPatientInfo?.visitDate,
      health: patientInfoCount > 0 ? 'healthy' : 'warning'
    },
    treatmentData: {
      count: treatmentDataCount,
      latest: latestTreatmentData ? `${latestTreatmentData.year}년 ${latestTreatmentData.month}월` : null,
      health: treatmentDataCount > 0 ? 'healthy' : 'warning'
    },
    visitRouteData: {
      count: visitRouteDataCount,
      health: visitRouteDataCount > 0 ? 'healthy' : 'warning'
    },
    regionData: {
      count: regionDataCount,
      health: regionDataCount > 0 ? 'healthy' : 'warning'
    },
    ageData: {
      count: ageDataCount,
      health: ageDataCount > 0 ? 'healthy' : 'warning'
    }
  }

  return (
    <DatabaseDashboard
      clinicId={clinicId}
      tableStats={tableStats}
      dataQuality={dataQuality}
    />
  )
}