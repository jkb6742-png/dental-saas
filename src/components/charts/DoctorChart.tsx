"use client"

import TrendChart from "./TrendChart"

type DataPoint = { name: string; 매출: number; 환자수: number; 신환: number }

export default function DoctorChart({ data }: { data: DataPoint[] }) {
  return (
    <TrendChart
      data={data.map((d) => ({ ...d, label: d.name }))}
      series={[
        { key: "매출", name: "매출", type: "bar", color: "#3182f6", unit: "원" },
        { key: "환자수", name: "환자 수", type: "line", color: "#8b95a1", unit: "명", yAxisId: "right" },
        { key: "신환", name: "신환", type: "line", color: "#05c072", unit: "명", yAxisId: "right" },
      ]}
      rightUnit="명"
    />
  )
}
