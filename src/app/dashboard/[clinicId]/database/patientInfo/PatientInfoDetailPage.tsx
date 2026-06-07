"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Users, RefreshCw } from "lucide-react"

interface PatientData {
  id: string
  chartNumber: string
  name: string
  age?: number
  gender?: string
  visitDate: Date
  visitType: string
  waitingTime: number
  revenue: number
  region?: string
  visitRoute?: string
}

interface PatientStats {
  totalPatients: number
  newPatients: number
  returningPatients: number
  totalRevenue: number
  avgRevenue: number
  avgWaitingTime: number
}

interface PatientInfoDetailPageProps {
  clinicId: string
  patientData: PatientData[]
  stats: PatientStats
  pagination: {
    currentPage: number
    totalPages: number
    totalCount: number
    pageSize: number
  }
  filters: {
    year?: number
    month?: number
    visitType?: string
  }
  availablePeriods: { year: number; month: number }[]
}

export default function PatientInfoDetailPage({
  clinicId,
  patientData,
  stats,
  pagination,
  filters,
  availablePeriods
}: PatientInfoDetailPageProps) {
  const [selectedYear, setSelectedYear] = useState(filters.year || 2026)
  const [selectedMonth, setSelectedMonth] = useState(filters.month || '')
  const [selectedVisitType, setSelectedVisitType] = useState(filters.visitType || '')

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleFilterChange = () => {
    const params = new URLSearchParams()
    params.set('year', selectedYear.toString())
    if (selectedMonth) params.set('month', selectedMonth.toString())
    if (selectedVisitType) params.set('visitType', selectedVisitType)

    window.location.href = `/dashboard/${clinicId}/database/patientInfo?${params.toString()}`
  }

  const uniqueYears = [...new Set(availablePeriods.map(p => p.year))].sort((a, b) => b - a)
  const monthsForYear = availablePeriods
    .filter(p => p.year === selectedYear)
    .map(p => p.month)
    .sort((a, b) => b - a)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="space-y-6 p-6">
        {/* 헤더 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link href={`/dashboard/${clinicId}/database`}>
                <button className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-colors">
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
              </Link>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">👥 환자 정보</h1>
                <p className="text-slate-600">환자 방문 기록, 대기시간, 진료비 상세 정보</p>
              </div>
            </div>

            {/* 필터 */}
            <div className="flex items-center gap-4">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm"
              >
                {uniqueYears.map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm"
              >
                <option value="">전체 월</option>
                {monthsForYear.map(month => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
              <select
                value={selectedVisitType}
                onChange={(e) => setSelectedVisitType(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm"
              >
                <option value="">전체 유형</option>
                <option value="신환">신환</option>
                <option value="구환">구환</option>
              </select>
              <button
                onClick={handleFilterChange}
                className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                적용
              </button>
            </div>
          </div>

        </div>

        {/* 데이터 테이블 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900">환자 방문 기록</h3>
            <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm">
              {pagination.totalCount}건
            </span>
          </div>

          {patientData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">👥</div>
              <p className="text-slate-600">선택된 조건에 맞는 환자 데이터가 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left p-4 font-semibold text-slate-700">차트번호</th>
                      <th className="text-left p-4 font-semibold text-slate-700">환자명</th>
                      <th className="text-center p-4 font-semibold text-slate-700">나이/성별</th>
                      <th className="text-center p-4 font-semibold text-slate-700">방문일</th>
                      <th className="text-center p-4 font-semibold text-slate-700">신구</th>
                      <th className="text-right p-4 font-semibold text-slate-700">진료비</th>
                      <th className="text-center p-4 font-semibold text-slate-700">대기시간</th>
                      <th className="text-left p-4 font-semibold text-slate-700">지역</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientData.map((patient) => (
                      <tr key={patient.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-mono text-xs">{patient.chartNumber}</td>
                        <td className="p-4 font-medium text-slate-900">{patient.name}</td>
                        <td className="text-center p-4 text-slate-700">
                          {patient.age && patient.gender ? `${patient.age}세/${patient.gender}` : '-'}
                        </td>
                        <td className="text-center p-4 text-slate-700">{formatDate(patient.visitDate)}</td>
                        <td className="text-center p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            patient.visitType === '신환'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {patient.visitType}
                          </span>
                        </td>
                        <td className="text-right p-4 font-semibold text-slate-900">{formatCurrency(patient.revenue)}</td>
                        <td className="text-center p-4 text-slate-700">{patient.waitingTime}분</td>
                        <td className="p-4 text-slate-600 text-xs">{patient.region || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  {Array.from({ length: Math.min(pagination.totalPages, 10) }, (_, i) => i + 1).map(pageNum => (
                    <Link
                      key={pageNum}
                      href={`?page=${pageNum}${filters.year ? `&year=${filters.year}` : ''}${filters.month ? `&month=${filters.month}` : ''}${filters.visitType ? `&visitType=${filters.visitType}` : ''}`}
                    >
                      <button className={`px-3 py-1 rounded ${
                        pageNum === pagination.currentPage
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}>
                        {pageNum}
                      </button>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}