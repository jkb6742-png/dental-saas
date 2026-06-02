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

  console.log(`[PATIENTS DEBUG] 클리닉 ID: ${clinicId}`)
  console.log(`[PATIENTS DEBUG] 요청된 년도: ${year}, 월: ${month}`)

  // 해당 년도 전체 데이터
  const yearlyData = await prisma.patientStat.findMany({
    where: {
      clinicId,
      year
    },
    orderBy: [{ month: "asc" }]
  })

  console.log(`[PATIENTS DEBUG] yearlyData 결과: ${yearlyData.length}개`)
  if (yearlyData.length > 0) {
    console.log(`[PATIENTS DEBUG] 첫 번째 데이터:`, JSON.stringify(yearlyData[0], null, 2))
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

  console.log(`[PATIENTS DEBUG] monthlyData 결과: ${monthlyData.length}개`)
  if (monthlyData.length > 0) {
    console.log(`[PATIENTS DEBUG] 월별 첫 번째 데이터:`, JSON.stringify(monthlyData[0], null, 2))
  }

  // availableData는 이미 위에서 조회했으므로 중복 제거

  console.log(`[PATIENTS DEBUG] availableData 결과: ${availableData.length}개`)
  console.log(`[PATIENTS DEBUG] 사용 가능한 년월:`, availableData.map(d => `${d.year}년 ${d.month}월`))

  // 데이터가 없는 경우 MonthlySummary에서 기본 데이터 가져오기
  let fallbackData = null
  if (yearlyData.length === 0 && monthlyData.length === 0) {
    console.log(`[PATIENTS DEBUG] PatientStat 데이터가 없어서 MonthlySummary 폴백 시도`)
    fallbackData = await prisma.monthlySummary.findMany({
      where: { clinicId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 12
    })
    console.log(`[PATIENTS DEBUG] fallbackData 결과: ${fallbackData?.length || 0}개`)
    if (fallbackData && fallbackData.length > 0) {
      console.log(`[PATIENTS DEBUG] 폴백 첫 번째 데이터:`, JSON.stringify(fallbackData[0], null, 2))
    }
  }

  // 환자 관리 고도화를 위한 추가 데이터
  // 접수 기록 데이터 (요일별/시간대별 분석용)
  const receptionRecords = await prisma.receptionRecord.findMany({
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

  console.log(`[PATIENTS DEBUG] receptionRecords 결과: ${receptionRecords.length}개`)

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

  console.log(`[PATIENTS DEBUG] treatmentPlans 결과: ${treatmentPlans.length}개`)

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

  console.log(`[PATIENTS DEBUG] historicalReceptionData 결과: ${historicalReceptionData.length}개`)

  // 전체적으로 데이터베이스에 저장된 PatientStat과 MonthlySummary 확인
  const totalPatientStats = await prisma.patientStat.count({ where: { clinicId } })
  const totalMonthlySummaries = await prisma.monthlySummary.count({ where: { clinicId } })

  console.log(`[PATIENTS DEBUG] 전체 PatientStat 개수: ${totalPatientStats}`)
  console.log(`[PATIENTS DEBUG] 전체 MonthlySummary 개수: ${totalMonthlySummaries}`)

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
      treatmentPlans={treatmentPlans}
      historicalReceptionData={historicalReceptionData}
    />
  )
}