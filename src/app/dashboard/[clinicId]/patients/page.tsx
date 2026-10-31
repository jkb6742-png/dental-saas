export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import PatientsPageClient from "./PatientsPageClient"

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

  // 사용 가능한 년도/월 조합을 먼저 확인
  const availableData = await prisma.patientStat.findMany({
    where: { clinicId },
    select: { year: true, month: true },
    distinct: ['year', 'month'],
    orderBy: [{ year: "desc" }, { month: "desc" }]
  })

  // 기본값: URL 파라미터 > 가장 최근 데이터 > 현재 년월
  const latestData = availableData[0]
  const currentDate = new Date()

  const year = sp.year ? parseInt(sp.year) :
               latestData ? latestData.year :
               currentDate.getFullYear()

  const month = sp.month ? parseInt(sp.month) :
                latestData ? latestData.month :
                currentDate.getMonth() + 1


  // 해당 년도 전체 데이터
  const yearlyData = await prisma.patientStat.findMany({
    where: {
      clinicId,
      year
    },
    orderBy: [{ month: "asc" }]
  })

  if (yearlyData.length > 0) {
  }

  // 해당 월의 상세 데이터
  const monthlyData = await prisma.patientStat.findMany({
    where: {
      clinicId,
      year,
      month
    },
    orderBy: { date: "asc" }
  })

  if (monthlyData.length > 0) {
  }

  // availableData는 이미 위에서 조회했으므로 중복 제거


  // 데이터가 없는 경우 MonthlySummary에서 기본 데이터 가져오기
  let fallbackData = null
  if (yearlyData.length === 0 && monthlyData.length === 0) {
    fallbackData = await prisma.monthlySummary.findMany({
      where: { clinicId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 12
    })
    if (fallbackData && fallbackData.length > 0) {
    }
  }

  // 환자 관리 고도화를 위한 추가 데이터
  // 접수 기록 데이터 (연간 전체 데이터 - 월별 분석용)
  const receptionRecords = await prisma.receptionRecord.findMany({
    where: {
      clinicId,
      year, // 선택된 연도 전체 데이터
      // month 필터 제거하여 연간 데이터 확보
    },
    select: {
      receptionTime: true,
      patientName: true,
      chartNumber: true,
      patientType: true,
      totalRevenue: true,
      createdAt: true
    },
    orderBy: { receptionTime: "asc" }
  })

  // 현재 선택된 월의 상세 접수 기록 (시간대별 분석용)
  const currentMonthReceptionRecords = await prisma.receptionRecord.findMany({
    where: {
      clinicId,
      year,
      month
    },
    select: {
      receptionTime: true,
      patientName: true,
      chartNumber: true,
      patientType: true,
      totalRevenue: true,
      createdAt: true
    },
    orderBy: { receptionTime: "asc" }
  })


  // 치료 계획 데이터 (환자 유지율 분석용)
  const treatmentPlans = await prisma.treatmentPlan.findMany({
    where: {
      clinicId,
      year,
      month
    },
    select: {
      patientName: true,
      chartNumber: true,
      writtenDate: true,
      lastVisit: true,
      nextAppointment: true,
      status: true,
      paymentStatus: true,
      contractAmount: true,
      remainingAmount: true
    },
    orderBy: { writtenDate: "desc" }
  })


  // 과거 3개월 데이터 (유지율 분석용)
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const historicalReceptionData = await prisma.receptionRecord.findMany({
    where: {
      clinicId,
      receptionTime: {
        gte: threeMonthsAgo
      }
    },
    select: {
      patientName: true,
      chartNumber: true,
      receptionTime: true,
      patientType: true
    },
    orderBy: { receptionTime: "asc" }
  })


  // 완전히 데이터가 없는 경우
  if (yearlyData.length === 0 && monthlyData.length === 0 && (!fallbackData || fallbackData.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64 text-[14px] text-[#8b95a1]">
        환자 통계 데이터가 없습니다. 엑셀을 업로드해주세요.
      </div>
    )
  }

  return (
    <PatientsPageClient
      clinicId={clinicId}
      initialYear={year}
      initialMonth={month}
      yearlyData={yearlyData}
      monthlyData={monthlyData}
      availableData={availableData}
      fallbackData={fallbackData}
      receptionRecords={receptionRecords}
      currentMonthReceptionRecords={currentMonthReceptionRecords}
      treatmentPlans={treatmentPlans}
      historicalReceptionData={historicalReceptionData}
    />
  )
}