"use client"

import TrendChart from "./TrendChart"

type DataPoint = { label: string; 보험: number; 비급여: number }

export default function TreatmentTrendChart({ data }: { data: DataPoint[] }) {
  return (
    <TrendChart
      data={data}
      series={[
        { key: "보험", name: "보험", type: "bar", color: "#0062ff", unit: "원" },
        { key: "비급여", name: "비급여", type: "bar", color: "#f59e0b", unit: "원" },
      ]}
    />
  )
}
