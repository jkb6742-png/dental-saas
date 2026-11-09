"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/components/charts/recharts"

export type CompareSeries = { key: string; name: string; color: string }

type Props = {
  data: Array<Record<string, unknown>>
  series: CompareSeries[]
  unit: "원" | "명" | "%"
  height?: number
  /** 순서가 없는 항목(지역·내원경로)은 가로 막대로 그린다 */
  horizontal?: boolean
  /** 모든 계열의 모든 점에 값을 표시 */
  showValues?: boolean
  /** 강조할 계열(올해). 기본은 첫 번째 계열 */
  labelSeries?: string
  /** 범례를 그래프 위 오른쪽에 둔다. 그래프 바로 아래에 다른 줄을 붙일 때 쓴다 */
  legendTop?: boolean
}

const compact = (v: number, unit: Props["unit"]) => {
  if (unit === "%") return `${v.toFixed(0)}%`
  if (unit === "명") return v.toLocaleString("ko-KR", { maximumFractionDigits: 1 })
  const a = Math.abs(v)
  if (a >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (a >= 10_000) return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만`
  return v.toLocaleString("ko-KR")
}

const tick = { fontSize: 12, fill: "#555555" }
const AXIS_WIDTH = { 원: 56, 명: 44, "%": 40 } as const

export default function YearCompareChart({ data, series, unit, height = 220, horizontal, showValues, labelSeries, legendTop }: Props) {
  const labeled = labelSeries ?? series[0]?.key

  const tooltipProps = {
    formatter: (v: unknown, name: unknown) =>
      [
        typeof v === "number"
          ? unit === "원"
            ? `${Math.round(v).toLocaleString("ko-KR")}원`
            : `${v.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}${unit}`
          : "—",
        String(name),
      ] as [string, string],
    // 전년 대비가 있으면 말풍선 제목에 함께 보여 준다
    labelFormatter: (label: unknown, payload: ReadonlyArray<{ payload?: { yoy?: number | null } }>) => {
      const yoy = payload?.[0]?.payload?.yoy
      return typeof yoy === "number" ? `${label} · 전년 대비 ${yoy > 0 ? "+" : ""}${yoy.toFixed(1)}%` : String(label)
    },
    contentStyle: { borderRadius: 4, border: "1px solid #d1d1cc", boxShadow: "0 4px 12px rgb(0 0 0 / 0.10)", fontSize: 13 },
  }
  const legend = series.length > 1 && (
    <Legend iconType={horizontal ? "square" : "plainline"} iconSize={horizontal ? 9 : 14} wrapperStyle={legendTop ? { fontSize: 12, paddingBottom: 6 } : { fontSize: 12, paddingTop: 2 }} verticalAlign={legendTop ? "top" : "bottom"} align={legendTop ? "right" : "center"} />
  )

  return (
    <ResponsiveContainer width="100%" height={height}>
      {horizontal ? (
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="#ecece9" horizontal={false} />
          <XAxis type="number" hide domain={[0, "auto"]} />
          <YAxis type="category" dataKey="label" width={112} tick={tick} axisLine={false} tickLine={false} interval={0} />
          <Tooltip {...(tooltipProps as object)} cursor={{ fill: "#f2f2ef" }} />
          {legend}
          {series.map((s) => (
            <Bar key={s.key} isAnimationActive={false} dataKey={s.key} name={s.name} fill={s.color} radius={[0, 2, 2, 0]} maxBarSize={13}>
              {showValues && (
                <LabelList
                  dataKey={s.key}
                  position="right"
                  formatter={(v: unknown) => (typeof v === "number" && v > 0 ? compact(v, unit) : "")}
                  style={s.key === labeled ? { fontSize: 12, fontWeight: 700, fill: "#0a0a0a" } : { fontSize: 11, fill: "#6f6f6a" }}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      ) : (
        <LineChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#ecece9" vertical={false} />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} tickMargin={6} interval={0} padding={{ left: 22, right: 22 }} />
          <YAxis tick={tick} axisLine={false} tickLine={false} width={AXIS_WIDTH[unit]} tickFormatter={(v: number) => compact(v, unit)} />
          <Tooltip {...(tooltipProps as object)} />
          {legend}
          {series.map((s) => {
            const main = s.key === labeled
            return (
              <Line
                key={s.key}
                isAnimationActive={false}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={main ? 2.5 : 1.75}
                dot={{ r: main ? 3 : 2 }}
                activeDot={{ r: 5 }}
              >
                {showValues && (
                  <LabelList
                    dataKey={s.key}
                    content={
                      ((p: { x?: number | string; y?: number | string; value?: unknown; index?: number }) => {
                        if (typeof p.value !== "number" || p.x == null || p.y == null) return null
                        // 같은 달의 다른 계열보다 크면 위, 작으면 아래에 둔다. 같으면 강조 계열이 위.
                        const row = data[p.index ?? -1] ?? {}
                        const others = series.filter((o) => o.key !== s.key).map((o) => row[o.key]).filter((v): v is number => typeof v === "number")
                        const below = others.some((v) => v > (p.value as number) || (v === p.value && !main))
                        return (
                          <text
                            x={Number(p.x)}
                            y={Number(p.y) + (below ? 16 : -9)}
                            textAnchor="middle"
                            fontSize={main ? 12 : 11}
                            fontWeight={main ? 700 : 400}
                            fill={main ? "#0a0a0a" : "#6f6f6a"}
                          >
                            {compact(p.value, unit)}
                          </text>
                        )
                      }) as never
                    }
                  />
                )}
              </Line>
            )
          })}
        </LineChart>
      )}
    </ResponsiveContainer>
  )
}
