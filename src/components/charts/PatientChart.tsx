"use client"

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts"

type PatientDataPoint = {
  label: string
  newPatients: number
  totalPatients: number
}

export function PatientTrendChart({ data, title }: { data: PatientDataPoint[], title: string }) {
  return (
    <div>
      <h4 className="text-base font-semibold text-gray-900 mb-4">{title}</h4>
      <ResponsiveContainer width="100%" height={280} minHeight={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#8b95a1" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#8b95a1" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={(v, name) => [`${Number(v).toLocaleString()}명`, name]}
            contentStyle={{
              borderRadius: 12,
              border: "none",
              boxShadow: "0 4px 12px 0 rgb(0 0 0 / 0.10)",
              fontSize: 13
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          />
          <Line
            type="monotone"
            dataKey="newPatients"
            name="신환"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: "#10b981" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="totalPatients"
            name="총 인원"
            stroke="#3182f6"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: "#3182f6" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

type ReturnPatientDataPoint = {
  label: string
  returnPatients: number
  totalPatients: number
}

export function ReturnPatientChart({ data }: { data: ReturnPatientDataPoint[] }) {
  return (
    <div>
      <h4 className="text-base font-semibold text-gray-900 mb-4">구환 + 총인원 추이</h4>
      <ResponsiveContainer width="100%" height={280} minHeight={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#8b95a1" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#8b95a1" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={(v, name) => [`${Number(v).toLocaleString()}명`, name]}
            contentStyle={{
              borderRadius: 12,
              border: "none",
              boxShadow: "0 4px 12px 0 rgb(0 0 0 / 0.10)",
              fontSize: 13
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          />
          <Line
            type="monotone"
            dataKey="returnPatients"
            name="구환"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: "#f59e0b" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="totalPatients"
            name="총 인원"
            stroke="#3182f6"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: "#3182f6" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

type NewPatientStatsDataPoint = {
  label: string
  avgDailyNewPatients: number
}

export function DailyNewPatientChart({ data }: { data: NewPatientStatsDataPoint[] }) {
  return (
    <div>
      <h4 className="text-base font-semibold text-gray-900 mb-4">일평균 신환 추이</h4>
      <ResponsiveContainer width="100%" height={280} minHeight={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#8b95a1" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#8b95a1" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={(v, name) => [`${Number(v).toFixed(1)}명`, name]}
            contentStyle={{
              borderRadius: 12,
              border: "none",
              boxShadow: "0 4px 12px 0 rgb(0 0 0 / 0.10)",
              fontSize: 13
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          />
          <Line
            type="monotone"
            dataKey="avgDailyNewPatients"
            name="일평균 신환"
            stroke="#8b5cf6"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: "#8b5cf6" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

type NewPatientRevenueDataPoint = {
  label: string
  newPatientAverage: number
  newPatientTotalRevenue: number
}

const formatRevenue = (v: number) =>
  v >= 100_000_000 ? `${(v / 100_000_000).toFixed(1)}억` :
  v >= 10_000_000  ? `${(v / 10_000_000).toFixed(0)}천만` :
  v >= 1_000_000   ? `${(v / 1_000_000).toFixed(0)}백만` :
  v >= 10_000      ? `${(v / 10_000).toFixed(0)}만` : String(v)

export function NewPatientRevenueChart({ data }: { data: NewPatientRevenueDataPoint[] }) {
  return (
    <div>
      <h4 className="text-base font-semibold text-gray-900 mb-4">신환 객단가 + 총진료비 추이</h4>
      <ResponsiveContainer width="100%" height={280} minHeight={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#8b95a1" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            tickFormatter={(v) => `${Math.round(v/1000)}K`}
            tick={{ fontSize: 11, fill: "#8b95a1" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatRevenue}
            tick={{ fontSize: 11, fill: "#8b95a1" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={(v, name) => {
              if (name === '신환 객단가') {
                return [`${Number(v).toLocaleString()}원`, name]
              } else {
                return [`${Number(v).toLocaleString()}원`, name]
              }
            }}
            contentStyle={{
              borderRadius: 12,
              border: "none",
              boxShadow: "0 4px 12px 0 rgb(0 0 0 / 0.10)",
              fontSize: 13
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="newPatientAverage"
            name="신환 객단가"
            stroke="#ef4444"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: "#ef4444" }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="newPatientTotalRevenue"
            name="신환 총진료비"
            stroke="#06b6d4"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: "#06b6d4" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// 레거시 호환성을 위한 기본 export (기존 코드 호환)
type DataPoint = { label: string; newPatients: number; totalPatients: number; revisitRate: number }

export default function PatientChart({ data }: { data: DataPoint[] }) {
  const chartData = data.map(d => ({
    label: d.label,
    newPatients: d.newPatients,
    totalPatients: d.totalPatients
  }))

  return <PatientTrendChart data={chartData} title="환자 추이" />
}
