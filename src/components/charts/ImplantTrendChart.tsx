"use client"

import TrendChart from "./TrendChart"

type DataPoint = { label: string; 수술횟수: number; 사용개수: number }

export default function ImplantTrendChart({ data }: { data: DataPoint[] }) {
  return (
    <TrendChart
      data={data}
      series={[
        { key: "수술횟수", name: "수술 횟수", type: "bar", color: "#3182f6", unit: "건" },
        { key: "사용개수", name: "사용 개수", type: "line", color: "#05c072", unit: "개" },
      ]}
    />
  )
}
