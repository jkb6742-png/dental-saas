"use client"

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MonthlyData {
  month: number
  count: number
}

interface PatientMonthlyChartProps {
  clinicId: string
  year: number
  chartType: 'new' | 'returning' | 'total'
  title: string
  color: string
  variant?: 'line' | 'area'
  selectedMonth?: number
}

export default function PatientMonthlyChart({
  clinicId,
  year,
  chartType,
  title,
  color,
  variant = 'area',
  selectedMonth = 12
}: PatientMonthlyChartProps) {
  const [data, setData] = useState<MonthlyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<any>(null)

  const fetchMonthlyData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/patients/monthly-chart?clinicId=${clinicId}&year=${year}&type=${chartType}`
      )

      const result = await response.json()

      if (result.success) {
        setData(result.data)
        setSummary(result.summary)
      } else {
        setError(result.error || '데이터를 불러올 수 없습니다.')
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.')
      console.error('월별 차트 데이터 로딩 오류:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMonthlyData()
  }, [clinicId, year, chartType])

  // 선택한 월까지만 차트 데이터 준비
  const chartData = Array.from({length: selectedMonth}, (_, i) => {
    const monthData = data.find(d => d.month === i + 1)
    return {
      month: `${i + 1}월`,
      monthNum: i + 1,
      count: monthData ? monthData.count : 0,
      label: `${year}년 ${i + 1}월`
    }
  })

  const formatTooltip = (value: number, name: string, props: any) => {
    return [`${value.toLocaleString()}명`, props.payload.label]
  }

  const maxValue = Math.max(...chartData.map(d => d.count), 10)
  const hasData = summary?.hasData

  // 성장률 계산
  const currentMonth = new Date().getMonth() + 1
  const currentCount = chartData[currentMonth - 1]?.count || 0
  const previousCount = chartData[currentMonth - 2]?.count || 0
  const growthRate = previousCount > 0 ? ((currentCount - previousCount) / previousCount) * 100 : 0

  if (loading) {
    return (
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-red-200/60 p-8">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="font-semibold text-red-800 mb-2">오류 발생</h3>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchMonthlyData}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  const getTrendIcon = () => {
    if (growthRate > 0) return <TrendingUp className="w-4 h-4 text-emerald-600" />
    if (growthRate < 0) return <TrendingDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-slate-500" />
  }

  const getTrendColor = () => {
    if (growthRate > 0) return "text-emerald-600 bg-emerald-50"
    if (growthRate < 0) return "text-red-600 bg-red-50"
    return "text-slate-500 bg-slate-50"
  }

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8 hover:shadow-lg transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            {year}년 {title} 월별 추이 (1~{selectedMonth}월)
          </h3>
          <p className="text-sm text-slate-600">
            연간 총 {summary?.totalPatients?.toLocaleString() || 0}명
            {summary?.averageMonthly && ` · 월평균 ${summary.averageMonthly}명`}
          </p>
        </div>

        {/* 성장률 배지 */}
        {hasData && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="text-sm font-medium">
              {growthRate > 0 ? '+' : ''}{growthRate.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* 차트 */}
      <div className="h-64 mb-4 w-full min-h-[256px] min-w-0">
        <ResponsiveContainer width="100%" height={256} minHeight={256}>
          {variant === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id={`gradient-${chartType}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3}/>
                  <stop offset="100%" stopColor={color} stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, maxValue]}
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${value}명`}
                width={45}
              />
              <Tooltip
                formatter={formatTooltip}
                contentStyle={{
                  borderRadius: 12,
                  border: 'none',
                  boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)',
                  fontSize: 13,
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(8px)'
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={color}
                strokeWidth={3}
                fill={`url(#gradient-${chartType})`}
                dot={{ fill: color, strokeWidth: 2, stroke: '#ffffff', r: 4 }}
                activeDot={{ r: 6, fill: color, stroke: '#ffffff', strokeWidth: 3 }}
              />
            </AreaChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, maxValue]}
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${value}명`}
                width={45}
              />
              <Tooltip
                formatter={formatTooltip}
                contentStyle={{
                  borderRadius: 12,
                  border: 'none',
                  boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)',
                  fontSize: 13,
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(8px)'
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke={color}
                strokeWidth={3}
                dot={{ fill: color, strokeWidth: 2, stroke: '#ffffff', r: 4 }}
                activeDot={{ r: 6, fill: color, stroke: '#ffffff', strokeWidth: 3 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* 통계 요약 */}
      {hasData && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">연간 총합</div>
            <div className="text-lg font-bold text-slate-900">
              {summary.totalPatients?.toLocaleString() || 0}명
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">월 평균</div>
            <div className="text-lg font-bold text-slate-900">
              {summary.averageMonthly || 0}명
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">최고 월</div>
            <div className="text-lg font-bold text-emerald-600">
              {summary.peakMonth?.month || 0}월 ({summary.peakMonth?.count || 0}명)
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">최소 월</div>
            <div className="text-lg font-bold text-orange-600">
              {summary.lowestMonth?.month || 0}월 ({summary.lowestMonth?.count || 0}명)
            </div>
          </div>
        </div>
      )}

      {/* 데이터 없음 상태 */}
      {!hasData && (
        <div className="absolute inset-8 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 rounded-xl flex items-center justify-center backdrop-blur-sm">
          <div className="text-center p-6">
            <div className="text-4xl mb-3">📊</div>
            <h4 className="font-semibold text-slate-800 mb-2">데이터가 없습니다</h4>
            <p className="text-sm text-slate-600">
              {year}년 {title} 데이터가 없습니다.<br />
              "전체접수수납목록.xlsx" 파일을 업로드해주세요.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}