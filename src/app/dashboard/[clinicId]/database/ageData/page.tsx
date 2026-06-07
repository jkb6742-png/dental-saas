export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, Calendar } from "lucide-react"
import MonthlyFilter from "../components/MonthlyFilter"

export default async function AgeDataPage({
  params,
  searchParams
}: {
  params: Promise<{ clinicId: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { clinicId } = await params
  const sp = await searchParams

  const year = sp.year ? parseInt(sp.year) : undefined
  const month = sp.month ? parseInt(sp.month) : undefined

  // 필터 조건
  const where = {
    clinicId,
    ...(year && { year }),
    ...(month && { month })
  }

  // 연령별 데이터 조회
  const ageData = await prisma.ageData.findMany({
    where,
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { patientCount: 'desc' }]
  }).catch(() => [])

  // 사용 가능한 년도/월 조회
  const availablePeriods = await prisma.ageData.groupBy({
    by: ['year', 'month'],
    where: { clinicId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }]
  }).catch(() => [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="space-y-6 p-6">
        {/* 헤더 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
          <div className="flex items-center gap-4 mb-6">
            <Link href={`/dashboard/${clinicId}/database`}>
              <button className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            </Link>
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900">👶👴 연령별 데이터</h1>
              <p className="text-slate-600">연령대별 환자 분포 및 비율</p>
            </div>
          </div>

          {/* 필터 */}
          <MonthlyFilter
            clinicId={clinicId}
            availablePeriods={availablePeriods}
            currentYear={year}
            currentMonth={month}
          />
        </div>

        {/* 데이터 테이블 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-6">연령대별 환자 분포</h3>

          {ageData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">👶👴</div>
              <p className="text-slate-600">연령별 데이터가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left p-4 font-semibold text-slate-700">연령대</th>
                    <th className="text-center p-4 font-semibold text-slate-700">년/월</th>
                    <th className="text-right p-4 font-semibold text-slate-700">환자 수</th>
                    <th className="text-right p-4 font-semibold text-slate-700">비율</th>
                  </tr>
                </thead>
                <tbody>
                  {ageData.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4">
                        <span className="font-medium text-slate-900">{item.ageGroup}</span>
                      </td>
                      <td className="text-center p-4 text-slate-700">{item.year}년 {item.month}월</td>
                      <td className="text-right p-4 text-slate-700">{item.patientCount.toLocaleString()}명</td>
                      <td className="text-right p-4 font-semibold text-slate-900">{item.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}