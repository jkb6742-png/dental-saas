"use client"

import TrendChart, { type TrendSeries } from "./TrendChart"

const COLORS = ["#0062ff", "#05c072", "#f59e0b", "#f04452", "#191f28", "#ec4899"]

type Props = {
  data: Record<string, number | string>[]
  counselors: string[]
}

export default function ConsultationTrendChart({ data, counselors }: Props) {
  const series: TrendSeries[] = counselors.map((c, i) => ({
    key: c,
    name: c,
    type: "line" as const,
    color: COLORS[i % COLORS.length],
    unit: "%",
  }))

  return <TrendChart data={data} series={series} rightUnit="%" />
}
