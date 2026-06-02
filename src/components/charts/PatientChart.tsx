"use client"

import TrendChart from "./TrendChart"

type DataPoint = { label: string; newPatients: number; totalPatients: number; revisitRate: number }

export default function PatientChart({ data }: { data: DataPoint[] }) {
  return (
    <TrendChart
      data={data}
      series={[
        { key: "totalPatients", name: "총 접수", type: "bar", color: "#ebf3fe", unit: "명" },
        { key: "newPatients", name: "신환", type: "bar", color: "#3182f6", unit: "명" },
        { key: "revisitRate", name: "재방문율", type: "line", color: "#05c072", unit: "%", yAxisId: "right" },
      ]}
      rightUnit="%"
    />
  )
}
