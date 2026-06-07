export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import PatientInfoDetailPage from "./PatientInfoDetailPage"

export default async function PatientInfoPage({
  params,
  searchParams
}: {
  params: Promise<{ clinicId: string }>
  searchParams: Promise<{ page?: string; year?: string; month?: string; visitType?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { clinicId } = await params
  const sp = await searchParams

  const page = parseInt(sp.page || '1')
  const year = sp.year ? parseInt(sp.year) : 2026
  const month = sp.month ? parseInt(sp.month) : undefined
  const visitType = sp.visitType || ''

  const pageSize = 20

  // 필터 조건
  const where = {
    clinicId,
    ...(year && { year }),
    ...(month && { month }),
    ...(visitType && { visitType })
  }

  // 환자정보 데이터 조회
  const [patientData, totalCount] = await Promise.all([
    prisma.patientInfo.findMany({
      where,
      orderBy: [{ visitDate: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }).catch(() => []),
    prisma.patientInfo.count({ where }).catch(() => 0)
  ])

  // 통계 계산
  const stats = await calculatePatientStats(prisma, where)

  // 사용 가능한 년도/월 조회
  const availablePeriods = await prisma.patientInfo.groupBy({
    by: ['year', 'month'],
    where: { clinicId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }]
  }).catch(() => [])

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <PatientInfoDetailPage
      clinicId={clinicId}
      patientData={patientData}
      stats={stats}
      pagination={{
        currentPage: page,
        totalPages,
        totalCount,
        pageSize
      }}
      filters={{ year, month, visitType }}
      availablePeriods={availablePeriods}
    />
  )
}

async function calculatePatientStats(prisma: any, where: any) {
  try {
    const data = await prisma.patientInfo.findMany({ where })

    const newPatients = data.filter((p: any) => p.visitType === '신환').length
    const returningPatients = data.filter((p: any) => p.visitType === '구환').length
    const totalRevenue = data.reduce((sum: number, p: any) => sum + (p.revenue || 0), 0)
    const avgWaitingTime = data.length > 0 ?
      data.reduce((sum: number, p: any) => sum + (p.waitingTime || 0), 0) / data.length : 0

    return {
      totalPatients: data.length,
      newPatients,
      returningPatients,
      totalRevenue,
      avgRevenue: data.length > 0 ? totalRevenue / data.length : 0,
      avgWaitingTime: Math.round(avgWaitingTime * 10) / 10
    }
  } catch (error) {
    return {
      totalPatients: 0,
      newPatients: 0,
      returningPatients: 0,
      totalRevenue: 0,
      avgRevenue: 0,
      avgWaitingTime: 0
    }
  }
}