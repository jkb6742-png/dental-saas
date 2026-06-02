"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts"

interface PatientTypeChartProps {
  data: Array<{
    name: string
    newPatients?: number
    returningPatients?: number
    totalPatients?: number
  }>
  title: string
  type?: "bar" | "pie"
  showLegend?: boolean
}

export default function PatientTypeChart({
  data,
  title,
  type = "bar",
  showLegend = true
}: PatientTypeChartProps) {
  // 색상 테마
  const colors = {
    newPatients: "#3182f6",      // 신환 - 블루
    returningPatients: "#10b981", // 구환 - 그린
    background: "#f8fafc"
  }

  const pieColors = ["#3182f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]

  if (type === "pie") {
    // 파이차트용 데이터 변환
    const pieData = data.map((item, index) => ({
      name: item.name,
      value: item.totalPatients || 0,
      fill: pieColors[index % pieColors.length]
    }))

    return (
      <div className="w-full">
        <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">{title}</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  // 바차트 (기본)
  return (
    <div className="w-full">
      <h3 className="text-[16px] font-semibold text-[#191f28] mb-4">{title}</h3>
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              stroke="#9ca3af"
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
              stroke="#9ca3af"
            />
            {showLegend && (
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="rect"
              />
            )}
            <Bar
              dataKey="newPatients"
              name="신환"
              fill={colors.newPatients}
              radius={[2, 2, 0, 0]}
              stackId="patients"
            />
            <Bar
              dataKey="returningPatients"
              name="구환"
              fill={colors.returningPatients}
              radius={[2, 2, 0, 0]}
              stackId="patients"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-[#f8fafc] rounded-xl p-4 text-center">
          <div className="text-[20px] font-bold text-[#3182f6]">
            {data.reduce((sum, item) => sum + (item.newPatients || 0), 0).toLocaleString()}
          </div>
          <div className="text-[13px] text-[#6b7280] mt-1">총 신환</div>
        </div>
        <div className="bg-[#f8fafc] rounded-xl p-4 text-center">
          <div className="text-[20px] font-bold text-[#10b981]">
            {data.reduce((sum, item) => sum + (item.returningPatients || 0), 0).toLocaleString()}
          </div>
          <div className="text-[13px] text-[#6b7280] mt-1">총 구환</div>
        </div>
        <div className="bg-[#f8fafc] rounded-xl p-4 text-center">
          <div className="text-[20px] font-bold text-[#191f28]">
            {data.reduce((sum, item) => sum + (item.newPatients || 0) + (item.returningPatients || 0), 0).toLocaleString()}
          </div>
          <div className="text-[13px] text-[#6b7280] mt-1">총 환자</div>
        </div>
      </div>
    </div>
  )
}