"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Calendar, FileText, RefreshCw } from "lucide-react"

interface RevenueData {
  id: string
  date: Date
  year: number
  month: number
  day: number
  cashIncome: number
  cardIncome: number
  onlineIncome: number
  totalIncome: number
  totalExpense: number
  netProfit: number
}

interface RevenueStats {
  totalRecords: number
  totalIncome: number
  totalExpense: number
  netProfit: number
  avgDailyIncome: number
}

interface RevenueDetailPageProps {
  clinicId: string
  revenueData: RevenueData[]
  stats: RevenueStats
  pagination: {
    currentPage: number
    totalPages: number
    totalCount: number
    pageSize: number
  }
  filters: {
    year?: number
    month?: number
  }
  availablePeriods: { year: number; month: number }[]
}

export default function RevenueDetailPage({
  clinicId,
  revenueData,
  stats,
  pagination,
  filters,
  availablePeriods
}: RevenueDetailPageProps) {
  const [selectedYear, setSelectedYear] = useState(filters.year || 2026)
  const [selectedMonth, setSelectedMonth] = useState(filters.month || '')

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    })
  }

  const handleFilterChange = () => {
    const params = new URLSearchParams()
    params.set('year', selectedYear.toString())
    if (selectedMonth) params.set('month', selectedMonth.toString())

    window.location.href = `/dashboard/${clinicId}/database/revenue?${params.toString()}`
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
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">💰 매출 데이터</h1>
                <p className="text-slate-600">일별 매출, 지출, 순이익 상세 정보</p>
              </div>
            </div>

            {/* 필터 */}
            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-slate-500" />
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
              <button
                onClick={handleFilterChange}
                className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                적용
              </button>
            </div>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-700">총 수입</span>
              </div>
              <div className="text-2xl font-bold text-green-900">{formatCurrency(stats.totalIncome)}</div>
              <div className="text-sm text-green-600">{stats.totalRecords}일 데이터</div>
            </div>

            <div className="bg-red-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-red-700">총 지출</span>
              </div>
              <div className="text-2xl font-bold text-red-900">{formatCurrency(stats.totalExpense)}</div>
              <div className="text-sm text-red-600">지출 데이터</div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">순 이익</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">{formatCurrency(stats.netProfit)}</div>
              <div className="text-sm text-blue-600">수입 - 지출</div>
            </div>

            <div className="bg-purple-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-700">일평균 수입</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">{formatCurrency(stats.avgDailyIncome)}</div>
              <div className="text-sm text-purple-600">하루 평균</div>
            </div>
          </div>
        </div>

        {/* 데이터 테이블 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-slate-600" />
              <h3 className="text-xl font-bold text-slate-900">일별 매출 데이터</h3>
              <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm">
                {pagination.totalCount}건
              </span>
            </div>
          </div>

          {revenueData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📊</div>
              <p className="text-slate-600">선택된 기간에 데이터가 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left p-4 font-semibold text-slate-700">날짜</th>
                      <th className="text-right p-4 font-semibold text-slate-700">현금수입</th>
                      <th className="text-right p-4 font-semibold text-slate-700">카드수입</th>
                      <th className="text-right p-4 font-semibold text-slate-700">온라인수입</th>
                      <th className="text-right p-4 font-semibold text-slate-700">총수입</th>
                      <th className="text-right p-4 font-semibold text-slate-700">총지출</th>
                      <th className="text-right p-4 font-semibold text-slate-700">순이익</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueData.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4">
                          <div className="font-medium text-slate-900">{formatDate(item.date)}</div>
                          <div className="text-xs text-slate-500">{item.year}년 {item.month}월 {item.day}일</div>
                        </td>
                        <td className="text-right p-4 text-slate-700">{formatCurrency(item.cashIncome)}</td>
                        <td className="text-right p-4 text-slate-700">{formatCurrency(item.cardIncome)}</td>
                        <td className="text-right p-4 text-slate-700">{formatCurrency(item.onlineIncome)}</td>
                        <td className="text-right p-4 font-semibold text-slate-900">{formatCurrency(item.totalIncome)}</td>
                        <td className="text-right p-4 text-red-600">{formatCurrency(item.totalExpense)}</td>
                        <td className="text-right p-4 font-semibold text-green-600">{formatCurrency(item.netProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(pageNum => (
                    <Link
                      key={pageNum}
                      href={`?page=${pageNum}${filters.year ? `&year=${filters.year}` : ''}${filters.month ? `&month=${filters.month}` : ''}`}
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