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
  AreaChart,
  LabelList
} from "@/components/charts/recharts"
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MonthlyRevenueData {
  month: number
  revenuePerPatient: number
  patientCount: number
  totalRevenue: number
}

interface RevenuePerPatientChartProps {
  clinicId: string
  year: number
  chartType: 'new' | 'returning' | 'total'
  title: string
  color: string
  variant?: 'line' | 'area'
  selectedMonth?: number
}

export default function RevenuePerPatientChart({
  clinicId,
  year,
  chartType,
  title,
  color,
  variant = 'area',
  selectedMonth = 12
}: RevenuePerPatientChartProps) {
  const [data, setData] = useState<MonthlyRevenueData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<any>(null)

  const fetchRevenueData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/patients/monthly-revenue-per-patient?clinicId=${clinicId}&year=${year}&type=${chartType}`
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
      console.error('월별 객단가 차트 데이터 로딩 오류:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRevenueData()
  }, [clinicId, year, chartType])

  // 선택한 월까지만 차트 데이터 준비
  const chartData = Array.from({length: selectedMonth}, (_, i) => {
    const monthData = data.find(d => d.month === i + 1)
    return {
      month: `${i + 1}월`,
      monthNum: i + 1,
      revenuePerPatient: monthData ? monthData.revenuePerPatient : 0,
      patientCount: monthData ? monthData.patientCount : 0,
      label: `${year}년 ${i + 1}월`
    }
  })

  const formatTooltip = (value: number, name: string, props: any) => {
    return [`${value.toLocaleString()}원`, props.payload.label]
  }

  const maxValue = Math.max(...chartData.map(d => d.revenuePerPatient), 10000)
  const hasData = summary?.hasData

  // 성장률 계산 (선택한 월 vs 전월) — 실제 현재월(new Date)을 쓰면 미래월=0이 되어 -100%로 잘못 나옴
  const currentRevenue = chartData[selectedMonth - 1]?.revenuePerPatient || 0
  const previousRevenue = chartData[selectedMonth - 2]?.revenuePerPatient || 0
  const growthRate = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0

  if (loading) {
    return (
      <div className="bg-white rounded border border-[#b9b9b3] overflow-hidden p-3 min-w-0">
        <div className="animate-pulse space-y-2.5">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-[220px] bg-slate-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-200/60 p-4">
        <div className="text-center">
          <div className="text-4xl mb-2.5">⚠️</div>
          <h3 className="font-semibold text-red-800 mb-2">오류 발생</h3>
          <p className="text-sm text-red-600 mb-2.5">{error}</p>
          <button
            onClick={fetchRevenueData}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  const getTrendIcon = () => {
    if (growthRate > 0) return <TrendingUp className="w-3 h-3 text-emerald-600" />
    if (growthRate < 0) return <TrendingDown className="w-3 h-3 text-red-600" />
    return <Minus className="w-3 h-3 text-slate-500" />
  }

  const getTrendColor = () => {
    if (growthRate > 0) return "text-emerald-600 bg-emerald-50"
    if (growthRate < 0) return "text-red-600 bg-red-50"
    return "text-slate-500 bg-slate-50"
  }

  return (
    <div className="bg-white rounded border border-[#b9b9b3] overflow-hidden p-3 min-w-0">
      {/* Header */}
      <div className="-mx-3 -mt-3 mb-2.5 px-3 py-2 bg-[#ecece9] border-b border-[#d1d1cc] flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[16px] font-bold text-[#0a0a0a] mb-0.5">
            {year}년 {title} 1인 객단가 월별 추이 (1~{selectedMonth}월)
          </h3>
          <p className="text-[11px] text-slate-500">
            연간 평균 {summary?.overallRevenuePerPatient?.toLocaleString() || 0}원
            {summary?.averageRevenuePerPatient && ` · 월평균 ${summary.averageRevenuePerPatient.toLocaleString()}원`}
          </p>
        </div>

        {/* 성장률 배지 */}
        {hasData && (
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded shrink-0 ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="text-[11px] font-medium tabular-nums">
              {growthRate > 0 ? '+' : ''}{growthRate.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* 차트 */}
      <div className="h-[220px] w-full min-h-[220px] min-w-0">
        <ResponsiveContainer width="100%" height={220} minHeight={220}>
          {variant === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 18, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-revenue-${chartType}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3}/>
                  <stop offset="100%" stopColor={color} stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickMargin={4}
                padding={{ left: 8, right: 8 }}
              />
              <YAxis
                domain={[0, maxValue]}
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                width={50}
                tickMargin={4}
              />
              <Tooltip
                formatter={formatTooltip}
                contentStyle={{
                  borderRadius: 4, border: '1px solid #d1d1cc',
                  boxShadow: '0 4px 12px rgb(0 0 0 / 0.10)', fontSize: 13,
                  background: 'rgba(255, 255, 255, 0.95)'
                }}
              />
              <Area isAnimationActive={false}
                type="monotone"
                dataKey="revenuePerPatient"
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-revenue-${chartType})`}
                dot={{ fill: color, strokeWidth: 1, stroke: '#ffffff', r: 3 }}
                activeDot={{ r: 5, fill: color, stroke: '#ffffff', strokeWidth: 2 }}
              >
                <LabelList
                  dataKey="revenuePerPatient"
                  position="top"
                  offset={10}
                  formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? (v >= 1e8 ? `${(v / 1e8).toFixed(1)}억` : `${Math.round(v / 1e4)}만`) : '')}
                  style={{ fontSize: 11, fontWeight: 700, fill: color }}
                />
              </Area>
            </AreaChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 18, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickMargin={4}
                padding={{ left: 8, right: 8 }}
              />
              <YAxis
                domain={[0, maxValue]}
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                width={50}
                tickMargin={4}
              />
              <Tooltip
                formatter={formatTooltip}
                contentStyle={{
                  borderRadius: 4, border: '1px solid #d1d1cc',
                  boxShadow: '0 4px 12px rgb(0 0 0 / 0.10)', fontSize: 13,
                  background: 'rgba(255, 255, 255, 0.95)'
                }}
              />
              <Line isAnimationActive={false}
                type="monotone"
                dataKey="revenuePerPatient"
                stroke={color}
                strokeWidth={2}
                dot={{ fill: color, strokeWidth: 1, stroke: '#ffffff', r: 3 }}
                activeDot={{ r: 5, fill: color, stroke: '#ffffff', strokeWidth: 2 }}
              >
                <LabelList
                  dataKey="revenuePerPatient"
                  position="top"
                  offset={10}
                  formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? (v >= 1e8 ? `${(v / 1e8).toFixed(1)}억` : `${Math.round(v / 1e4)}만`) : '')}
                  style={{ fontSize: 11, fontWeight: 700, fill: color }}
                />
              </Line>
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* 통계 요약 */}
      {hasData && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">연간 평균</div>
            <div className="text-lg font-bold text-slate-900">
              {summary.overallRevenuePerPatient?.toLocaleString() || 0}원
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">월평균</div>
            <div className="text-lg font-bold text-slate-900">
              {summary.averageRevenuePerPatient?.toLocaleString() || 0}원
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">최고 월</div>
            <div className="text-lg font-bold text-emerald-600">
              {summary.peakMonth?.month || 0}월 ({summary.peakMonth?.revenuePerPatient?.toLocaleString() || 0}원)
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">최소 월</div>
            <div className="text-lg font-bold text-orange-600">
              {summary.lowestMonth?.month || 0}월 ({summary.lowestMonth?.revenuePerPatient?.toLocaleString() || 0}원)
            </div>
          </div>
        </div>
      )}

      {/* 데이터 없음 상태 */}
      {!hasData && (
        <div className="absolute inset-8 bg-white rounded-xl flex items-center justify-center border border-[#d1d1cc]">
          <div className="text-center p-4">
            <div className="text-4xl mb-3">💰</div>
            <h4 className="font-semibold text-slate-800 mb-2">데이터가 없습니다</h4>
            <p className="text-[11px] text-slate-500">
              {year}년 {title} 객단가 데이터가 없습니다.<br />
              "전체접수수납목록.xlsx" 파일을 업로드해주세요.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}