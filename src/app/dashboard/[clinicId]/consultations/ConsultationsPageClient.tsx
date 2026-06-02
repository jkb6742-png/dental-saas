"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"
import YearMonthFilter from "@/components/ui/YearMonthFilter"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, BarChart, Bar, Cell, PieChart, Pie } from "recharts"
import { Users, TrendingUp, CheckCircle, DollarSign, MessageSquare, Target, Award, BarChart2 } from "lucide-react"

type ConsultationStatData = {
  id: string
  clinicId: string
  year: number
  month: number
  counselorName: string
  planCount: number | null
  confirmedCount: number | null
  confirmationRate: number | null
  patientCount: number | null
  confirmedPatients: number | null
  patientConfirmRate: number | null
  confirmedAmount: number | null
  avgDiscountRate: number | null
  createdAt: Date
}

type AvailableData = {
  year: number
  month: number
}

interface ConsultationsPageClientProps {
  clinicId: string
  initialYear: number
  initialMonth: number
  yearlyData: ConsultationStatData[]
  monthlyData: ConsultationStatData[]
  availableData: AvailableData[]
}

// 금액 포맷팅 함수
const formatAmount = (amount: number): string => {
  if (amount >= 100000000) { // 1억 이상
    const billions = Math.floor(amount / 100000000);
    const remainder = amount % 100000000;
    if (remainder === 0) {
      return `${billions}억원`;
    } else {
      const thousands = Math.round(remainder / 10000);
      if (thousands === 0) {
        return `${billions}억원`;
      }
      return `${billions}억 ${thousands.toLocaleString()}만원`;
    }
  } else { // 1억 미만
    const thousands = Math.round(amount / 10000);
    if (thousands === 0) {
      return "0원";
    }
    return `${thousands.toLocaleString()}만원`;
  }
}

export default function ConsultationsPageClient({
  clinicId,
  initialYear,
  initialMonth,
  yearlyData,
  monthlyData,
  availableData
}: ConsultationsPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)

  // URL 업데이트
  useEffect(() => {
    const currentParams = new URLSearchParams(searchParams.toString())
    const currentYear = currentParams.get('year')
    const currentMonth = currentParams.get('month')

    if (currentYear !== selectedYear.toString() || currentMonth !== selectedMonth.toString()) {
      const params = new URLSearchParams()
      params.set('year', selectedYear.toString())
      params.set('month', selectedMonth.toString())
      router.replace(`/dashboard/${clinicId}/consultations?${params.toString()}`)
    }
  }, [selectedYear, selectedMonth, clinicId, router, searchParams])

  // 연간 월별 추이 데이터 생성
  const createYearlyTrendData = () => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1)

    return months.map(month => {
      const monthData = yearlyData.filter(d => d.month === month)

      const totalPlans = monthData.reduce((sum, d) => sum + (d.planCount || 0), 0)
      const totalConfirmed = monthData.reduce((sum, d) => sum + (d.confirmedCount || 0), 0)
      const totalAmount = monthData.reduce((sum, d) => sum + (d.confirmedAmount || 0), 0)
      const avgConfirmRate = totalPlans > 0 ? (totalConfirmed / totalPlans) * 100 : 0

      return {
        month: `${month}월`,
        계획수: totalPlans,
        확정건수: totalConfirmed,
        확정률: Math.round(avgConfirmRate * 10) / 10,
        확정금액: totalAmount,
        상담자수: monthData.length
      }
    })
  }

  // 현재 월 통계 계산
  const getCurrentMonthStats = () => {
    const totalPlans = monthlyData.reduce((sum, d) => sum + (d.planCount || 0), 0)
    const totalConfirmed = monthlyData.reduce((sum, d) => sum + (d.confirmedCount || 0), 0)
    const totalAmount = monthlyData.reduce((sum, d) => sum + (d.confirmedAmount || 0), 0)
    const totalPatients = monthlyData.reduce((sum, d) => sum + (d.patientCount || 0), 0)
    const confirmedPatients = monthlyData.reduce((sum, d) => sum + (d.confirmedPatients || 0), 0)

    const avgConfirmRate = totalPlans > 0 ? (totalConfirmed / totalPlans) * 100 : 0
    const patientConfirmRate = totalPatients > 0 ? (confirmedPatients / totalPatients) * 100 : 0
    const avgAmountPerPlan = totalConfirmed > 0 ? totalAmount / totalConfirmed : 0

    return {
      총계획수: totalPlans,
      총확정건수: totalConfirmed,
      평균확정률: avgConfirmRate,
      총확정금액: totalAmount,
      상담자수: monthlyData.length,
      환자확정률: patientConfirmRate,
      건당평균금액: avgAmountPerPlan
    }
  }

  // 상담자별 성과 데이터 (상위 10명)
  const getCounselorPerformance = () => {
    return [...monthlyData]
      .sort((a, b) => (b.confirmedAmount || 0) - (a.confirmedAmount || 0))
      .slice(0, 10)
      .map(data => ({
        name: data.counselorName,
        계획수: data.planCount || 0,
        확정건수: data.confirmedCount || 0,
        확정률: data.confirmationRate || 0,
        확정금액: data.confirmedAmount || 0,
        환자확정률: data.patientConfirmRate || 0,
        할인율: data.avgDiscountRate || 0
      }))
  }

  const currentStats = getCurrentMonthStats()
  const yearlyTrendData = createYearlyTrendData()
  const counselorData = getCounselorPerformance()

  // 월대월 증감률 계산
  const getPreviousMonthComparison = () => {
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear

    const prevMonthData = yearlyData.filter(d => d.year === prevYear && d.month === prevMonth)
    const prevTotalPlans = prevMonthData.reduce((sum, d) => sum + (d.planCount || 0), 0)
    const prevTotalConfirmed = prevMonthData.reduce((sum, d) => sum + (d.confirmedCount || 0), 0)
    const prevTotalAmount = prevMonthData.reduce((sum, d) => sum + (d.confirmedAmount || 0), 0)

    const planChange = prevTotalPlans > 0 ? ((currentStats.총계획수 - prevTotalPlans) / prevTotalPlans) * 100 : 0
    const confirmedChange = prevTotalConfirmed > 0 ? ((currentStats.총확정건수 - prevTotalConfirmed) / prevTotalConfirmed) * 100 : 0
    const amountChange = prevTotalAmount > 0 ? ((currentStats.총확정금액 - prevTotalAmount) / prevTotalAmount) * 100 : 0

    return { planChange, confirmedChange, amountChange }
  }

  const { planChange, confirmedChange, amountChange } = getPreviousMonthComparison()

  return (
    <div className="space-y-6">
      {/* 년도 헤더 */}
      <div className="text-center border-b border-[#e5e8eb] pb-6">
        <h1 className="text-[32px] font-bold text-[#191f28] mb-2">{selectedYear}년</h1>
        <p className="text-[16px] text-[#6b7280]">상담 성과 분석 리포트</p>
      </div>

      {/* 년도/월 필터 */}
      <YearMonthFilter
        initialYear={selectedYear}
        initialMonth={selectedMonth}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
      />

      {/* 월별 핵심 지표 */}
      <SectionCard title={`${selectedYear}년 ${selectedMonth}월 상담 성과`} description="필수 지표 요약">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <KpiCard
            label="총 계획수"
            value={currentStats.총계획수.toLocaleString()}
            unit="건"
            change={planChange}
            icon={<Users className="w-4 h-4" />}
            color="blue"
          />
          <KpiCard
            label="총 확정건수"
            value={currentStats.총확정건수.toLocaleString()}
            unit="건"
            change={confirmedChange}
            icon={<CheckCircle className="w-4 h-4" />}
            color="green"
          />
          <KpiCard
            label="평균 확정률"
            value={currentStats.평균확정률.toFixed(1)}
            unit="%"
            icon={<Target className="w-4 h-4" />}
            color="yellow"
          />
          <KpiCard
            label="총 확정금액"
            value={formatAmount(currentStats.총확정금액)}
            unit=""
            change={amountChange}
            icon={<DollarSign className="w-4 h-4" />}
            color="red"
          />
        </div>

        {/* 추가 분석 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] text-blue-600 font-medium">활성 상담자 수</div>
                <div className="text-[24px] font-bold text-blue-700 mt-1">{currentStats.상담자수}</div>
                <div className="text-[12px] text-blue-600 mt-1">이번 달 활동한 상담자</div>
              </div>
              <div className="text-[32px] text-blue-500">👥</div>
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] text-green-600 font-medium">환자 확정률</div>
                <div className="text-[24px] font-bold text-green-700 mt-1">{currentStats.환자확정률.toFixed(1)}%</div>
                <div className="text-[12px] text-green-600 mt-1">실제 확정한 환자 비율</div>
              </div>
              <div className="text-[32px] text-green-500">✅</div>
            </div>
          </div>
          <div className="bg-yellow-50 rounded-xl p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] text-yellow-600 font-medium">건당 평균 금액</div>
                <div className="text-[24px] font-bold text-yellow-700 mt-1">{formatAmount(currentStats.건당평균금액)}</div>
                <div className="text-[12px] text-yellow-600 mt-1">확정 건당 평균 금액</div>
              </div>
              <div className="text-[32px] text-yellow-500">💰</div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 연간 상담 성과 추이 */}
      <SectionCard title={`${selectedYear}년 월별 상담 성과 추이`} description="연간 전체 트렌드">
        {yearlyTrendData.some(d => d.계획수 > 0) ? (
          <div className="h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyTrendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  stroke="#9ca3af"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  stroke="#9ca3af"
                />
                <Legend />
                <Bar dataKey="계획수" fill="#3182f6" name="총 계획수" />
                <Bar dataKey="확정건수" fill="#10b981" name="총 확정건수" />
                <Line
                  type="monotone"
                  dataKey="확정률"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 5 }}
                  name="평균 확정률"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[400px] text-[#8b95a1]">
            연간 데이터가 없습니다.
          </div>
        )}
      </SectionCard>

      {/* 상담자별 성과 순위 */}
      {counselorData.length > 0 && (
        <SectionCard title={`${selectedYear}년 ${selectedMonth}월 상담자별 성과`} description="확정금액 기준 상위 10명">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#f2f4f6]">
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">순위</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">상담자</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">계획수</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">확정건수</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">확정률</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">확정금액</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">환자확정률</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">평균할인율</th>
                </tr>
              </thead>
              <tbody>
                {counselorData.map((counselor, index) => (
                  <tr key={counselor.name} className="border-b border-[#f9fafb] hover:bg-[#f9fafb]">
                    <td className="py-3 px-3 font-bold text-[#191f28]">{index + 1}</td>
                    <td className="py-3 px-3 font-semibold text-[#191f28]">{counselor.name}</td>
                    <td className="py-3 px-3 tabular-nums text-[#6b7684]">{counselor.계획수.toLocaleString()}</td>
                    <td className="py-3 px-3 tabular-nums font-medium">{counselor.확정건수.toLocaleString()}</td>
                    <td className={`py-3 px-3 tabular-nums font-bold ${
                      counselor.확정률 >= 80 ? "text-[#05c072]" :
                      counselor.확정률 >= 60 ? "text-[#f59e0b]" : "text-[#f04452]"
                    }`}>
                      {counselor.확정률.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 tabular-nums font-semibold text-[#3182f6]">
                      {formatAmount(counselor.확정금액)}
                    </td>
                    <td className="py-3 px-3 tabular-nums text-[#6b7684]">
                      {counselor.환자확정률.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 tabular-nums text-[#6b7684]">
                      {counselor.할인율.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* 확정률 분포 분석 */}
      {counselorData.length > 0 && (
        <SectionCard title="상담자 확정률 분포" description="성과 분포 현황">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 확정률 구간별 분포 */}
            <div>
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-4">확정률 구간별 분포</h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: '80% 이상',
                          value: counselorData.filter(c => c.확정률 >= 80).length,
                          color: '#10b981'
                        },
                        {
                          name: '60-80%',
                          value: counselorData.filter(c => c.확정률 >= 60 && c.확정률 < 80).length,
                          color: '#f59e0b'
                        },
                        {
                          name: '60% 미만',
                          value: counselorData.filter(c => c.확정률 < 60).length,
                          color: '#ef4444'
                        }
                      ].filter(item => item.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({name, value}) => `${name}: ${value}명`}
                    >
                      {[
                        { color: '#10b981' },
                        { color: '#f59e0b' },
                        { color: '#ef4444' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 성과 인사이트 */}
            <div className="space-y-4">
              <h4 className="text-[16px] font-semibold text-[#191f28] mb-4">성과 분석 인사이트</h4>

              {counselorData.length > 0 && (
                <>
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="text-[14px] font-medium text-green-800 mb-1">🏆 최고 성과자</div>
                    <div className="text-[16px] font-bold text-green-700">
                      {counselorData[0].name} ({counselorData[0].확정률.toFixed(1)}%)
                    </div>
                    <div className="text-[12px] text-green-600">
                      확정금액: {formatAmount(counselorData[0].확정금액)}
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <div className="text-[14px] font-medium text-blue-800 mb-1">📊 평균 성과</div>
                    <div className="text-[16px] font-bold text-blue-700">
                      확정률 {currentStats.평균확정률.toFixed(1)}%
                    </div>
                    <div className="text-[12px] text-blue-600">
                      상담자당 평균 {(currentStats.총확정금액 / currentStats.상담자수 / 10000).toFixed(0)}만원
                    </div>
                  </div>

                  <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                    <div className="text-[14px] font-medium text-yellow-800 mb-1">💡 개선 포인트</div>
                    <div className="text-[12px] text-yellow-700">
                      • 확정률 60% 미만: {counselorData.filter(c => c.확정률 < 60).length}명<br/>
                      • 상담 기법 교육 및 멘토링 필요<br/>
                      • 우수 상담자의 노하우 공유 권장
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* 데이터가 없는 경우 */}
      {yearlyTrendData.every(d => d.계획수 === 0) && (
        <div className="text-center py-12 text-[14px] text-[#8b95a1]">
          상담 성과 데이터가 없습니다. 엑셀을 업로드해주세요.
        </div>
      )}
    </div>
  )
}